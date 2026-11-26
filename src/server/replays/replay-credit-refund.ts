// A clip credit is taken when Replay is tapped. When the capture then fails
// (camera not recording, recorder offline, upload failed...), the player
// gets it back: they shouldn't pay for a clip they never received.

import { and, eq, sql } from "drizzle-orm"

import db from "@/db/drizzle"
import { replayCreditBalances, replayCreditLedger } from "@/db/schema"

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Statuses where no clip was delivered (yet, or ever). */
export const REPLAY_FAILURE_STATUSES = new Set([
  "edge_offline",
  "buffer_missing",
  "extraction_failed",
  "upload_failed",
  "failed",
  "expired",
])

/**
 * Returns the credit spent on this replay, at most once. Safe to call on
 * every failure transition: a replay that was refunded (or never charged,
 * like the session owner's included clips) is left alone.
 */
export async function refundReplayCaptureCredit(
  executor: DbExecutor,
  input: { tenantId: string; replayId: string | null },
) {
  if (!input.replayId) return false

  const ledger = await executor
    .select({ reason: replayCreditLedger.reason, userId: replayCreditLedger.userId, bookingId: replayCreditLedger.bookingId })
    .from(replayCreditLedger)
    .where(and(eq(replayCreditLedger.tenantId, input.tenantId), eq(replayCreditLedger.replayId, input.replayId)))

  const charge = ledger.find((row) => row.reason === "replay_capture")
  if (!charge || ledger.some((row) => row.reason === "refund")) return false

  await executor.insert(replayCreditLedger).values({
    tenantId: input.tenantId,
    userId: charge.userId,
    delta: 1,
    reason: "refund",
    bookingId: charge.bookingId,
    replayId: input.replayId,
  })

  await executor
    .update(replayCreditBalances)
    .set({ balance: sql`${replayCreditBalances.balance} + 1`, updatedAt: new Date() })
    .where(eq(replayCreditBalances.userId, charge.userId))

  return true
}
