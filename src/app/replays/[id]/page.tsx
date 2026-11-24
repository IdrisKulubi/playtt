import Link from "next/link"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { auth } from "../../../../auth"
import { PlayerShell } from "@/components/layout/player-shell"
import { ReplayShareButton } from "@/components/replay/replay-share-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getReplayDetailForUser } from "@/server/replays/playback"
import { resolveTenantContextForUserId } from "@/server/tenancy/session-context"

export const dynamic = "force-dynamic"

const replayDateFormatter = new Intl.DateTimeFormat("en-KE", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

type ReplayDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function ReplayDetailPage({ params }: ReplayDetailPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/sign-in")
  }

  const { id } = await params
  const context = await resolveTenantContextForUserId(session.user.id)

  let replay

  try {
    replay = await getReplayDetailForUser(context, {
      replayId: id,
      userId: session.user.id,
    })
  } catch {
    notFound()
  }

  return (
    <PlayerShell title={replay.title}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Replay library</p>
            <h1 className="text-3xl font-semibold tracking-tight">{replay.title}</h1>
            <p className="text-sm text-muted-foreground">
              Recorded {replayDateFormatter.format(new Date(replay.recordedAt))}
            </p>
          </div>
          <Badge variant="secondary">{replay.status}</Badge>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-black">
          <video
            key={replay.playbackUrl}
            className="aspect-video w-full"
            controls
            playsInline
            preload="metadata"
            src={replay.playbackUrl}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Playback link expires{" "}
            {replayDateFormatter.format(new Date(replay.playbackExpiresAt))}
          </p>
          <div className="flex items-center gap-2">
            <ReplayShareButton
              videoUrl={replay.playbackUrl}
              title={replay.title}
              className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity active:opacity-70 disabled:opacity-60"
            />
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to home</Link>
            </Button>
          </div>
        </div>
      </div>
    </PlayerShell>
  )
}
