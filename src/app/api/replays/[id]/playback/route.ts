import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import { authenticateDeviceRequest } from "@/server/devices/auth"
import { mapDeviceError } from "@/server/devices/http"
import {
  mapReplayServiceError,
  replayError,
  replayJson,
} from "@/server/replays/http"
import { getReplayPlaybackGrant } from "@/server/replays/playback"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const session = await getSessionWithBearerFallback(req)
    const deviceAuth = session ? null : await authenticateDeviceRequest(req)

    if (!session && !deviceAuth) {
      return replayError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      })
    }

    if (session) {
      const tenantContext = await resolveTenantContextForSessionUser(
        session.user.id,
        req.headers.get("x-tenant-id"),
      )
      const playback = await getReplayPlaybackGrant({
        context: tenantContext,
        replayId: id,
        userId: session.user.id,
      })

      return replayJson({ playback })
    }

    const playback = await getReplayPlaybackGrant({
      context: deviceAuth!.context,
      replayId: id,
      deviceId: deviceAuth!.device.id,
    })

    return replayJson({ playback })
  } catch (error) {
    if (error instanceof Error && error.name === "ReplayServiceError") {
      return mapReplayServiceError(error)
    }

    if (error instanceof Error && error.name === "DeviceError") {
      return mapDeviceError(error)
    }

    return mapReplayServiceError(error)
  }
}
