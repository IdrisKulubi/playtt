"use client"

import { useState } from "react"
import { toast } from "sonner"

/**
 * Shares the clip itself (so it lands in WhatsApp, Instagram, etc.).
 * Falls back to opening the video so it can be saved when the browser
 * can't share files (most desktop browsers).
 */
export function ReplayShareButton({
  videoUrl,
  title,
  className,
}: {
  videoUrl: string | null | undefined
  title: string
  className?: string
}) {
  const [working, setWorking] = useState(false)

  if (!videoUrl) return null

  async function share() {
    if (!videoUrl) return
    setWorking(true)
    try {
      if (typeof navigator.share === "function" && typeof navigator.canShare === "function") {
        const response = await fetch(videoUrl)
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
      }
      window.open(videoUrl, "_blank", "noopener")
      toast("Opened the clip. Use your browser's save option to keep or send it.")
    } catch (error) {
      // The share sheet was dismissed; nothing to do.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        window.open(videoUrl, "_blank", "noopener")
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
