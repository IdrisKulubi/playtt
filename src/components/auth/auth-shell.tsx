import type { ReactNode } from "react";
import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AuthShellProps {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}

const authProofPoints = [
  {
    value: "30 / 60",
    label: "minute booking blocks",
  },
  {
    value: "T-2 min",
    label: "lights welcome players in",
  },
  {
    value: "1 flow",
    label: "booking, payment, access",
  },
] as const;

export function AuthShell({
  children,
  eyebrow,
  title,
  description,
}: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="hero-orb left-[-8rem] top-10 h-72 w-72 bg-primary/18" />
      <div className="hero-orb right-[-8rem] top-28 h-80 w-80 bg-sky-500/10" />
      <div className="playtt-grid absolute inset-0 opacity-25" />

      <div className="app-shell min-h-screen justify-center gap-10 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
        <section className="glass-panel-strong flex flex-col justify-between p-8 md:p-10">
          <div className="space-y-8">
            <div className="flex items-start justify-between gap-4">
              <BrandMark />
              <Badge className="border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] tracking-[0.18em] text-primary uppercase">
                {eyebrow}
              </Badge>
            </div>

            <div className="max-w-xl space-y-5">
              <p className="section-label">Private, calm, autonomous</p>
              <h1 className="max-w-lg text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
                Book a premium table tennis session that feels effortless from the first tap.
              </h1>
              <p className="max-w-lg text-base leading-7 text-white/66 md:text-lg">
                Authentication is part of the product experience, not a detour. Every account action should feel
                as polished and trustworthy as the booking flow that follows.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {authProofPoints.map((item) => (
                <div key={item.label} className="metric-tile">
                  <p className="text-2xl font-semibold text-white">{item.value}</p>
                  <p className="mt-2 text-sm text-white/56">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 rounded-[1.75rem] border border-primary/15 bg-primary/10 p-5">
            <p className="section-label">Design principle</p>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/72">
              Use short labels, obvious next steps, and low-friction form states. The player should always understand
              why they are here and what happens after they continue.
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center lg:justify-end">
          <div className="w-full max-w-md space-y-5">
            <div className="space-y-2 px-1">
              <p className="section-label">{eyebrow}</p>
              <h2 className="text-3xl font-semibold text-white">{title}</h2>
              <p className="text-sm leading-6 text-white/65">{description}</p>
            </div>

            {children}

            <div className="flex items-center justify-between px-1 text-xs text-white/45">
              <span>PlayTT account access</span>
              <Button asChild variant="link" className="h-auto p-0 text-primary">
                <Link href="/">Back to home</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
