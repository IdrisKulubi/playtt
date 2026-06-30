import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { QuestionIcon } from "@phosphor-icons/react/dist/ssr"

import { auth } from "../../../../auth"
import { PlayerShell } from "@/components/layout/player-shell"

export const dynamic = "force-dynamic"

const faqs = [
  {
    question: "How do I book a session?",
    answer:
      "Go to Book, pick a time, choose your group size, and pay to lock in the slot.",
  },
  {
    question: "Can I change my booking?",
    answer:
      "Yes. Open your booking and edit the time or player count up to 2 hours before play starts.",
  },
  {
    question: "What happens if I paid for more players and reduce later?",
    answer:
      "If the edit is within the allowed window, PlayTT keeps the extra paid amount as account credit for a future session.",
  },
  {
    question: "How do I get into the pod?",
    answer:
      "Your upcoming booking will show the access details before the session. Venue assistance is available if anything is unclear.",
  },
  {
    question: "How do clip packs work?",
    answer:
      "Clip packs let you save replay moments from your sessions. Activity and Coach will show captured clips as the replay system comes online.",
  },
  {
    question: "Need help?",
    answer:
      "Message support at hello@theplaytt.com with your account email and booking details.",
  },
]

export default async function AccountHelpPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect("/sign-in")
  }

  return (
    <PlayerShell eyebrow="Player settings" title="Help" backHref="/account">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="quiet-panel p-5 sm:p-6">
          <QuestionIcon className="size-7 text-primary" weight="fill" />
          <p className="section-label mt-6">FAQ and support</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Quick answers for playing at PlayTT.
          </h2>
          <div className="mt-6 divide-y divide-border rounded-[var(--radius-field)] border border-border bg-card px-4">
            {faqs.map((item) => (
              <article key={item.question} className="py-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {item.question}
                </h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </section>

        <aside className="quiet-panel h-fit p-5">
          <p className="section-label">Support</p>
          <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-foreground">
            Tell us what happened.
          </h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Include your booking date, time, and account email so the team can
            find the right session quickly.
          </p>
          <a
            href="mailto:hello@theplaytt.com"
            className="mt-5 inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Email support
          </a>
        </aside>
      </div>
    </PlayerShell>
  )
}
