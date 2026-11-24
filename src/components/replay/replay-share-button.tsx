"use client"

import { useState } from "react"
import { toast } from "sonner"

/**
 * Asks the server for a fresh playback link. Replay links are signed and expire
 * after a short time, so a link captured when the page loaded can't be reused.
 * Falls back to the given URL for older public (unsigned) clips.
 */
async function freshVideoUrl(replayId: string, fallback: string | null | undefined) {
  try {
    const response = await fetch(`/api/replays/${replayId}/playback`, { cache: "no-store" })
    if (response.ok) {
      const payload = (await response.json()) as { data?: { playback?: { grant?: { url?: string } } } }
      const url = payload.data?.playback?.grant?.url
      if (url) return url
    }
  } catch {
    // Network error: try the fallback below.
  }
  return fallback ?? null
}

/**
 * Shares the clip itself (so it lands in WhatsApp, Instagram, etc.).
 * Falls back to opening the video so it can be saved when the browser
 * can't share files (most desktop browsers).
 */
export function ReplayShareButton({
  replayId,
  videoUrl,
  title,
  className,
}: {
  replayId: string
  videoUrl: string | null | undefined
  title: string
  className?: string
}) {
  const [working, setWorking] = useState(false)

  async function share() {
    setWorking(true)
    // Open the fallback tab synchronously so pop-up blockers allow it; it's filled in below.
    let fallbackTab: Window | null = null
    const canShareFiles = typeof navigator.share === "function" && typeof navigator.canShare === "function"
    if (!canShareFiles) fallbackTab = window.open("", "_blank")

    try {
      const url = await freshVideoUrl(replayId, videoUrl)
      if (!url) {
        fallbackTab?.close()
        toast.error("This clip isn't available right now. Try again in a moment.")
        return
      }

      if (canShareFiles) {
        const response = await fetch(url)
        if (response.ok) {
          const blob = await response.blob()
          const file = new File([blob], `${title.replace(/[^\w-]+/g, "-").toLowerCase() || "playtt-replay"}.mp4`, {
            type: blob.type || "video/mp4",
          })
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title, text: "My PlayTT replay" })
            return
          }
        }
        window.open(url, "_blank", "noopener")
      } else if (fallbackTab) {
        fallbackTab.location.href = url
      } else {
        window.location.href = url
      }
      toast("Opened the clip. Use your browser's save option to keep or send it.")
    } catch (error) {
      // The share sheet was dismissed; nothing to do.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        fallbackTab?.close()
        toast.error("Couldn't share this clip. Try again.")
      }
    } finally {
      setWorking(false)
    }
  }

  return (
    <button type="button" onClick={() => void share()} disabled={working} className={className}>
      {working ? "Preparing…" : "Share"}
    </button>
  )
}
