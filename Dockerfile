FROM node:22-alpine AS node

WORKDIR /app

COPY web ./web

RUN cd web && npm install && npx vite build

FROM python:3.12.7-slim

WORKDIR /app

COPY . .

COPY --from=node /app/web/dist ./web/dist

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc ca-certificates curl gnupg \
    # Install the Docker CLI (client only) so the optional langbot_box
    # service can drive the mounted host Docker socket and create sandbox
    # containers. The same image powers langbot / plugin_runtime / box; only
    # box uses the client. Arch-aware via dpkg so multi-arch builds work.
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli \
    && python -m pip install --no-cache-dir uv \
    && uv sync \
    && apt-get purge -y --auto-remove curl gnupg \
    && rm -rf /var/lib/apt/lists/* \
    && touch /.dockerenv

CMD [ "uv", "run", "--no-sync", "main.py" ]