import { TenancyError } from "./errors.ts"

export function rejectClientTenantId(clientTenantId) {
  if (clientTenantId) {
    throw new TenancyError(
      "FORBIDDEN_TENANT",
      "Client-supplied tenant identifiers are not trusted.",
    )
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function resolveRequestedTenantId(clientTenantId, defaultTenantId) {
  if (clientTenantId == null || clientTenantId.trim() === "") {
    return defaultTenantId
  }

  const tenantId = clientTenantId.trim()
  if (!UUID_PATTERN.test(tenantId)) {
    throw new TenancyError(
      "FORBIDDEN_TENANT",
      "The requested tenant identifier is invalid.",
    )
  }

  return tenantId
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
