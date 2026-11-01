import Link from "next/link"
import { headers } from "next/headers"
import { ChatCircleDotsIcon, DeviceMobileIcon, UsersThreeIcon } from "@phosphor-icons/react/dist/ssr"

import { auth } from "../../../auth"
import { WebPlayerCard } from "@/components/community/web-player-card"
import { PlayerShell } from "@/components/layout/player-shell"
import { Button } from "@/components/ui/button"
import { getMyCommunity } from "@/server/community/service"
import { resolveTenantContextForUserId } from "@/server/tenancy/session-context"

export const dynamic = "force-dynamic"

// Community is mobile-first (docs/community/README.md, "Web app"): the web
// page shows your card and points you to the app for chat and Open to play.
const FEATURES = [
  { icon: UsersThreeIcon, title: "Find players", body: "See who's open to play at your venue, by skill level." },
  { icon: ChatCircleDotsIcon, title: "Chat to agree a time", body: "Message players, then book a table as usual." },
  { icon: DeviceMobileIcon, title: "Your player card", body: "Rating, reliability and kudos earned on the table." },
]

function GetTheApp() {
  const iosUrl = process.env.NEXT_PUBLIC_IOS_APP_URL
  const androidUrl = process.env.NEXT_PUBLIC_ANDROID_APP_URL

  return (
    <div className="rounded-2xl border border-border/70 p-5">
      <h2 className="text-lg font-semibold">Community lives in the PlayTT app</h2>
      <ul className="mt-4 space-y-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ul>
      {iosUrl || androidUrl ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {iosUrl ? (
            <Button asChild>
              <a href={iosUrl}>Download for iPhone</a>
            </Button>
          ) : null}
          {androidUrl ? (
            <Button asChild variant="outline">
              <a href={androidUrl}>Get it on Android</a>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default async function CommunityPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    return (
      <PlayerShell eyebrow="Play together" title="Community">
        <div className="grid gap-5 lg:grid-cols-2">
          <GetTheApp />
          <div className="rounded-2xl border border-border/70 p-5">
            <p className="text-sm text-muted-foreground">Sign in to see your player card.</p>
            <Button asChild className="mt-3">
              <Link href="/sign-in?callbackUrl=/community">Sign in</Link>
            </Button>
          </div>
        </div>
      </PlayerShell>
    )
  }

  const context = await resolveTenantContextForUserId(session.user.id)
  const me = await getMyCommunity(context, session.user.id)

  return (
    <PlayerShell eyebrow="Play together" title="Community">
      <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="space-y-3">
          <WebPlayerCard
            displayName={me.displayName}
            skillLevel={me.skillLevel}
            stats={me.stats}
            badges={me.badges}
            footer={me.homeVenue ? `PlayTT · ${me.homeVenue.name.replace(/^PlayTT\s+/i, "")}` : "PlayTT"}
          />
          <p className="text-center text-xs text-muted-foreground">
            {me.profile.communityVisible
              ? `${me.counts.followers} followers · ${me.counts.following} following`
              : "Your card is hidden. Turn it on in the app to appear in Community."}
          </p>
        </div>
        <GetTheApp />
      </div>
    </PlayerShell>
  )
}
