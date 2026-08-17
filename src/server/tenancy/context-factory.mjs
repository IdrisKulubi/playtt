import { PLAYTT_TENANT_ID } from "./constants.ts"

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

export function resolveTenantContextForDevice(input) {
  return {
    tenantId: input.tenantId,
    actor: {
      type: "device",
      id: input.deviceId,
    },
    correlationId: input.correlationId,
  }
}
