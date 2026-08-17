import { type NextRequest } from "next/server"

import { runDurableWorkCycle } from "@/server/workers/run-durable-work"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get("authorization")

  if (process.env.NODE_ENV === "production" && !cronSecret) {
    console.error("[DURABLE WORK CRON] CRON_SECRET is not configured")
    return new Response("Service unavailable", { status: 503 })
  }

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 })
    }
  }

  const report = await runDurableWorkCycle()
  return Response.json(report)
}
