import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { requireDeviceRequest } from "@/server/devices/auth"
import { deviceJson, mapDeviceError } from "@/server/devices/http"
import {
  assertCommissioningReportChecksum,
  publishVenueEdgeCommissioning,
} from "@/server/replays/venue-edge-commissioning"

const boundedText = (max: number) => z.string().trim().min(1).max(max)
const nullableBoundedText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    boundedText(max).nullable(),
  )
const optionalBoundedText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    boundedText(max).optional(),
  )
const timestamp = z.string().max(50).datetime()
const probeCheckSchema = z
  .object({
    check: boundedText(120),
    passed: z.boolean(),
    code: optionalBoundedText(120),
    message: boundedText(1_000),
  })
  .strict()
const nvrTestSchema = z
  .object({
    passed: z.boolean(),
    testedAt: timestamp,
    timeMode: z.enum(["z", "l", "unknown"]),
    checks: z.array(probeCheckSchema).max(32),
  })
  .strict()
const cameraTestSchema = z
  .object({
    passed: z.boolean(),
    testedAt: timestamp,
    checks: z.array(probeCheckSchema).max(32),
  })
  .strict()

const commissioningSchema = z
  .object({
    commissioned: z.boolean(),
    publishedAt: timestamp,
    reportVersion: z.number().int().positive().optional(),
    reportChecksumSha256: z
      .string()
      .length(64)
      .regex(/^[a-f0-9]+$/i)
      .optional(),
    nvrs: z
      .array(
        z
          .object({
            id: boundedText(160),
            label: boundedText(160),
            vendor: z.enum(["vigi"]),
            host: boundedText(253),
            rtspPort: z.number().int().min(1).max(65_535),
            playbackPort: z.number().int().min(1).max(65_535).nullable(),
            username: boundedText(160),
            localConnectionKey: boundedText(240),
            enabled: z.boolean(),
            testChannelKey: boundedText(120),
            timeMode: z.enum(["z", "l", "unknown"]),
            lastTest: nvrTestSchema.nullable(),
          })
          .strict(),
      )
      .max(32),
    cameras: z
      .array(
        z
          .object({
            id: boundedText(160),
            nvrId: boundedText(160),
            label: boundedText(160),
            channelKey: boundedText(120),
            streamProfile: boundedText(80),
            codec: z.enum(["h264", "h265", "unknown"]),
            enabled: z.boolean(),
            lastTest: cameraTestSchema.nullable(),
            healthStatus: z
              .enum(["unknown", "healthy", "degraded", "unhealthy", "disabled"])
              .nullable(),
          })
          .strict(),
      )
      .max(256),
    resourcePolicies: z
      .array(
        z
          .object({
            resourceId: boundedText(160),
            label: boundedText(160),
            selectionMode: z.enum(["automatic", "manual"]),
            manualSourceId: nullableBoundedText(160),
            failureThreshold: z.number().int().min(1).max(100),
            cooldownSeconds: z.number().int().min(0).max(86_400),
            healthyThreshold: z.number().int().min(1).max(100),
            autoFailback: z.boolean(),
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .strict(),
      )
      .max(256),
    resourceRoutes: z
      .array(
        z
          .object({
            resourceId: boundedText(160),
            cameraId: boundedText(160),
            priority: z.number().int().min(1).max(1_024),
            captureModes: z
              .array(z.enum(["edge_buffer", "nvr_playback"]))
              .min(1)
              .max(2),
            enabled: z.boolean(),
          })
          .strict(),
      )
      .max(1_024),
    sourceHealth: z
      .array(
        z
          .object({
            scope: z.enum(["recorder", "source"]),
            recorderId: boundedText(160),
            sourceId: nullableBoundedText(160),
            status: z.enum([
              "unknown",
              "healthy",
              "degraded",
              "unhealthy",
              "disabled",
            ]),
            reasonCode: nullableBoundedText(160),
            observedAt: timestamp,
          })
          .strict(),
      )
      .max(1_024),
  })
  .strict()

export async function POST(req: NextRequest) {
  try {
    const auth = await requireDeviceRequest(req)
    const raw = await req.json()
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("Commissioning payload must be an object.")
    }
    const rawPayload = raw as Record<string, unknown>
    assertCommissioningReportChecksum(rawPayload)
    const body = commissioningSchema.parse(rawPayload)

    const result = await publishVenueEdgeCommissioning({
      tenantId: auth.device.tenantId,
      locationId: auth.device.locationId,
      deviceId: auth.device.id,
      deviceType: auth.device.type,
      payload: body,
      auditContext: auth.context,
    })

    return deviceJson(result)
  } catch (error) {
    return mapDeviceError(error)
  }
}
