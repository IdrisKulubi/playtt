import { and, count, eq, ilike, or, sql } from "drizzle-orm"

import db from "@/db/drizzle"
import { session, tenantMemberships, user } from "@/db/schema"
import type {
  tenantMembershipRoleEnum,
  tenantMembershipStatusEnum,
  userSkillLevelEnum,
} from "@/db/schema"
import { TenancyError } from "@/server/tenancy/errors"
import type { TenantContext } from "@/server/tenancy/types"

export type AdminMemberRole = (typeof tenantMembershipRoleEnum.enumValues)[number]
export type AdminMemberStatus =
  (typeof tenantMembershipStatusEnum.enumValues)[number]
export type AdminSkillLevel = (typeof userSkillLevelEnum.enumValues)[number]

export interface AdminMember {
  id: string
  tenantId: string
  userId: string
  role: AdminMemberRole
  status: AdminMemberStatus
  email: string
  name: string
  phone: string | null
  skillLevel: AdminSkillLevel
  defaultLocationId: string | null
  createdAt: string
  updatedAt: string
}

function mapMember(row: {
  membership: typeof tenantMemberships.$inferSelect
  email: string
  name: string
  phone: string | null
  skillLevel: AdminSkillLevel
  defaultLocationId: string | null
}): AdminMember {
  return {
    id: row.membership.id,
    tenantId: row.membership.tenantId,
    userId: row.membership.userId,
    role: row.membership.role,
    status: row.membership.status,
    email: row.email,
    name: row.name,
    phone: row.phone,
    skillLevel: row.skillLevel,
    defaultLocationId: row.defaultLocationId,
    createdAt: row.membership.createdAt.toISOString(),
    updatedAt: row.membership.updatedAt.toISOString(),
  }
}

export async function listMembers(
  context: TenantContext,
  query?: string,
): Promise<AdminMember[]> {
  const conditions = [eq(tenantMemberships.tenantId, context.tenantId)]

  if (query?.trim()) {
    const pattern = `%${query.trim()}%`
    conditions.push(
      or(ilike(user.name, pattern), ilike(user.email, pattern), ilike(user.phone, pattern))!,
    )
  }

  const rows = await db
    .select({
      membership: tenantMemberships,
      email: user.email,
      name: user.name,
      phone: user.phone,
      skillLevel: user.skillLevel,
      defaultLocationId: user.defaultLocationId,
    })
    .from(tenantMemberships)
    .innerJoin(user, eq(tenantMemberships.userId, user.id))
    .where(and(...conditions))
    .orderBy(user.name, user.email)

  return rows.map(mapMember)
}

export async function getMemberById(
  context: TenantContext,
  membershipId: string,
): Promise<AdminMember | null> {
  const [row] = await db
    .select({
      membership: tenantMemberships,
      email: user.email,
      name: user.name,
      phone: user.phone,
      skillLevel: user.skillLevel,
      defaultLocationId: user.defaultLocationId,
    })
    .from(tenantMemberships)
    .innerJoin(user, eq(tenantMemberships.userId, user.id))
    .where(
      and(
        eq(tenantMemberships.id, membershipId),
        eq(tenantMemberships.tenantId, context.tenantId),
      ),
    )
    .limit(1)

  return row ? mapMember(row) : null
}

export async function updateMemberProfile(
  context: TenantContext,
  input: {
    membershipId: string
    name?: string
    phone?: string | null
    skillLevel?: AdminSkillLevel
    defaultLocationId?: string | null
  },
) {
  const member = await getMemberById(context, input.membershipId)

  if (!member) {
    throw new TenancyError("FORBIDDEN_ACTION", "Member not found.")
  }

  const userPatch: Partial<typeof user.$inferInsert> = {}
  if (input.name !== undefined) userPatch.name = input.name.trim()
  if (input.phone !== undefined) userPatch.phone = input.phone
  if (input.skillLevel !== undefined) userPatch.skillLevel = input.skillLevel
  if (input.defaultLocationId !== undefined) {
    userPatch.defaultLocationId = input.defaultLocationId
  }

  if (Object.keys(userPatch).length > 0) {
    await db.update(user).set(userPatch).where(eq(user.id, member.userId))
  }

  return getMemberById(context, input.membershipId)
}

export async function updateMemberMembership(
  context: TenantContext,
  input: {
    membershipId: string
    role?: AdminMemberRole
    status?: AdminMemberStatus
  },
) {
  const member = await getMemberById(context, input.membershipId)

  if (!member) {
    throw new TenancyError("FORBIDDEN_ACTION", "Member not found.")
  }

  if (input.role === "owner") {
    const [ownerCount] = await db
      .select({ value: count() })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, context.tenantId),
          eq(tenantMemberships.role, "owner"),
          eq(tenantMemberships.status, "active"),
        ),
      )

    if (
      member.role === "owner" &&
      input.status === "disabled" &&
      Number(ownerCount?.value ?? 0) <= 1
    ) {
      throw new TenancyError(
        "FORBIDDEN_ACTION",
        "Cannot disable the last active owner.",
      )
    }
  }

  const patch: Partial<typeof tenantMemberships.$inferInsert> = {}
  if (input.role !== undefined) patch.role = input.role
  if (input.status !== undefined) patch.status = input.status

  await db
    .update(tenantMemberships)
    .set(patch)
    .where(
      and(
        eq(tenantMemberships.id, input.membershipId),
        eq(tenantMemberships.tenantId, context.tenantId),
      ),
    )

  if (input.status === "disabled") {
    await revokeUserSessions(member.userId)
  }

  return getMemberById(context, input.membershipId)
}

export async function attachExistingUserAsMember(
  context: TenantContext,
  input: { email: string; role?: AdminMemberRole },
) {
  const normalizedEmail = input.email.trim().toLowerCase()

  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(sql`lower(${user.email})`, normalizedEmail))
    .limit(1)

  if (!existingUser) {
    throw new TenancyError(
      "FORBIDDEN_ACTION",
      "No user account exists for that email. Ask them to sign up first.",
    )
  }

  const [membership] = await db
    .insert(tenantMemberships)
    .values({
      tenantId: context.tenantId,
      userId: existingUser.id,
      role: input.role ?? "customer",
      status: "active",
    })
    .onConflictDoUpdate({
      target: [tenantMemberships.tenantId, tenantMemberships.userId],
      set: {
        status: "active",
        role: input.role ?? "customer",
      },
    })
    .returning()

  return getMemberById(context, membership.id)
}

export async function countActiveOwners(context: TenantContext): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.tenantId, context.tenantId),
        eq(tenantMemberships.role, "owner"),
        eq(tenantMemberships.status, "active"),
      ),
    )

  return Number(row?.value ?? 0)
}

async function revokeUserSessions(userId: string) {
  await db.delete(session).where(eq(session.userId, userId))
}
