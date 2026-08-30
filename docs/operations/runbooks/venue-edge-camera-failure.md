# VenueEdge camera failure

Use when one or more camera sources are unhealthy but the edge host remains online.

## Check

1. Open `/nvr` installation detail and review source health counts.
2. Confirm whether failover routes exist for affected resources.

## Recover

1. Run a local camera test from the venue setup host.
2. Disable the failed primary source and promote the configured fallback route.
3. Republish configuration if cloud topology changed.

## Verify

- Source health returns to healthy for the active route.
- A capture test succeeds for the affected resource.
