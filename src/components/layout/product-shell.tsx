import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";

import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";

interface ProductShellProps {
  eyebrow: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function ProductShell({
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
  actions,
  children,
}: ProductShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden text-foreground">
      <div className="hero-orb left-[-8rem] top-8 h-72 w-72 bg-primary/16" />
      <div className="hero-orb right-[-9rem] top-48 h-80 w-80 bg-sky-500/10" />
      <div className="playtt-grid absolute inset-0 opacity-25" />

      <div className="app-shell min-h-screen gap-8">
        <header className="glass-panel flex flex-col gap-5 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <BrandMark size="compact" />

              <div className="flex items-start gap-3">
                {backHref ? (
                  <Button asChild variant="ghost" size="icon-sm" className="mt-1 rounded-full text-white/70">
                    <Link href={backHref} aria-label={backLabel ?? "Back"}>
                      <ArrowLeftIcon className="size-4" />
                    </Link>
                  </Button>
                ) : null}

                <div>
                  <p className="section-label">{eyebrow}</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white">
                    {title}
                  </h1>
                  {description ? (
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-white/60">
                      {description}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
