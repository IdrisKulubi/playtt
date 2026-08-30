# VenueEdge update rollback

Use when a VenueEdge agent update failed, rolled back, or an unsupported version is reported.

## Check

1. Open `/nvr` and select the affected installation.
2. Review `updateStatus`, `desiredAgentVersion`, and `lastUpdateErrorCode`.
3. Generate a diagnostics bundle from the installation detail page.

## Recover

1. Pin the installation to the last known-good version or switch the channel to `stable`.
2. Use **Retry update** after confirming the release is published for the installation platform/architecture.
3. If rollback occurred, verify the agent heartbeat resumes and replay queue drains.
4. Revoke the bad release if multiple installations are affected.

## Verify

- `currentAgentVersion` matches the pinned or desired version.
- Update status returns to `idle`.
- Heartbeat metrics show healthy FFmpeg/buffer state.
