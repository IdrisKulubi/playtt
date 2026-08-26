import { and, asc, desc, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  accessCredentials,
  accessGrants,
  accessPoints,
  bookings,
} from "@/db/schema"
import { AccessDomainError } from "@/server/access/domain-error"
import {
  accessGrantSecretAad,
  decryptCredentialSecret,
} from "@/server/access/encryption"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import type { TenantContext } from "@/server/tenancy/types"

export interface PlayerBookingAccess {
  bookingId: string
  status:
    | "configuring"
    | "ready"
    | "temporarily_unavailable"
    | "action_required"
    | "revoking"
    | "revoked"
    | "expired"
    | "not_eligible"
  doors: Array<{
    accessPointId: string
    name: string
    kind: "entrance" | "hall" | "resource"
    sortOrder: number
  }>
  validFrom: string | null
  validUntil: string | null
  revealable: boolean
  supportMessage: string | null
  updatedAt: string
}

function supportMessage(status: PlayerBookingAccess["status"]) {
  if (status === "temporarily_unavailable") {
    return "We are retrying your venue access setup. Your booking remains confirmed."
  }
  if (status === "action_required") {
    return "Venue support is preparing a safe access alternative."
  }
  return null
}

export async function getBookingAccessStatus(
  context: TenantContext,
  input: { userId: string; bookingId: string },
): Promise<PlayerBookingAccess> {
  authorize(context, "access.read")

  const [booking] = await db
    .select({ id: bookings.id, updatedAt: bookings.updatedAt })
    .from(bookings)
    .where(
      and(
        eq(bookings.tenantId, context.tenantId),
        eq(bookings.id, input.bookingId),
        eq(bookings.userId, input.userId),
      ),
    )
    .limit(1)

  if (!booking) {
    throw new AccessDomainError("ACCESS_NOT_FOUND", "Booking was not found.", 404)
  }

  const [grant] = await db
    .select()
    .from(accessGrants)
    .where(
      and(
        eq(accessGrants.tenantId, context.tenantId),
        eq(accessGrants.bookingId, input.bookingId),
        eq(accessGrants.ownerUserId, input.userId),
      ),
    )
    .orderBy(desc(accessGrants.createdAt))
    .limit(1)

  if (!grant) {
    return {
      bookingId: input.bookingId,
      status: "not_eligible",
      doors: [],
      validFrom: null,
      validUntil: null,
      revealable: false,
      supportMessage: null,
      updatedAt: booking.updatedAt.toISOString(),
    }
  }

  const rows = await db
    .select({
      accessPointId: accessPoints.id,
      name: accessPoints.name,
      kind: accessPoints.kind,
      sortOrder: accessPoints.sortOrder,
    })
    .from(accessCredentials)
    .innerJoin(
      accessPoints,
      and(
        eq(accessCredentials.accessPointId, accessPoints.id),
        eq(accessCredentials.tenantId, accessPoints.tenantId),
      ),
    )
    .where(
      and(
        eq(accessCredentials.tenantId, context.tenantId),
        eq(accessCredentials.grantId, grant.id),
      ),
    )
    .orderBy(asc(accessPoints.sortOrder), asc(accessPoints.name))

  const status = grant.status === "failed" ? "action_required" : grant.status
  return {
    bookingId: input.bookingId,
    status,
    doors: rows,
    validFrom: grant.validFrom.toISOString(),
    validUntil: grant.validUntil.toISOString(),
    revealable: status === "ready" && Boolean(grant.revealReadyAt),
    supportMessage: supportMessage(status),
    updatedAt: grant.updatedAt.toISOString(),
  }
}

export async function revealBookingAccessCode(
  context: TenantContext,
  input: { userId: string; bookingId: string },
) {
  const status = await getBookingAccessStatus(context, input)
  if (!status.revealable || status.status !== "ready") {
    throw new AccessDomainError(
      "ACCESS_NOT_READY",
      "The booking access code is not ready to reveal.",
      409,
    )
  }

  const [grant] = await db
    .select({ id: accessGrants.id, encryptedCode: accessGrants.encryptedCode })
    .from(accessGrants)
    .where(
      and(
        eq(accessGrants.tenantId, context.tenantId),
        eq(accessGrants.bookingId, input.bookingId),
        eq(accessGrants.ownerUserId, input.userId),
        eq(accessGrants.status, "ready"),
      ),
    )
    .limit(1)

  if (!grant) {
    throw new AccessDomainError("ACCESS_NOT_READY", "Access is not ready.", 409)
  }

  return {
    code: decryptCredentialSecret(
      grant.encryptedCode,
      accessGrantSecretAad(context.tenantId, grant.id),
    ),
    validFrom: status.validFrom!,
    validUntil: status.validUntil!,
  }
}
