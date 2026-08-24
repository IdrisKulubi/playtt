# Device offline recovery

Use when one or more enrolled devices show offline or unknown heartbeat health.

## Check

1. Open **Admin → Devices** and filter to the affected venue.
2. Note device type, last heartbeat time, and assignment.

## Diagnose

- Power or network loss at the venue.
- Device secret rotated but edge firmware not updated.
- Device revoked or assignment ended.

## Recover

1. Confirm the device is powered and on the venue LAN.
2. Restart the venue edge service or ESP32 as appropriate.
3. Re-enroll or rotate credentials if heartbeats do not resume within the offline threshold.
4. Re-assign the device to the correct resource if misconfigured.

## Verify

- Device shows **online** in the devices panel.
- Venue health dimension **Devices** returns to healthy.
