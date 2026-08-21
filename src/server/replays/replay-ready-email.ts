import { and, eq, sql } from "drizzle-orm"

import db from "@/db/drizzle"
import { locations, notifications, replays, user } from "@/db/schema"
import { deliverThenMarkSent } from "@/server/payments/notification-delivery.mjs"
import { sendReplayReadyEmail } from "@/server/replays/replay-ready-email-sender"

type ReplayReadyOutboxRow = {
  tenantId: string | null
  payload: Record<string, unknown>
}

function resolveAppReplayUrl(replayId: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "http://localhost:3000"

  return new URL(`/replays/${replayId}`, baseUrl).toString()
}

async function loadReplayEmailContext(tenantId: string, replayId: string) {
  const [pendingNotification] = await db
    .select({
      id: notifications.id,
      userId: notifications.userId,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.tenantId, tenantId),
        eq(notifications.channel, "email"),
        eq(notifications.templateKey, "replay_ready"),
        eq(notifications.status, "pending"),
        sql`${notifications.payload} ->> 'replayId' = ${replayId}`,
      ),
    )
    .limit(1)

  if (!pendingNotification?.userId) {
    return null
  }

  const [row] = await db
    .select({
      userEmail: user.email,
      userName: user.name,
      locationName: locations.name,
      replayTitle: replays.metadata,
    })
    .from(replays)
    .innerJoin(user, eq(replays.userId, user.id))
    .innerJoin(locations, eq(replays.locationId, locations.id))
    .where(
      and(
        eq(replays.tenantId, tenantId),
        eq(locations.tenantId, tenantId),
        eq(replays.id, replayId),
        eq(replays.userId, pendingNotification.userId),
      ),
    )
    .limit(1)

  if (!row?.userEmail) {
    return null
  }

  const metadata = row.replayTitle as Record<string, unknown> | null
  const title =
    typeof metadata?.title === "string" && metadata.title.trim()
      ? metadata.title.trim()
      : "Session clip"

  return {
    notificationId: pendingNotification.id,
    email: row.userEmail,
    name: row.userName,
    locationName: row.locationName,
    title,
    replayUrl: resolveAppReplayUrl(replayId),
  }
}

export async function consumeReplayReadyEmail(row: ReplayReadyOutboxRow) {
  const tenantId = row.tenantId
  const replayId = String(row.payload.replayId ?? "")

  if (!tenantId || !replayId) {
    throw new Error("replay.ready.v1 event is missing replay identity.")
  }

  const context = await loadReplayEmailContext(tenantId, replayId)

  if (!context?.email) {
    return
  }

  await deliverThenMarkSent({
    idempotencyKey: `replay-ready/${replayId}`,
    deliver: (idempotencyKey: string) =>
      sendReplayReadyEmail({
        email: context.email,
        name: context.name,
        locationName: context.locationName,
        title: context.title,
        replayUrl: context.replayUrl,
        idempotencyKey,
      }),
    markSent: () =>
      db
        .update(notifications)
        .set({
          status: "sent",
          sentAt: new Date(),
        })
        .where(
          and(
            eq(notifications.id, context.notificationId),
            eq(notifications.status, "pending"),
          ),
        ),
  })
}
