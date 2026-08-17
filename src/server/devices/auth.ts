import type { NextRequest } from "next/server"

import { createCorrelationId } from "@/server/tenancy/correlation"
import { resolveTenantContextForDevice } from "@/server/tenancy/context-factory.mjs"
import { authenticateDeviceCredential } from "@/server/devices/devices"
import type { TenantContext } from "@/server/tenancy/types"

export type AuthenticatedDevice = {
  device: Awaited<ReturnType<typeof authenticateDeviceCredential>>["device"]
  credentialVersion: number
  context: TenantContext
}

function parseDeviceAuthorization(req: NextRequest) {
  const headerDeviceId = req.headers.get("x-playtt-device-id")
  const authorization = req.headers.get("authorization")

  if (authorization?.startsWith("Device ")) {
    const parts = authorization.slice("Device ".length).trim().split(/\s+/)
    if (parts.length >= 2) {
      return {
        deviceId: parts[0],
        secret: parts.slice(1).join(" "),
      }
    }
  }

  if (headerDeviceId && authorization?.startsWith("Secret ")) {
    return {
      deviceId: headerDeviceId,
      secret: authorization.slice("Secret ".length).trim(),
    }
  }

  return null
}

export async function authenticateDeviceRequest(
  req: NextRequest,
): Promise<AuthenticatedDevice | null> {
  const parsed = parseDeviceAuthorization(req)
  if (!parsed?.deviceId || !parsed.secret) {
    return null
  }

  const auth = await authenticateDeviceCredential({
    deviceId: parsed.deviceId,
    secret: parsed.secret,
  })

  const context = resolveTenantContextForDevice({
    deviceId: auth.device.id,
    tenantId: auth.device.tenantId,
    correlationId:
      req.headers.get("x-correlation-id") ?? createCorrelationId(),
  }) as TenantContext

  return {
    device: auth.device,
    credentialVersion: auth.credentialVersion,
    context,
  }
}

export async function requireDeviceRequest(
  req: NextRequest,
): Promise<AuthenticatedDevice> {
  const auth = await authenticateDeviceRequest(req)
  if (!auth) {
    const { DeviceError } = await import("@/server/devices/errors")
    throw new DeviceError(
      "DEVICE_UNAUTHENTICATED",
      "Device authentication is required.",
      401,
    )
  }

  return auth
}
