"use client"

import { useState } from "react"
import { MinusIcon, PlusIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type ClipPricing = {
  balance: number
  unitPriceKes: number
  minClips: number
  maxClips: number
}

const PRESETS = [5, 10, 20]

function kes(value: number) {
  return `KES ${value.toLocaleString("en-KE")}`
}

/** Opens a sheet to choose how many clips to buy, then goes to the secure checkout. */
export function BuyClipsButton({
  pricing,
  className,
  children,
}: {
  pricing: ClipPricing | null
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState(10)
  const [loading, setLoading] = useState(false)

  const min = pricing?.minClips ?? 1
  const max = pricing?.maxClips ?? 50
  const unit = pricing?.unitPriceKes ?? 0
  const clamp = (value: number) => Math.min(max, Math.max(min, Math.round(value) || min))
  const total = unit * quantity

  async function checkout() {
    setLoading(true)
    try {
      const response = await fetch("/api/replays/credits/purchase?client=web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        data?: { authorizationUrl?: string }
        message?: string
      }
      const url = payload.data?.authorizationUrl
      if (!response.ok || !url) {
        toast.error(payload.message ?? "Couldn't start checkout. Try again.")
        setLoading(false)
        return
      }
      window.location.assign(url)
    } catch {
      toast.error("Couldn't reach PlayTT. Check your connection.")
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!pricing}
        className={className}
      >
        {children}
      </button>

      <Dialog open={open} onOpenChange={(next) => !loading && setOpen(next)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Buy replay clips</DialogTitle>
            <DialogDescription>
              Each clip saves one highlight from your session. You have {pricing?.balance ?? 0} left.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              aria-label="Fewer clips"
              onClick={() => setQuantity((value) => clamp(value - 1))}
              disabled={quantity <= min || loading}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-muted transition-transform duration-100 active:scale-95 disabled:opacity-40"
            >
              <MinusIcon className="size-4" weight="bold" />
            </button>
            <label className="flex flex-col items-center">
              <span className="sr-only">Number of clips</span>
              <input
                type="number"
                inputMode="numeric"
                min={min}
                max={max}
                value={quantity}
                onChange={(event) => setQuantity(clamp(Number(event.target.value)))}
                disabled={loading}
                className="w-24 bg-transparent text-center font-heading text-5xl font-bold tracking-tight tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-[13px] text-muted-foreground">clip{quantity === 1 ? "" : "s"}</span>
            </label>
            <button
              type="button"
              aria-label="More clips"
              onClick={() => setQuantity((value) => clamp(value + 1))}
              disabled={quantity >= max || loading}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-muted transition-transform duration-100 active:scale-95 disabled:opacity-40"
            >
              <PlusIcon className="size-4" weight="bold" />
            </button>
          </div>

          <div role="radiogroup" aria-label="Quick picks" className="grid grid-cols-3 gap-0.5 rounded-[10px] bg-muted p-0.5">
            {PRESETS.filter((preset) => preset >= min && preset <= max).map((preset) => (
              <button
                key={preset}
                type="button"
                role="radio"
                aria-checked={quantity === preset}
                onClick={() => setQuantity(preset)}
                disabled={loading}
                className={`rounded-[8px] py-1.5 text-[13px] font-medium transition-colors ${
                  quantity === preset ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="space-y-1 border-t border-border/60 pt-4 text-[15px]">
            <div className="flex justify-between text-muted-foreground">
              <span>
                {quantity} × {kes(unit)}
              </span>
              <span className="tabular-nums">{kes(total)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{kes(total)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void checkout()}
            disabled={loading || !pricing}
            className="h-12 w-full rounded-full bg-primary text-[15px] font-semibold text-primary-foreground transition-transform duration-100 active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "Opening checkout…" : `Pay ${kes(total)}`}
          </button>
          <p className="-mt-3 text-center text-[13px] text-muted-foreground">
            You&apos;ll pay securely with M-Pesa or card on the next page.
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
