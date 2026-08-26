import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod/v3"

import { accessAdminNoStoreHeaders } from "@/server/access/admin-contract"
import { resolveAccessAdminContext } from "@/server/access/admin-api-context"
import { commissionTtlockConnection } from "@/server/access/admin-service"
import { ACCESS_FEATURE_KEYS } from "@/server/access/feature-policy"
import { mapOperatorError } from "@/server/operator/http"

const commissionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  region: z.enum(["global", "eu"]),
  clientId: z.string().trim().min(1).max(200),
  clientSecret: z.string().min(1).max(1000),
  username: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(1000),
})

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveAccessAdminContext(req, {
      feature: ACCESS_FEATURE_KEYS.ttlockProvider,
    })
    if ("error" in resolved) return resolved.error

    const input = commissionSchema.parse(await req.json())
    const connection = await commissionTtlockConnection(resolved.context, input)

    // The service result is deliberately summarized so submitted credentials can
    // never be reflected into the response.
    return NextResponse.json(
      {
        data: {
          connection: {
            id: connection.id,
            name: connection.name,
            region: connection.region,
            status: connection.status,
            tokenHealth: connection.tokenHealth,
            lastSyncAt: connection.lastSyncAt,
          },
        },
      },
      { status: 201, headers: accessAdminNoStoreHeaders },
    )
  } catch (error) {
    return mapOperatorError(error)
  }
}
