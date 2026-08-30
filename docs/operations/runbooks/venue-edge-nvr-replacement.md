# VenueEdge NVR replacement

Use when a recorder is offline, replaced, or credentials changed.

## Check

1. Identify the affected NVR in `/nvr` topology and source health.
2. Confirm other NVRs and resources remain healthy.

## Recover

1. Update the local NVR endpoint on the venue PC setup host.
2. Rotate the NVR credential locally; never paste passwords into cloud forms.
3. Re-map affected cameras and republish configuration.
4. Run commissioning tests for impacted resources.

## Verify

- NVR reachability and auth health recover in heartbeat metrics.
- Replay requests use the updated recorder without cross-resource leakage.
