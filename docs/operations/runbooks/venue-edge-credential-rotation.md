# VenueEdge credential rotation

Use when rotating the PlayTT device secret or replacing a venue PC.

## Device secret rotation

1. Issue rotation from `/nvr` installation actions.
2. Confirm the agent acknowledges the new credential before revoking the retiring secret.
3. Audit the rotation event and verify heartbeat resumes.

## NVR credential rotation

1. Change the password on the NVR locally.
2. Update the credential only through the venue setup host.
3. Republish configuration without sending secrets to the cloud.

## Replacement PC

1. Create a replace-host pairing session from `/nvr`.
2. Install VenueEdge on the replacement PC and enroll with the pairing code.
3. Verify commissioning snapshot and config application on the new installation.
