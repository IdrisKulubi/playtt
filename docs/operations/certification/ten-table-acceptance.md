# Ten-table acceptance

Physical acceptance checklist for ten concurrent resources at one venue.

## Configuration

1. Configure ten resources without code forks through the operator catalog.
2. Assign cameras, devices, and access points per resource.
3. Enable replay and realtime for each resource.

## Concurrency tests

1. Run concurrent sessions on multiple tables.
2. Verify scoring, access, devices, realtime, and replay remain isolated per resource.
3. Induce one device/provider failure and confirm other resources continue.

## Multi-tenant extension

1. Run two tenants with reusable human codes.
2. Prove complete data and provider isolation across tenants.
3. Configure a second resource type through data only.

## Evidence

- Load test metrics from edge heartbeat and replay queue depth.
- Cross-tenant negative test output from `pnpm test:tenant-rbac`.
- Operator recovery notes for induced failures.

## Sign-off

Requires stable observation window and owner approval in `docs/operations/rollout-checklist.md`.
