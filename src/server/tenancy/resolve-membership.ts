import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { tenantMemberships } from "@/db/schema"
import { PLAYTT_TENANT_ID } from "./constants"
import { TenancyError } from "./errors"
import {
  mapMembershipToTenantContext,
  rejectClientTenantId,
} from "./membership-context.mjs"
import type { TenantContext } from "./types"

export async function resolvePlayTtMembershipForUser(input: {
  userId: string
  correlationId: string
  clientTenantId?: string | null
}): Promise<TenantContext> {
  rejectClientTenantId(input.clientTenantId)

  const rows = await db
    .select({
      membershipId: tenantMemberships.id,
      tenantId: tenantMemberships.tenantId,
      role: tenantMemberships.role,
      status: tenantMemberships.status,
    })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.userId, input.userId),
        eq(tenantMemberships.tenantId, PLAYTT_TENANT_ID),
      ),
    )
    .limit(1)

  const membership = rows[0]

  if (!membership) {
    throw new TenancyError(
      "MEMBERSHIP_NOT_FOUND",
      "No PlayTT membership exists for this user.",
    )
  }

  return mapMembershipToTenantContext({
    userId: input.userId,
    membershipId: membership.membershipId,
    tenantId: membership.tenantId,
    role: membership.role,
    status: membership.status,
    correlationId: input.correlationId,
  }) as TenantContext
}
