import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";

import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";

interface ProductShellProps {
  eyebrow?: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  variant?: "default" | "compact";
  children: ReactNode;
}

export function ProductShell({
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
  actions,
  variant = "default",
  children,
}: ProductShellProps) {
  if (variant === "compact") {
    return (
      <main className="relative min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col">
          <header className="product-shell-header flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              {backHref ? (
                <Button asChild variant="ghost" size="icon-sm" className="shrink-0 rounded-full">
                  <Link href={backHref} aria-label={backLabel ?? "Back"}>
                    <ArrowLeftIcon className="size-4" />
                  </Link>
                </Button>
              ) : null}
              <h1 className="truncate text-lg font-semibold tracking-[-0.02em] text-foreground">
                {title}
              </h1>
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          </header>

          {children}
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <div className="app-shell min-h-screen gap-8">
        <header className="quiet-panel flex flex-col gap-5 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <BrandMark size="compact" tone="light" />

              <div className="flex items-start gap-3">
                {backHref ? (
                  <Button asChild variant="ghost" size="icon-sm" className="mt-1 rounded-full">
                    <Link href={backHref} aria-label={backLabel ?? "Back"}>
                      <ArrowLeftIcon className="size-4" />
                    </Link>
                  </Button>
                ) : null}

                <div>
                  {eyebrow ? <p className="section-label">{eyebrow}</p> : null}
                  <h1
                    className={
                      eyebrow
                        ? "mt-2 text-3xl font-semibold tracking-[-0.03em] text-foreground"
                        : "text-3xl font-semibold tracking-[-0.03em] text-foreground"
                    }
                  >
                    {title}
                  </h1>
                  {description ? (
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{description}</p>
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
