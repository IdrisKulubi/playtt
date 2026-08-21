# Cloudflare R2 security configuration

This document describes the required private-media posture for PlayTT Phase 4.

## Buckets

- Use separate private buckets for development, staging, and production.
- Disable public access on every bucket.
- Do not expose bucket names, account IDs, or credentials in client bundles, mobile apps, firmware, or API JSON.

## Credentials

- Scope R2 API tokens to one environment bucket.
- Grant only the operations required by the server adapter: `PutObject`, `GetObject`, `HeadObject`, `DeleteObject`, `ListObjectsV2`.
- Store credentials only in server environment variables:
  - `R2_ACCOUNT_ID`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET`
  - `R2_ENDPOINT` (optional override)
  - `R2_REGION=auto`

## Grants

- The application creates `media_assets` metadata before upload.
- Object keys are generated server-side and never accepted from clients alone.
- Upload and download URLs are short-lived exact-key grants issued only after database authorization.
- Production must use `MEDIA_STORE_DRIVER=r2`. The fake in-memory adapter is development/test only.

## CORS

Configure exact production CORS on the bucket:

- Allowed methods: `PUT`, `GET`, `HEAD`
- Allowed headers: `Content-Type`, `Content-Length`, `x-amz-checksum-sha256` when used
- Allowed origins: approved web/mobile origins only
- Do not use wildcard origins in production

## Lifecycle and retention

- `session_short`: expire/delete within 24 hours
- `replay_standard`: retain for the configured replay library window
- `replay_owned`: retain while the owning user entitlement remains active

Apply lifecycle rules by object-key prefix:

```text
tenant/{tenantId}/venue/{venueId}/resource/{resourceId}/session/{sessionId}/replay/{mediaId}/
```

## Deletion and reconciliation

- Delete requests mark metadata `deletion_pending` and enqueue `media.delete.v1`.
- Workers retry object deletion until metadata reaches `deleted`.
- Reconciliation detects:
  - stale `pending_upload`
  - `ready` metadata with missing objects
  - `deletion_pending` leftovers
  - unexpected bucket objects under a tenant prefix

Storage outages must leave retryable metadata and must not affect booking or payment truth.

## Logging

- Redact presigned URLs, object keys, and checksums from info-level logs.
- Never log access keys, secret keys, or raw provider credentials.

## Rollback

- Disable the `private_media` tenant feature flag.
- Keep metadata rows for later reconciliation.
- Legacy replay URLs remain explicit external assets until migrated and verified.
