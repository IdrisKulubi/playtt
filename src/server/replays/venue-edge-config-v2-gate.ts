import { DeviceError } from "@/server/devices/errors"
import { isVenueEdgeConfigV2EnabledForLocation } from "@/server/replays/feature-policy"

export async function assertVenueEdgeConfigV2Enabled(
  tenantId: string,
  locationId: string,
): Promise<void> {
  const enabled = await isVenueEdgeConfigV2EnabledForLocation(tenantId, locationId)

  if (!enabled) {
    throw new DeviceError(
      "DEVICE_FORBIDDEN",
      "VenueEdge configuration v2 is not enabled for this venue.",
      403,
    )
  }
}
