import { TenancyError } from "./errors.ts"

export function rejectClientTenantId(clientTenantId) {
  if (clientTenantId) {
    throw new TenancyError(
      "FORBIDDEN_TENANT",
      "Client-supplied tenant identifiers are not trusted.",
    )
  }
}

export function mapMembershipToTenantContext(input) {
  if (input.status !== "active") {
    throw new TenancyError(
      "MEMBERSHIP_DISABLED",
      "This PlayTT membership is disabled.",
    )
  }

  return {
    tenantId: input.tenantId,
    actor: {
      type: "user",
      id: input.userId,
    },
    membershipId: input.membershipId,
    role: input.role,
    correlationId: input.correlationId,
  }
}
