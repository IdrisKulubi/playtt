import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import {
  addMemberForAdmin,
  listMembersForAdmin,
} from "@/server/admin/members-service"
import {
  mapOperatorError,
  operatorJson,
} from "@/server/operator/http"
import { resolveAdminApiContext } from "@/server/admin/api-context"

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["customer", "operator", "owner", "support"]).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved

    const query = req.nextUrl.searchParams.get("q") ?? undefined
    const members = await listMembersForAdmin(resolved.context, query)
    return operatorJson(members)
  } catch (error) {
    return mapOperatorError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveAdminApiContext(req)
    if ("status" in resolved) return resolved

    const body = addMemberSchema.parse(await req.json())
    const created = await addMemberForAdmin(resolved.context, body)
    return operatorJson(created, 201)
  } catch (error) {
    return mapOperatorError(error)
  }
}
