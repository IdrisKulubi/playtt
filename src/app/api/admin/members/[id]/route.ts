import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import {
  updateMemberMembershipForAdmin,
  updateMemberProfileForAdmin,
} from "@/server/admin/members-service"
import {
  mapOperatorError,
  operatorJson,
} from "@/server/operator/http"
import { resolveAdminApiContext } from "@/server/admin/api-context"

const patchMemberSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  skillLevel: z.enum(["beginner", "intermediate", "pro"]).optional(),
  defaultLocationId: z.string().uuid().nullable().optional(),
  role: z.enum(["customer", "operator", "owner", "support"]).optional(),
  status: z.enum(["active", "disabled"]).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved

    const { id: membershipId } = await params
    const body = patchMemberSchema.parse(await req.json())

    const profilePatch = {
      membershipId,
      name: body.name,
      phone: body.phone,
      skillLevel: body.skillLevel,
      defaultLocationId: body.defaultLocationId,
    }

    const hasProfilePatch = Object.entries(profilePatch).some(
      ([key, value]) => key !== "membershipId" && value !== undefined,
    )

    let member = null

    if (hasProfilePatch) {
      member = await updateMemberProfileForAdmin(resolved.context, profilePatch)
    }

    if (body.role !== undefined || body.status !== undefined) {
      member = await updateMemberMembershipForAdmin(
        resolved.context,
        resolved.userId,
        {
          membershipId,
          role: body.role,
          status: body.status,
        },
      )
    }

    return operatorJson(member)
  } catch (error) {
    return mapOperatorError(error)
  }
}
