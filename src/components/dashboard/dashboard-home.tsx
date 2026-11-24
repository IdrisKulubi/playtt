import Link from "next/link"
import {
  CalendarPlusIcon,
  CaretRightIcon,
  FilmSlateIcon,
  PlayIcon,
  PlusCircleIcon,
} from "@phosphor-icons/react/dist/ssr"

import { BuyClipsButton } from "@/components/dashboard/buy-clips-button"
import { ReplayShareButton } from "@/components/replay/replay-share-button"

export type DashboardReplay = {
  id: string
  title: string
  recordedAt: string
  locationName: string
  status: string
  videoUrl?: string | null
  posterUrl?: string
}

export type DashboardCredits = {
  balance: number
  unitPriceKes: number
  minClips: number
  maxClips: number
}

// Fixed locale + zone so the server render matches the browser.
const replayDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Nairobi",
  day: "numeric",
  month: "short",
})

/**
 * The three things people come to the website for, in priority order:
 * book a table, top up replay clips, and watch / share their replays.
 */
export function DashboardPrimaryActions({
  credits,
  readyReplayCount,
}: {
  credits: DashboardCredits | null
  readyReplayCount: number
}) {
  return (
    <section aria-label="Main actions" className="grid gap-3 sm:grid-cols-3">
      <Link
        href="/book"
        className="flex flex-col justify-between gap-6 rounded-2xl bg-primary p-5 text-primary-foreground transition-transform duration-100 ease-out active:scale-[0.98] motion-reduce:transition-none"
      >
        <CalendarPlusIcon className="size-7" weight="fill" aria-hidden />
        <span>
          <span className="block text-[17px] font-semibold">Book a table</span>
          <span className="block text-[13px] opacity-80">Pick a time and pay in under a minute</span>
        </span>
      </Link>

      <BuyClipsButton pricing={credits} className="flex flex-col justify-between gap-6 rounded-2xl bg-card p-5 text-left ring-1 ring-border/60 transition-transform duration-100 ease-out active:scale-[0.98] disabled:opacity-70 motion-reduce:transition-none">
        <PlusCircleIcon className="size-7 text-primary" weight="fill" aria-hidden />
        <span>
          <span className="block text-[17px] font-semibold">Buy replay clips</span>
          <span className="block text-[13px] text-muted-foreground">
            {credits
              ? `${credits.balance} left · KES ${credits.unitPriceKes.toLocaleString("en-KE")} per clip`
              : "Save highlights from your games"}
          </span>
        </span>
      </BuyClipsButton>

      <Link
        href="/activity"
        className="flex flex-col justify-between gap-6 rounded-2xl bg-card p-5 ring-1 ring-border/60 transition-transform duration-100 ease-out active:scale-[0.98] motion-reduce:transition-none"
      >
        <FilmSlateIcon className="size-7 text-primary" weight="fill" aria-hidden />
        <span>
          <span className="block text-[17px] font-semibold">My replays</span>
          <span className="block text-[13px] text-muted-foreground">
            {readyReplayCount > 0
              ? `${readyReplayCount} clip${readyReplayCount === 1 ? "" : "s"} ready to watch and share`
              : "Your clips appear here after you play"}
          </span>
        </span>
      </Link>
    </section>
  )
}

export function DashboardRecentReplays({ replays }: { replays: DashboardReplay[] }) {
  const ready = replays.filter((replay) => replay.status === "ready").slice(0, 4)
  if (ready.length === 0) return null

  return (
    <section>
      <div className="flex items-end justify-between gap-3 px-1 pb-2">
        <h2 className="text-[13px] tracking-[0.01em] text-muted-foreground uppercase">Latest replays</h2>
        <Link href="/activity" className="text-[13px] text-primary">
          See all
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ready.map((replay) => (
          <li key={replay.id} className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
            <Link href={`/replays/${replay.id}`} className="group relative block aspect-video bg-black">
              {replay.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not optimisable
                <img src={replay.posterUrl} alt="" className="size-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
              ) : replay.videoUrl ? (
                // No poster yet: let the browser load just enough of the clip to show a frame ~1s in.
                <video
                  src={`${replay.videoUrl}#t=1`}
                  preload="metadata"
                  muted
                  playsInline
                  aria-hidden
                  tabIndex={-1}
                  className="pointer-events-none size-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                />
              ) : null}
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md">
                  <PlayIcon className="size-4" weight="fill" aria-hidden />
                </span>
              </span>
              <span className="sr-only">Play {replay.title}</span>
            </Link>
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{replay.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {replayDate.format(new Date(replay.recordedAt))} · {replay.locationName}
                </p>
              </div>
              <ReplayShareButton
                replayId={replay.id}
                videoUrl={replay.videoUrl}
                title={replay.title}
                className="shrink-0 text-[13px] font-medium text-primary transition-opacity active:opacity-50 disabled:opacity-50"
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

const MORE_LINKS = [
  { href: "/bookings", label: "My bookings" },
  { href: "/activity", label: "Activity and stats" },
  { href: "/community", label: "Bring your crew" },
  { href: "/account", label: "Account" },
] as const

export function DashboardMoreLinks({ name, email }: { name?: string | null; email?: string | null }) {
  return (
    <section>
      <h2 className="px-1 pb-2 text-[13px] tracking-[0.01em] text-muted-foreground uppercase">More</h2>
      <ul className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/60 [&>li+li]:border-t [&>li+li]:border-border/60">
        {MORE_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] transition-colors duration-100 hover:bg-muted/30 active:bg-muted/60"
            >
              <span>{link.label}</span>
              <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                {link.href === "/account" && email ? <span className="max-w-[14rem] truncate">{name || email}</span> : null}
                <CaretRightIcon className="size-3.5 opacity-50" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="px-1 pt-2 text-[13px] text-muted-foreground">
        Scoring, coaching and the full replay library live in the PlayTT app.
      </p>
    </section>
  )
}

export function DashboardSignedOut() {
  return (
    <section className="rounded-2xl bg-card p-6 text-center ring-1 ring-border/60">
      <p className="text-[17px] font-semibold">Sign in to book and see your replays</p>
      <p className="mt-1 text-[15px] text-muted-foreground">Your bookings and clips follow your account on web and mobile.</p>
      <div className="mt-4 flex justify-center gap-3">
        <Link href="/sign-in" className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">
          Sign in
        </Link>
        <Link href="/sign-up" className="inline-flex h-10 items-center rounded-full px-5 text-sm font-medium text-primary">
          Create account
        </Link>
      </div>
    </section>
  )
}
