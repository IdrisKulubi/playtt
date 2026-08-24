# R2 storage health recovery

Use when R2 credentials are configured but the bucket probe fails.

## Check

1. Open **Admin → Health** and confirm the R2 storage dimension is **Down**.
2. Verify `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET`.
3. Run `pnpm test:r2` locally with the same credentials if safe.

## Diagnose

- Bucket deleted or renamed.
- API token revoked or lacks `HeadBucket` permission.
- Cloudflare R2 regional outage.

## Recover

1. Restore or recreate the bucket with the expected name.
2. Issue new R2 API credentials and update hosted env vars.
3. Retry failed replay uploads from the venue operator panel.

## Verify

- R2 probe shows **reachable** on **Admin → Health**.
- `pnpm test:r2` and `pnpm test:media-flow` pass against staging credentials.
