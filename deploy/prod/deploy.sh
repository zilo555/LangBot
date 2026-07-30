#!/usr/bin/env bash
set -Eeuo pipefail

cd /opt/langbot-cloud-prod
TAG=${1:?usage: deploy.sh prod-<40-char-sha>}
[[ "$TAG" =~ ^prod-[0-9a-f]{40}$ ]] || { echo 'invalid immutable image tag' >&2; exit 2; }
[[ -s .env ]] || { echo '/opt/langbot-cloud-prod/.env is missing' >&2; exit 3; }

update_env() {
  local key=$1 value=$2
  python3 - "$key" "$value" <<'PY'
from pathlib import Path
import os
import sys

path = Path('.env')
key, value = sys.argv[1:]
lines = path.read_text().splitlines()
updated = False
for index, line in enumerate(lines):
    if line.startswith(f'{key}='):
        lines[index] = f'{key}={value}'
        updated = True
        break
if not updated:
    lines.append(f'{key}={value}')
temporary = Path('.env.tmp')
temporary.write_text('\n'.join(lines) + '\n')
os.chmod(temporary, 0o600)
temporary.replace(path)
PY
}
update_env LANGBOT_IMAGE_TAG "$TAG"
set -a
. ./.env
set +a

docker compose pull postgres redis migrate plugin-runtime box core
docker compose up -d postgres redis
for _ in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U langbot_operator -d langbot >/dev/null 2>&1; then break; fi
  sleep 2
done
docker compose exec -T postgres pg_isready -U langbot_operator -d langbot >/dev/null

docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U langbot_operator -d langbot \
  -v runtime_password="$POSTGRES_RUNTIME_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE langbot_runtime LOGIN PASSWORD %L', :'runtime_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'langbot_runtime')\gexec
ALTER ROLE langbot_runtime PASSWORD :'runtime_password';
GRANT CONNECT ON DATABASE langbot TO langbot_runtime;
GRANT USAGE, CREATE ON SCHEMA public TO langbot_runtime;
SQL

docker compose --profile tools run --rm migrate

docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U langbot_operator -d langbot <<'SQL'
GRANT USAGE ON SCHEMA public TO langbot_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO langbot_runtime;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO langbot_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE langbot_operator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO langbot_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE langbot_operator IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO langbot_runtime;
SQL

docker compose up -d --remove-orphans plugin-runtime box core
for _ in $(seq 1 90); do
  if docker compose exec -T core python -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:5300/healthz", timeout=3)' >/dev/null 2>&1; then
    docker compose ps
    exit 0
  fi
  sleep 2
done
docker compose logs --tail=200 core plugin-runtime box >&2
exit 1
