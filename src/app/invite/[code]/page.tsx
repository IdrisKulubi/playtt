import type { Metadata } from "next"
import Link from "next/link"

import { WebPlayerCard } from "@/components/community/web-player-card"
import { Button } from "@/components/ui/button"
import { getInviteForLanding } from "@/server/community/invite-service"

export const dynamic = "force-dynamic"

type PageProps = { params: Promise<{ code: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params
  const invite = await getInviteForLanding(code)
  const title = invite ? `${invite.inviter.displayName} invited you to PlayTT` : "Play table tennis on PlayTT"
  return {
    title,
    description: "Find players at your venue, agree a time in chat and book a table.",
    openGraph: { title, description: "Play table tennis with me on PlayTT 🏓" },
  }
}

export default async function InvitePage({ params }: PageProps) {
  const { code } = await params
  const invite = await getInviteForLanding(code)
  const iosUrl = process.env.NEXT_PUBLIC_IOS_APP_URL
  const androidUrl = process.env.NEXT_PUBLIC_ANDROID_APP_URL

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07111d] px-4 py-10 text-white">
      <div className="w-full max-w-md space-y-6 text-center">
        {invite ? (
          <>
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#00b7ff]">PlayTT invite</p>
              <h1 className="text-3xl font-semibold">{invite.inviter.displayName} wants to play</h1>
              <p className="text-white/70">
                Join PlayTT to find players at your venue, chat to agree a time and book a table.
              </p>
            </div>

            <WebPlayerCard
              displayName={invite.inviter.displayName}
              skillLevel={invite.inviter.skillLevel}
              stats={invite.inviter.stats}
              badges={invite.inviter.badges}
              footer="PlayTT · Parklands"
            />

            {invite.used ? (
              <p className="text-sm text-white/70">This invite has already been used, but you can still join PlayTT.</p>
            ) : (
              <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Your invite code</p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em]">{invite.code}</p>
                <p className="mt-1 text-xs text-white/60">
                  Enter it in Community after you sign up and you&apos;ll follow each other straight away.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold">Play table tennis on PlayTT</h1>
            <p className="text-white/70">This invite link isn&apos;t valid, but you can still join.</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {invite && !invite.used ? (
            <Button asChild size="lg">
              <a href={`playtt://invite/${invite.code}`}>Open in the PlayTT app</a>
            </Button>
          ) : null}
          {iosUrl ? (
            <Button asChild variant="outline" size="lg">
              <a href={iosUrl}>Download for iPhone</a>
            </Button>
          ) : null}
          {androidUrl ? (
            <Button asChild variant="outline" size="lg">
              <a href={androidUrl}>Get it on Android</a>
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="lg">
            <Link href="/sign-up">Sign up on the web</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
