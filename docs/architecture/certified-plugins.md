# Certified Plugins

## Admission boundary

Core verifies a plugin archive **before** artifact storage, `PluginSetting`
persistence, or a Plugin Runtime apply request. It calls the SDK public
`langbot_plugin.certification.verify_archive()` API, which reads the strict
certificate envelope from the ZIP comment and verifies the signed normalized
ZIP digest without extracting the payload.

Core retains the artifact SHA-256, normalized digest
(`normalized_zip_digest()`), verification state, declared shared-runtime
profile, key ID, selected admission profile, and stable admission code in the
durable plugin `install_info._certification` record. The record belongs to the
installation row; no schema migration is needed for this additive JSON
metadata.

## Trusted issuer configuration

Configure the non-secret Ed25519 public-key ring in `data/config.yaml`:

```yaml
plugin:
  certification:
    trusted_public_keys:
      issuer-2026-q3: "<base64 encoded 32-byte Ed25519 public key>"
```

Key IDs must match the SDK envelope. Values are standard base64 raw public
keys, not private/signing keys. An invalid key-ring configuration is rejected
rather than weakening verification. Keep active issuer keys during a rotation
until archives signed by retired IDs are no longer installed.

## Admission matrix

| Deployment | SDK verification | Explicit `administrator_force` | Result |
| --- | --- | --- | --- |
| Cloud | valid envelope declaring `shared-runtime-v1` | any | admitted to the shared profile |
| Cloud | absent | any | reject before storage with `CERTIFIED_PLUGIN_CLOUD_CERTIFICATE_REQUIRED` |
| Cloud | malformed, untrusted, invalid, or non-shared | any | reject before storage with `CERTIFIED_PLUGIN_CLOUD_CERTIFICATE_INVALID` |
| OSS | absent legacy envelope | any | admitted to the dedicated profile |
| OSS | valid envelope declaring `shared-runtime-v1` | any | selected shared profile |
| OSS | malformed or invalid declaration | false | reject with `CERTIFIED_PLUGIN_OSS_FORCE_REQUIRED` |
| OSS | malformed or invalid declaration | true | admitted to the dedicated profile |

`administrator_force` is deliberately strict: it is recognized only when the
install request carries boolean `true`. The local upload endpoint accepts the
multipart field `administrator_force=true`; GitHub and marketplace install
payloads carry the same field. The existing resource-manage authorization fence
protects those endpoints. A force never creates a Cloud dedicated fallback.

## Runtime and logs

SDK 0.6.2 carries an installation-level execution mode in both apply and
authoritative reconcile payloads. Core selects `shared-runtime-v1` only when
the persisted certification record says verification was valid, both the
certificate and admission profiles are `shared-runtime-v1`, the admission code
is shared-eligible, and the record's artifact SHA-256 exactly matches the
installation row. Missing, malformed, stale, invalid, or dedicated admission
facts select `dedicated`. Install, upgrade, configuration revision, restart,
and reconnect all use this same persisted-fact derivation.

The existing public plugin-log boundary already applies the immutable
installation binding (including workspace UUID) through
`RuntimeConnectionHandler.installation_scope()` before requesting logs. This is
the actual tenant exposure boundary, so valid shared certificates use that
binding-scoped transport; Core does not invent a second log stream or expose
process-wide log output. Dedicated and invalid/legacy installations use the
same existing installation scope.

## SDK versioning

Core pins `langbot-plugin==0.6.2`, the first published SDK release carrying the
canonical installation execution-mode contract.
