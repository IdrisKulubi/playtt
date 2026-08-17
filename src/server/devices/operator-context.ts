import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { getSessionWithBearerFallback } from "@/lib/security"
import { isDeviceRegistryEnabledForTenant } from "@/server/devices/feature-policy"
import { DeviceError } from "@/server/devices/errors"
import { mapDeviceError } from "@/server/devices/http"
import { canAccessOperatorShell } from "@/server/operator/access.mjs"
import { isOperatorShellEnabledForTenant } from "@/server/operator/feature-policy"
import { mapOperatorError, operatorError } from "@/server/operator/http"
import { canPerformTenantAction } from "@/server/tenancy/permissions"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

export async function resolveOperatorDeviceWriteContext(req: NextRequest) {
  const session = await getSessionWithBearerFallback(req)

  if (!session) {
    return {
      error: operatorError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      }),
    } as const
  }

  const context = await resolveTenantContextForSessionUser(
    session.user.id,
    req.headers.get("x-tenant-id"),
  )

  if (!(await isOperatorShellEnabledForTenant(context))) {
    return {
      error: operatorError({
        code: "FORBIDDEN_ACTION",
        message: "Operator shell is not enabled for this tenant.",
        status: 403,
      }),
    } as const
  }

  if (!(await isDeviceRegistryEnabledForTenant(context))) {
    return {
      error: operatorError({
        code: "FORBIDDEN_ACTION",
        message: "Device registry is not enabled for this tenant.",
        status: 403,
      }),
    } as const
  }

  if (!canAccessOperatorShell(context.role)) {
    return {
      error: operatorError({
        code: "FORBIDDEN_ACTION",
        message: "You do not have permission to manage devices.",
        status: 403,
      }),
    } as const
  }

  if (!canPerformTenantAction(context.role, "venue.manage")) {
    return {
      error: operatorError({
        code: "FORBIDDEN_ACTION",
        message: "You do not have permission to manage devices.",
        status: 403,
      }),
    } as const
  }

  return { context } as const
}

export async function resolveOperatorDeviceReadContext(req: NextRequest) {
  const session = await getSessionWithBearerFallback(req)

  if (!session) {
    return {
      error: operatorError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      }),
    } as const
  }

  const context = await resolveTenantContextForSessionUser(
    session.user.id,
    req.headers.get("x-tenant-id"),
  )

  if (!(await isOperatorShellEnabledForTenant(context))) {
    return {
      error: operatorError({
        code: "FORBIDDEN_ACTION",
        message: "Operator shell is not enabled for this tenant.",
        status: 403,
      }),
    } as const
  }

  if (!(await isDeviceRegistryEnabledForTenant(context))) {
    return {
      error: operatorError({
        code: "FORBIDDEN_ACTION",
        message: "Device registry is not enabled for this tenant.",
        status: 403,
      }),
    } as const
  }

  if (!canAccessOperatorShell(context.role)) {
    return {
      error: operatorError({
        code: "FORBIDDEN_ACTION",
        message: "You do not have permission to view devices.",
        status: 403,
      }),
    } as const
  }

  if (!canPerformTenantAction(context.role, "venue.read")) {
    return {
      error: operatorError({
        code: "FORBIDDEN_ACTION",
        message: "You do not have permission to view devices.",
        status: 403,
      }),
    } as const
  }

  return { context } as const
}

export function mapOperatorDeviceError(error: unknown) {
  if (error instanceof DeviceError) {
    return mapDeviceError(error)
  }

  return mapOperatorError(error)
}
