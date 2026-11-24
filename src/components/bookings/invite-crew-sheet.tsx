"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ChatCircleTextIcon,
  CheckIcon,
  CopyIcon,
  DotsThreeIcon,
  InstagramLogoIcon,
  ShareNetworkIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { formatBookingTimeRange } from "@/components/bookings/booking-utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { UserBookingSummary } from "@/server/bookings/types"

function inviteMessage(booking: UserBookingSummary, link: string) {
  return `Join me for table tennis at ${booking.locationName} 🏓 ${formatBookingTimeRange(booking)}. ${link}`
}

/** "Invite crew": one sheet with the link to copy and the apps people actually use. */
export function InviteCrewButton({
  booking,
  size = "sm",
}: {
  booking: UserBookingSummary
  size?: "sm" | "default"
}) {
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function")
  }, [])

  // Create the personal invite link the first time the sheet opens.
  const ensureLink = useCallback(async () => {
    if (link || loading) return
    setLoading(true)
    try {
      const response = await fetch("/api/v1/community/invites", { method: "POST" })
      const payload = (await response.json().catch(() => ({}))) as { data?: { invite?: { url?: string } } }
      setLink(payload.data?.invite?.url ?? `${window.location.origin}/book`)
    } catch {
      setLink(`${window.location.origin}/book`)
    } finally {
      setLoading(false)
    }
  }, [link, loading])

  useEffect(() => {
    if (open) void ensureLink()
  }, [open, ensureLink])

  const message = link ? inviteMessage(booking, link) : ""

  async function copy(text: string, note: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
      toast.success(note)
      return true
    } catch {
      toast.error("Couldn't copy. Select the link and copy it.")
      return false
    }
  }

  function openWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener")
  }

  async function openInstagram() {
    // Instagram has no web link for pre-filled messages: copy first, then open DMs.
    if (await copy(message, "Invite copied. Paste it in your Instagram chat.")) {
      window.open("https://www.instagram.com/direct/inbox/", "_blank", "noopener")
    }
  }

  function openMessages() {
    window.location.href = `sms:?&body=${encodeURIComponent(message)}`
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: "PlayTT session", text: message })
    } catch {
      // Sheet dismissed.
    }
  }

  const targets = [
    { label: "WhatsApp", Icon: WhatsappLogoIcon, onClick: openWhatsApp },
    { label: "Instagram", Icon: InstagramLogoIcon, onClick: () => void openInstagram() },
    { label: "Messages", Icon: ChatCircleTextIcon, onClick: openMessages },
    ...(canNativeShare ? [{ label: "More", Icon: DotsThreeIcon, onClick: () => void nativeShare() }] : []),
  ]

  return (
    <>
      <Button variant="outline" size={size} onClick={() => setOpen(true)}>
        <ShareNetworkIcon className="size-4" />
        Invite crew
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite your crew</DialogTitle>
            <DialogDescription>
              {booking.locationName} · {formatBookingTimeRange(booking)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-[13px] text-muted-foreground">Invite link</p>
            <div className="flex items-center gap-2 rounded-xl bg-muted/60 py-1.5 pr-1.5 pl-3">
              <span className="min-w-0 flex-1 truncate font-mono text-[13px]" aria-live="polite">
                {loading || !link ? "Creating link…" : link}
              </span>
              <button
                type="button"
                disabled={!link}
                onClick={() => link && void copy(link, "Link copied.")}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-background px-3 text-[13px] font-medium shadow-sm transition-transform duration-100 active:scale-95 disabled:opacity-50"
              >
                {copied ? <CheckIcon className="size-3.5" weight="bold" /> : <CopyIcon className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div>
            <p className="pb-2 text-[13px] text-muted-foreground">Send with</p>
            <div className={`grid gap-2 ${targets.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
              {targets.map(({ label, Icon, onClick }) => (
                <button
                  key={label}
                  type="button"
                  disabled={!link}
                  onClick={onClick}
                  className="flex flex-col items-center gap-1.5 rounded-xl py-2 transition-transform duration-100 active:scale-95 disabled:opacity-50"
                >
                  <span className="grid size-12 place-items-center rounded-full bg-muted">
                    <Icon className="size-6" weight="fill" aria-hidden />
                  </span>
                  <span className="text-[12px]">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-muted/40 px-3 py-2.5">
            <p className="text-[13px] text-muted-foreground">Message</p>
            <p className="mt-0.5 text-[13px] leading-snug">{message || "…"}</p>
            <button
              type="button"
              disabled={!link}
              onClick={() => void copy(message, "Message copied.")}
              className="mt-1.5 text-[13px] font-medium text-primary disabled:opacity-50"
            >
              Copy message
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
