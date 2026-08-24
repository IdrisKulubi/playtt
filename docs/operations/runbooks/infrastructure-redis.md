# Redis health recovery

Use when `REDIS_URL` is configured but the live Redis probe fails.

## Check

1. Open **Admin → Health** and confirm the Redis dimension is **Down**.
2. Verify `REDIS_URL` in the hosted environment.
3. Check Redis provider dashboard for outages or connection limits.

## Diagnose

- Redis instance stopped or unreachable.
- Auth token rotated without updating environment variables.
- Memory eviction or connection saturation.

## Recover

1. Update `REDIS_URL` if credentials changed.
2. Restart or scale the Redis instance.
3. Redeploy the web app after env changes.

## Verify

- Redis probe shows **reachable** on **Admin → Health**.
- Display and realtime channels converge during an active session.
