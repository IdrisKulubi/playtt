import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  attachAccessPointResourceForCatalog,
  detachAccessPointResourceForCatalog,
} from "@/server/catalog/access-points-service"
import { canAccessOperatorShell } from "@/server/operator/access.mjs"
import { isOperatorShellEnabledForTenant } from "@/server/operator/feature-policy"
import {
  mapOperatorError,
  operatorError,
  operatorJson,
} from "@/server/operator/http"
import { canPerformTenantAction } from "@/server/tenancy/permissions"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

const attachMappingSchema = z.object({
  accessPointId: z.string().uuid(),
  resourceId: z.string().uuid(),
  sortOrder: z.number().int().nonnegative().optional(),
})

const detachMappingSchema = z.object({
  accessPointId: z.string().uuid(),
  resourceId: z.string().uuid(),
})

async function resolveOperatorWriteContext(req: NextRequest) {
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

  if (!canAccessOperatorShell(context.role)) {
    return {
      error: operatorError({
        code: "FORBIDDEN_ACTION",
        message: "You do not have permission to manage the operator catalog.",
        status: 403,
      }),
    } as const
  }

  if (!canPerformTenantAction(context.role, "catalog.manage")) {
    return {
      error: operatorError({
        code: "FORBIDDEN_ACTION",
        message: "You do not have permission to manage access points.",
        status: 403,
      }),
    } as const
  }

  return { context } as const
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveOperatorWriteContext(req)
    if ("error" in resolved) {
      return resolved.error
    }

    const body = attachMappingSchema.parse(await req.json())
    const mapping = await attachAccessPointResourceForCatalog(
      resolved.context,
      body,
    )
    return operatorJson({ mapping }, 201)
  } catch (error) {
    return mapOperatorError(error)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const resolved = await resolveOperatorWriteContext(req)
    if ("error" in resolved) {
      return resolved.error
    }

    const body = detachMappingSchema.parse(await req.json())
    const detached = await detachAccessPointResourceForCatalog(
      resolved.context,
      body,
    )

    if (!detached) {
      return operatorError({
        code: "MAPPING_NOT_FOUND",
        message: "That access-point mapping was not found.",
        status: 404,
      })
    }

    return operatorJson({ detached: true })
  } catch (error) {
    return mapOperatorError(error)
  }
}
