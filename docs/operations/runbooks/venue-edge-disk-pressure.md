# VenueEdge disk pressure

Use when heartbeat metrics report disk pressure or replay extraction fails with disk-related errors.

## Check

1. Open `/nvr` and review disk usage metrics on the installation.
2. Confirm replay queue depth and failed replay requests at the venue.

## Recover

1. Clear stale replay workspaces on the venue PC if local cleanup is enabled.
2. Reduce enabled camera buffers or increase reserved free disk on the edge host.
3. Retry failed replay requests after disk usage falls below the reserved floor.

## Verify

- Heartbeat `diskPressure` is false.
- New replay requests reach `ready`.
