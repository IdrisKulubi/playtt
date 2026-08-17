import { type NextRequest } from "next/server"

import { getDisplaySnapshotForResource } from "@/server/realtime/display-query"

type RouteContext = {
  params: Promise<{ resourceId: string }>
}

export async function GET(_req: NextRequest, routeContext: RouteContext) {
  const { resourceId } = await routeContext.params
  const snapshot = await getDisplaySnapshotForResource(resourceId)

  if (!snapshot) {
    return Response.json(
      {
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "We could not find that resource.",
        },
      },
      { status: 404 },
    )
  }

  return Response.json({ data: snapshot })
}
