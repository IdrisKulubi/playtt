import Link from "next/link"
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  ClockIcon,
  MapPinIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr"

import { PlayerShell } from "@/components/layout/player-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type CommunityPlayer = {
  id: string
  name: string
  skillLevel: string
  preferredTime: string
  venue: string
  bio: string
}

type CommunityPlayRequest = {
  id: string
  playerName: string
  skillLevel: string
  preferredTime: string
  venue: string
  status: "open" | "pending"
}

const communityPlayers: CommunityPlayer[] = [
  {
    id: "p1",
    name: "Amara K.",
    skillLevel: "Intermediate",
    preferredTime: "Weekday evenings",
    venue: "PlayTT Hurlingham",
    bio: "Looking for consistent rally partners. Prefer best-of-five sets.",
  },
  {
    id: "p2",
    name: "James O.",
    skillLevel: "Advanced",
    preferredTime: "Sat mornings",
    venue: "PlayTT Hurlingham",
    bio: "Competitive but friendly. Happy to help with serve practice.",
  },
  {
    id: "p3",
    name: "Priya M.",
    skillLevel: "Beginner",
    preferredTime: "Sun afternoons",
    venue: "PlayTT Hurlingham",
    bio: "New to table tennis. Looking for patient partners to learn with.",
  },
  {
    id: "p4",
    name: "Daniel W.",
    skillLevel: "Intermediate",
    preferredTime: "Fri after work",
    venue: "PlayTT Hurlingham",
    bio: "Usually books 90-minute sessions. Open to doubles too.",
  },
]

const openRequests: CommunityPlayRequest[] = [
  {
    id: "r1",
    playerName: "Chris N.",
    skillLevel: "Intermediate",
    preferredTime: "Sat, Jun 14 / 4:00 PM",
    venue: "PlayTT Hurlingham",
    status: "open",
  },
  {
    id: "r2",
    playerName: "Lena T.",
    skillLevel: "Beginner",
    preferredTime: "Sun, Jun 15 / 11:00 AM",
    venue: "PlayTT Hurlingham",
    status: "open",
  },
  {
    id: "r3",
    playerName: "You",
    skillLevel: "Intermediate",
    preferredTime: "Wed, Jun 18 / 7:00 PM",
    venue: "PlayTT Hurlingham",
    status: "pending",
  },
]

function PlayerInitial({ name }: { name: string }) {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-semibold text-primary">
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

function CommunityPlayerRow({
  player,
  isLast = false,
}: {
  player: CommunityPlayer
  isLast?: boolean
}) {
  return (
    <article
      className={
        isLast
          ? "flex gap-3 py-4"
          : "flex gap-3 border-b border-border py-4"
      }
    >
      <PlayerInitial name={player.name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">
            {player.name}
          </h3>
          <Badge variant="outline">{player.skillLevel}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {player.preferredTime} / {player.venue}
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {player.bio}
        </p>
      </div>
    </article>
  )
}

function OpenRequestRow({
  request,
  isLast = false,
}: {
  request: CommunityPlayRequest
  isLast?: boolean
}) {
  return (
    <div
      className={
        isLast
          ? "grid gap-1 py-4"
          : "grid gap-1 border-b border-border py-4"
      }
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">
          {request.playerName}
        </p>
        <Badge variant={request.status === "open" ? "default" : "outline"}>
          {request.status === "open" ? "Open" : "Pending"}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {request.skillLevel} / {request.preferredTime}
      </p>
      <p className="text-sm text-muted-foreground">{request.venue}</p>
    </div>
  )
}

function CommunityHero() {
  return (
    <section className="quiet-panel overflow-hidden p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UsersThreeIcon className="size-6 text-primary" weight="fill" />
            <Badge variant="outline">Preview</Badge>
          </div>
          <p className="section-label mt-6">Coming together</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
            Find someone to play with at your venue.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
            Community brings nearby players, open match requests, and private
            crews into one calm place. Start with a booked session, then invite
            the right people to the table.
          </p>
        </div>
        <Button asChild className="w-full lg:w-auto">
          <Link href="/book">
            Book a session
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  )
}

function NearbyPlayersPanel() {
  return (
    <section className="quiet-panel p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-label">Nearby players</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            A quieter way to find partners.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Match by skill level, preferred time, and venue before you share a
            table.
          </p>
        </div>
        <Badge variant="outline">{communityPlayers.length} players</Badge>
      </div>

      <div className="mt-5 rounded-[var(--radius-field)] border border-border bg-card px-4">
        {communityPlayers.map((player, index) => (
          <CommunityPlayerRow
            key={player.id}
            player={player}
            isLast={index === communityPlayers.length - 1}
          />
        ))}
      </div>
    </section>
  )
}

function OpenRequestsPanel() {
  return (
    <section className="quiet-panel p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-label">Open requests</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Match requests without the noise.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Players can share when they want to play, their level, and where
            they prefer to meet.
          </p>
        </div>
        <Badge variant="outline">Mobile first</Badge>
      </div>

      <div className="mt-5 rounded-[var(--radius-field)] border border-border bg-card px-4">
        {openRequests.map((request, index) => (
          <OpenRequestRow
            key={request.id}
            request={request}
            isLast={index === openRequests.length - 1}
          />
        ))}
      </div>
    </section>
  )
}

function CommunityRail() {
  return (
    <aside className="grid gap-5 sm:grid-cols-2 2xl:block 2xl:space-y-5">
      <div className="quiet-panel p-5">
        <div className="flex size-10 items-center justify-center rounded-[var(--radius-field)] bg-primary/12 text-primary">
          <CalendarCheckIcon className="size-5" weight="fill" />
        </div>
        <p className="mt-5 text-sm font-semibold text-foreground">
          Start with a booking
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Private sessions are still the main action. Invite your group after
          you lock a time.
        </p>
        <Button asChild variant="outline" className="mt-5 w-full rounded-full">
          <Link href="/book">
            View availability
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </div>

      <div className="quiet-panel p-5">
        <p className="section-label">How it works</p>
        <div className="mt-5 space-y-4">
          {[
            {
              icon: ClockIcon,
              title: "Pick a time",
              copy: "Choose when you want to play.",
            },
            {
              icon: UsersThreeIcon,
              title: "Set your level",
              copy: "Beginner, intermediate, or advanced.",
            },
            {
              icon: MapPinIcon,
              title: "Meet at the venue",
              copy: "Keep requests tied to a PlayTT location.",
            },
          ].map(({ icon: Icon, title, copy }) => (
            <div key={title} className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-4" weight="fill" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  {title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {copy}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

export default function CommunityPage() {
  return (
    <PlayerShell eyebrow="Play together" title="Community">
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:gap-6">
        <div className="space-y-5">
          <CommunityHero />
          <NearbyPlayersPanel />
          <OpenRequestsPanel />
        </div>

        <CommunityRail />
      </div>
    </PlayerShell>
  )
}
