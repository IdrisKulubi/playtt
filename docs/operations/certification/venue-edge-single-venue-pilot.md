# VenueEdge single-venue pilot

Physical acceptance checklist for the first supported Windows venue PC and validated VIGI NVR.

Use this document after software gates pass:

```bash
pnpm certify:phase8
pnpm test:replay-edge
```

## Prerequisites

| Item | Why |
| --- | --- |
| Supported Windows 10 22H2+ or Windows 11 23H2+ x64 PC | Phase 1 installer baseline |
| One validated TP-Link VIGI NVR on the venue LAN | Phase 1 NVR baseline |
| Laptop on the same LAN as the NVR | RTSP stays local |
| PlayTT staging or pilot cloud tenant with `/nvr` access | Pairing and fleet visibility |
| VenueEdge agent installed on the venue PC | Unpackaged dev build is acceptable for this pilot; signed `Setup.exe` remains a P8-05 dependency |

## Related docs

- RTSP walkthrough: [vigi-nvr-pilot-walkthrough.md](../../hardware/vigi-nvr-pilot-walkthrough.md)
- Pass criteria and pilot report template: [vigi-nvr-pilot-checklist.md](../../hardware/vigi-nvr-pilot-checklist.md)
- Fleet operations: [venue-edge-offline.md](../runbooks/venue-edge-offline.md)

## Commissioning steps

1. Pair the venue PC through `/nvr` and confirm the installation appears healthy in the fleet panel.
2. Complete local setup: add the NVR, discover or add the table camera, map the camera to the PlayTT resource, and run commissioning tests.
3. Publish desired config from `/nvr` and confirm the edge acknowledges the revision.
4. Run the VIGI RTSP walkthrough for the commissioned camera:
   - Live stream is H.264 and stable.
   - Playback URL returns a 15-second slice at the expected wall-clock window.
   - NVR clock skew is within the commissioning tolerance.
5. Request an authenticated replay from the player or operator surface for the commissioned resource.
6. Confirm the replay becomes ready and plays back only for authorized owners.

## Privacy and storage checks

1. Confirm continuous RTSP never leaves the venue LAN.
2. Confirm only the requested replay clip appears in private object storage.
3. Confirm diagnostics/support bundles contain no NVR passwords, pairing codes, authenticated RTSP URLs, or upload grants.
4. Confirm unrelated resources and tenants cannot access the clip.

## Evidence to attach

- `pnpm certify:phase8` output (simulator baseline)
- Fleet screenshot showing healthy installation and selected source
- Redacted replay request timeline with ready latency
- VIGI pilot checklist section for the commissioned camera
- Object storage listing showing a single clip object for the request
- Operator sign-off in [rollout-checklist.md](../rollout-checklist.md)

## Sign-off

Do not mark P8-01 hardware complete until:

- Live stream, playback, codec, clock, and 15-second clip checks pass on physical hardware.
- Authenticated replay reaches private upload and authorized playback end to end.
- Privacy checks confirm clip-only cloud storage.

Signed stable `Setup.exe` publication remains part of P8-05 progressive release.
