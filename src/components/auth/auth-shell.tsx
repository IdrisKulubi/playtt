import type { ReactNode } from "react";
import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";

interface AuthShellProps {
  children: ReactNode;
  title: string;
  description: string;
}

const trustSignals = ["Private pods", "Clear pricing", "Mobile booking"] as const;

export function AuthShell({ children, title, description }: AuthShellProps) {
  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <div className="app-shell min-h-screen justify-center gap-10 lg:grid lg:grid-cols-[1fr_0.92fr] lg:items-center">
        <section className="dark quiet-panel hidden flex-col justify-between p-8 md:flex md:p-10">
          <div className="space-y-6">
            <BrandMark tone="dark" />
            <div className="max-w-md space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                Private table tennis, booked in minutes.
              </h1>
              <p className="text-sm leading-7 text-muted-foreground">
                Calm steps from venue to checkout. Your account keeps bookings in one place.
              </p>
            </div>
            <ul className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {trustSignals.map((signal, index) => (
                <li key={signal} className="flex items-center gap-2">
                  {index > 0 ? <span aria-hidden className="text-border">·</span> : null}
                  <span>{signal}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="flex w-full flex-col justify-center px-1 lg:max-w-md lg:justify-self-end">
          <div className="mb-6 space-y-2 lg:mb-8">
            <BrandMark size="compact" tone="light" className="mb-4 md:hidden" />
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </div>

          {children}

          <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
            <span>PlayTT account</span>
            <Button asChild variant="link" className="h-auto p-0 text-primary">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
