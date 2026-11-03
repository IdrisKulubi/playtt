import type { ReactNode } from "react"

import { SiteFooter } from "@/components/home/site-footer"
import { MarketingNavActions } from "@/components/layout/marketing-nav-actions"
import { MarketingShell } from "@/components/layout/marketing-shell"

export type LegalSection = { heading: string; body: ReactNode }

type LegalPageProps = {
  title: string
  updated: string
  intro: string
  sections: LegalSection[]
}

/** Plain, readable long-form page for the privacy policy and terms. */
export function LegalPage({ title, updated, intro, sections }: LegalPageProps) {
  return (
    <MarketingShell actions={<MarketingNavActions />} footer={<SiteFooter />}>
      <article className="section-shell mx-auto w-full max-w-3xl px-5 pb-16 pt-28">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Last updated {updated}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{intro}</p>

        <nav aria-label="On this page" className="mt-8 rounded-2xl border border-border/60 p-5">
          <ol className="grid gap-2 text-sm sm:grid-cols-2">
            {sections.map((section, index) => (
              <li key={section.heading}>
                <a className="text-muted-foreground transition hover:text-foreground" href={`#s${index + 1}`}>
                  {index + 1}. {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {sections.map((section, index) => (
            <section key={section.heading} id={`s${index + 1}`} className="scroll-mt-28">
              <h2 className="text-2xl font-semibold tracking-tight">
                {index + 1}. {section.heading}
              </h2>
              <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
                {section.body}
              </div>
            </section>
          ))}
        </div>
      </article>
    </MarketingShell>
  )
}
