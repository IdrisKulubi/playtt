import type { TenantContext } from "./types"
import {
  createServiceTenantContext as createServiceTenantContextImpl,
  resolvePlayTtPublicContext as resolvePlayTtPublicContextImpl,
  resolveTenantContextForDevice as resolveTenantContextForDeviceImpl,
} from "./context-factory.mjs"

export function createServiceTenantContext(input: {
  tenantId: string
  actorId?: string
  correlationId: string
}): TenantContext {
  return createServiceTenantContextImpl(input) as TenantContext
}

export function resolvePlayTtPublicContext(input: {
  correlationId: string
}): TenantContext {
  return resolvePlayTtPublicContextImpl(input) as TenantContext
}

export function resolveTenantContextForDevice(input: {
  deviceId: string
  tenantId: string
  correlationId: string
}): TenantContext {
  return resolveTenantContextForDeviceImpl(input) as TenantContext
}
