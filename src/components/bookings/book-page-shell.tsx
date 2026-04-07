"use client";

import Link from "next/link";
import {
  ArrowLeftIcon,
  ClockCountdownIcon,
  MapPinIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

const highlights = [
  {
    title: "Pick your venue",
    copy: "Start with the location that works for you—only real-time availability for that club is shown next.",
    icon: MapPinIcon,
  },
  {
    title: "See open times",
    copy: "Each time shows how many tables are still open, so you always know what you are booking into.",
    icon: ClockCountdownIcon,
  },
  {
    title: "Fair group pricing",
    copy: "Larger groups see any add-on fees before you confirm—no surprises at checkout.",
    icon: UsersThreeIcon,
  },
] as const;

export function BookPageShell() {
  return (
    <>
      <header className="glass-panel flex flex-col gap-6 px-5 py-6 sm:flex-row sm:items-start sm:justify-between sm:px-8 sm:py-7">
        <div className="min-w-0 flex-1">
          <p className="section-label">Book a table</p>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
            Reserve your next session in a few steps
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-white/55 sm:text-[15px]">
            Choose where and when you want to play, set your group size, then review pricing before you
            hold the slot.
          </p>
        </div>

        <Button asChild variant="ghost" className="shrink-0 self-start rounded-full">
          <Link href="/dashboard">
            <ArrowLeftIcon className="mr-2 size-4" />
            Back
          </Link>
        </Button>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        {highlights.map(({ title, copy, icon: Icon }) => (
          <article
            key={title}
            className="premium-card border-white/[0.07] p-6 transition hover:border-white/15"
          >
            <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/[0.08] text-primary">
              <Icon className="size-5" weight="fill" />
            </div>
            <h2 className="mt-5 text-base font-semibold tracking-tight text-white">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/50">{copy}</p>
          </article>
        ))}
      </section>
    </>
  );
}
