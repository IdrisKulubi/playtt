import { eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { replays } from "@/db/schema"

/** Stub NVR clip job — replace with real camera/NVR integration. */
export async function enqueueNvrClip(input: {
  replayId: string
  bookingId: string
  locationId: string
  userId: string
  durationSeconds: number
}) {
  void input

  // Hardware phase: command local NVR to extract buffer and upload to storage.
  // Dev stub: mark ready with placeholder after a short processing state.
  await db
    .update(replays)
    .set({ status: "processing" })
    .where(eq(replays.id, input.replayId))

  return { queued: true, replayId: input.replayId }
}

export async function markReplayReadyInDb(input: {
  replayId: string
  videoUrl: string
  title?: string
}) {
  const [row] = await db
    .update(replays)
    .set({
      status: "ready",
      videoUrl: input.videoUrl,
      readyAt: new Date(),
      metadata: input.title ? { title: input.title } : { title: "Session clip" },
    })
    .where(eq(replays.id, input.replayId))
    .returning()

  if (!row) {
    throw new Error("Replay not found.")
  }

  return row
}

/** Dev helper: complete stub clip without real NVR hardware. */
export async function completeStubNvrClip(replayId: string) {
  return markReplayReadyInDb({
    replayId,
    videoUrl: `https://playtt.local/replays/${replayId}.mp4`,
    title: "Session clip",
  })
}
