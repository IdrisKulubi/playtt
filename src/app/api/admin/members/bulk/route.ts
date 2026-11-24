import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import {
  bulkUpdateMembersForAdmin,
  deleteMembersForAdmin,
  MAX_BULK_MEMBERS,
} from "@/server/admin/members-service"
import { resolveAdminApiContext } from "@/server/admin/api-context"
import { mapOperatorError, operatorJson } from "@/server/operator/http"

const membershipIds = z.array(z.string().uuid()).min(1).max(MAX_BULK_MEMBERS)

const bulkSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete"), membershipIds }),
  z.object({ action: z.literal("disable"), membershipIds }),
  z.object({ action: z.literal("enable"), membershipIds }),
  z.object({
    action: z.literal("set_role"),
    membershipIds,
    role: z.enum(["customer", "operator", "owner", "support"]),
  }),
])

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved

    const body = bulkSchema.parse(await req.json())
    const ids = [...new Set(body.membershipIds)]

    const result =
      body.action === "delete"
        ? await deleteMembersForAdmin(resolved.context, resolved.userId, ids)
        : await bulkUpdateMembersForAdmin(
            resolved.context,
            resolved.userId,
            ids,
            body.action === "set_role"
              ? { role: body.role }
              : { status: body.action === "disable" ? "disabled" : "active" },
          )

    return operatorJson(result)
  } catch (error) {
    return mapOperatorError(error)
  }
}
