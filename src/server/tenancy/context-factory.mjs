import { PLAYTT_TENANT_ID } from "./constants.ts"
import { TenancyError } from "./errors.ts"

export function createServiceTenantContext(input) {
  return {
    tenantId: input.tenantId,
    actor: {
      type: "service",
      id: input.actorId ?? "service",
    },
    correlationId: input.correlationId,
  }
}

export function resolvePlayTtPublicContext(input) {
  return {
    tenantId: PLAYTT_TENANT_ID,
    actor: {
      type: "service",
      id: "public-catalog",
    },
    correlationId: input.correlationId,
  }
}

export function resolveTenantContextForDevice() {
  throw new TenancyError(
    "DEVICE_CONTEXT_UNSUPPORTED",
    "Device tenant context is not available until access hardware is wired.",
  )
}
