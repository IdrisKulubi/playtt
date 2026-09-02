import { createHash, timingSafeEqual } from "node:crypto"
import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { DeviceError } from "@/server/devices/errors"
import { mapOperatorDeviceError } from "@/server/devices/operator-context"
import { operatorJson } from "@/server/operator/http"
import {
  registerVenueEdgeInstaller,
  withdrawVenueEdgeInstaller,
} from "@/server/replays/venue-edge-installer-registration"

const registrationBaseSchema = z.object({
  version: z.string().trim().min(1).max(64),
  objectKey: z.string().trim().min(1).max(1024),
  fileName: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]+\.exe$/)
    .optional(),
  sha256: z
    .string()
    .trim()
    .regex(/^[a-fA-F0-9]{64}$/),
  sizeBytes: z.number().int().positive(),
  signed: z.boolean(),
  signaturePublisher: z.string().trim().min(1).max(256).nullable().optional(),
  releaseNotes: z.string().trim().max(2_000).nullable().optional(),
  minimumWindowsVersion: z.string().trim().min(1).max(32).optional(),
})

const registrationSchema = z.discriminatedUnion("channel", [
  registrationBaseSchema.extend({
    channel: z.literal("pilot"),
    pilotLocationIds: z.array(z.string().uuid()).min(1).max(100),
    targetTenantIds: z.array(z.string().uuid()).max(0).optional(),
  }),
  registrationBaseSchema.extend({
    channel: z.literal("stable"),
    targetTenantIds: z.array(z.string().uuid()).min(1).max(100),
    pilotLocationIds: z.array(z.string().uuid()).max(0).optional(),
  }),
])

const withdrawalSchema = z.object({
  tenantId: z.string().uuid(),
  releaseId: z.string().uuid(),
  status: z.literal("withdrawn"),
})

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest()
}

function assertRegistrationToken(req: NextRequest) {
  const expected = process.env.VENUE_EDGE_RELEASE_REGISTRATION_TOKEN?.trim()
  if (!expected) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Installer release registration is not configured.",
      503
    )
  }
  const authorization = req.headers.get("authorization") ?? ""
  const provided = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : ""
  if (!provided || !timingSafeEqual(digest(provided), digest(expected))) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "A valid release registration token is required.",
      401
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    assertRegistrationToken(req)
    const input = registrationSchema.parse(await req.json())
    const fileName =
      input.fileName ?? input.objectKey.split("/").at(-1)?.trim() ?? ""
    if (!/^[a-zA-Z0-9._-]+\.exe$/.test(fileName)) {
      throw new DeviceError(
        "VALIDATION_ERROR",
        "The artifact object key must end with a safe .exe filename.",
        400
      )
    }
    const releases = await registerVenueEdgeInstaller({ ...input, fileName })
    return operatorJson({ releases }, 201)
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    assertRegistrationToken(req)
    const input = withdrawalSchema.parse(await req.json())
    const release = await withdrawVenueEdgeInstaller(input)
    return operatorJson({ release })
  } catch (error) {
    return mapOperatorDeviceError(error)
  }
}
