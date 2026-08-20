import {
  attachExistingUserAsMember,
  getMemberById,
  listMembers,
  updateMemberMembership,
  updateMemberProfile,
  type AdminMember,
  type AdminMemberRole,
  type AdminSkillLevel,
} from "@/server/admin/members-repository"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import { writeAuditLog } from "@/server/tenancy/audit-log.mjs"
import { TenancyError } from "@/server/tenancy/errors"
import type { TenantContext } from "@/server/tenancy/types"

export type { AdminMember, AdminMemberRole, AdminSkillLevel }

export async function listMembersForAdmin(
  context: TenantContext,
  query?: string,
): Promise<AdminMember[]> {
  authorize(context, "membership.read")
  return listMembers(context, query)
}

export async function getMemberForAdmin(
  context: TenantContext,
  membershipId: string,
): Promise<AdminMember | null> {
  authorize(context, "membership.read")
  return getMemberById(context, membershipId)
}

export async function updateMemberProfileForAdmin(
  context: TenantContext,
  input: {
    membershipId: string
    name?: string
    phone?: string | null
    skillLevel?: AdminSkillLevel
    defaultLocationId?: string | null
  },
) {
  authorize(context, "membership.manage")

  const updated = await updateMemberProfile(context, input)

  await writeAuditLog(context, {
    action: "membership.profile.update",
    targetType: "tenant_membership",
    targetId: input.membershipId,
    metadata: input,
  })

  return updated
}

export async function updateMemberMembershipForAdmin(
  context: TenantContext,
  actorUserId: string,
  input: {
    membershipId: string
    role?: AdminMemberRole
    status?: "active" | "disabled"
  },
) {
  authorize(context, "membership.manage")

  const member = await getMemberById(context, input.membershipId)

  if (!member) {
    throw new TenancyError("FORBIDDEN_ACTION", "Member not found.")
  }

  if (
    member.userId === actorUserId &&
    input.role &&
    input.role !== "owner" &&
    member.role === "owner"
  ) {
    throw new TenancyError(
      "FORBIDDEN_ACTION",
      "You cannot demote your own owner membership.",
    )
  }

  const updated = await updateMemberMembership(context, input)

  await writeAuditLog(context, {
    action: "membership.update",
    targetType: "tenant_membership",
    targetId: input.membershipId,
    metadata: input,
  })

  return updated
}

export async function addMemberForAdmin(
  context: TenantContext,
  input: { email: string; role?: AdminMemberRole },
) {
  authorize(context, "membership.manage")

  const created = await attachExistingUserAsMember(context, input)

  await writeAuditLog(context, {
    action: "membership.create",
    targetType: "tenant_membership",
    targetId: created?.id ?? null,
    metadata: input,
  })

  return created
}
