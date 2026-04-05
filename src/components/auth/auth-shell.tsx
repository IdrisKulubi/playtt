import type { ReactNode } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AuthShellProps {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}

export function AuthShell({
  children,
  eyebrow,
  title,
  description,
}: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,183,255,0.16),_transparent_36%),linear-gradient(180deg,_rgba(0,183,255,0.06),_transparent_40%),linear-gradient(135deg,_rgba(255,255,255,0.02),_transparent)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl gap-10 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <section className="flex flex-col justify-between rounded-[2rem] border border-white/8 bg-white/[0.03] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur md:p-10">
          <div className="space-y-8">
            <div className="flex items-center justify-between gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-3 text-sm font-medium tracking-[0.24em] text-white"
              >
                <span className="inline-flex size-11 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-base text-primary">
                  TT
                </span>
                PLAYTT
              </Link>
              <Badge className="border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] tracking-[0.18em] text-primary uppercase">
                {eyebrow}
              </Badge>
            </div>

            <div className="max-w-xl space-y-5">
              <h1 className="max-w-lg text-4xl font-semibold tracking-tight text-white md:text-6xl">
                Autonomous table tennis, from booking to unlock.
              </h1>
              <p className="max-w-lg text-base leading-7 text-white/70 md:text-lg">
                Book a private pod, pay in seconds, and walk into a space that
                powers itself on for your match.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/8 bg-black/20 p-4">
                <p className="text-2xl font-semibold text-white">30 / 60</p>
                <p className="mt-1 text-sm text-white/60">minute session blocks</p>
              </div>
              <div className="rounded-3xl border border-white/8 bg-black/20 p-4">
                <p className="text-2xl font-semibold text-white">T-2 min</p>
                <p className="mt-1 text-sm text-white/60">lights welcome players in</p>
              </div>
              <div className="rounded-3xl border border-white/8 bg-black/20 p-4">
                <p className="text-2xl font-semibold text-white">1 flow</p>
                <p className="mt-1 text-sm text-white/60">booking, payment, access</p>
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-[1.75rem] border border-primary/20 bg-primary/8 p-5">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              Why this matters
            </p>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/72">
              This first setup gives us a stable base to test account creation,
              sign-in, session handling, and protected pages before we move into
              booking availability and checkout.
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center lg:justify-end">
          <div className="w-full max-w-md space-y-5">
            <div className="space-y-2 px-1">
              <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                {eyebrow}
              </p>
              <h2 className="text-3xl font-semibold text-white">{title}</h2>
              <p className="text-sm leading-6 text-white/65">{description}</p>
            </div>

            {children}

            <div className="flex items-center justify-between px-1 text-xs text-white/45">
              <span>PlayTT MVP auth setup</span>
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
