import * as Clipboard from "expo-clipboard"
import * as Haptics from "expo-haptics"
import { useCallback, useRef, useState } from "react"

import {
  getReplayWebLink,
  replayShareErrorMessage,
  saveReplayToGallery,
  shareReplayVideo,
} from "@/lib/replay-share"
import type { ReplaySummary } from "@/lib/replay-types"
import { toast } from "@/lib/toast"

export type ReplayShareAction = "share" | "save" | "link"

type ReplayShareTarget = Pick<
  ReplaySummary,
  "id" | "title" | "status" | "videoUrl" | "playbackExpiresAt"
>

export function useReplayShare(replay: ReplayShareTarget) {
  const [busyAction, setBusyAction] = useState<ReplayShareAction | null>(null)
  const lock = useRef(false)

  const run = useCallback(
    async (action: ReplayShareAction, task: () => Promise<void>) => {
      if (lock.current) return
      lock.current = true
      setBusyAction(action)
      try {
        await task()
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        )
      } catch (error) {
        const message = replayShareErrorMessage(error)
        if (
          action === "share" &&
          message.toLowerCase().includes("cancel")
        ) {
          return
        }
        toast.error(message)
      } finally {
        lock.current = false
        setBusyAction(null)
      }
    },
    [],
  )

  const onShare = useCallback(() => {
    void run("share", async () => {
      await shareReplayVideo(replay)
    })
  }, [replay, run])

  const onSave = useCallback(() => {
    void run("save", async () => {
      await saveReplayToGallery(replay)
      toast.success("Saved to your photo library.")
    })
  }, [replay, run])

  const onCopyLink = useCallback(() => {
    void run("link", async () => {
      await Clipboard.setStringAsync(getReplayWebLink(replay.id))
      toast.info("Link copied. Open it in PlayTT when you are signed in.")
    })
  }, [replay.id, run])

  return {
    busyAction,
    onShare,
    onSave,
    onCopyLink,
  }
}
