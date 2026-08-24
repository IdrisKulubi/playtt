# Venue network certification

Use when venue WAN, VLAN segmentation, or edge reachability is in question.

## Scope

P7-04 requires physical network gear. Software can only infer WAN health from venue edge heartbeats on **Admin → Health**.

## Check

1. Open **Admin → Health** and review the venue **Internet / WAN** dimension.
2. Confirm venue edge heartbeat is recent on **Admin → Devices**.
3. Verify camera and IoT subnets are not routed to guest Wi-Fi.

## Pilot venue tasks

1. Document VLANs for management, cameras, IoT, displays, staff, and guest traffic.
2. Block guest/IoT access to camera and management networks outside approved paths.
3. Remove hard-coded infrastructure IPs from device assignments; use DHCP/DNS/registry discovery.
4. Measure switch, WAN, NVR/edge, camera, and device capacity under ten concurrent resources.

## Recover

1. Restore venue edge connectivity (see `venue-edge-offline.md`).
2. Fail over to documented manual booking/payment-only mode if WAN is down.
3. Re-register devices after network changes.

## Verify

- Venue edge heartbeat returns online.
- Camera recording remains local during WAN outage.
- Network isolation tests pass at the pilot venue with attached evidence.
