import { type NextRequest } from "next/server"

import { runBookingExpirySweep } from "@/server/payments/service"

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get("authorization")

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 })
    }
  }

  const expiredCount = await runBookingExpirySweep()

  return Response.json({ expiredCount })
}
