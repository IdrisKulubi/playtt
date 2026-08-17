"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeftIcon,
  BuildingsIcon,
  FlagIcon,
  GaugeIcon,
  QueueIcon,
  ShapesIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react"

import { BrandMark } from "@/components/layout/brand-mark"
import { Button } from "@/components/ui/button"

const navigation = [
  { href: "/operator", label: "Overview", icon: GaugeIcon, exact: true as const },
  { href: "/operator/venues", label: "Venues", icon: BuildingsIcon, exact: false as const },
  { href: "/operator/resource-types", label: "Resource types", icon: ShapesIcon, exact: false as const },
  { href: "/operator/memberships", label: "Memberships", icon: UsersThreeIcon, exact: false as const },
  { href: "/operator/feature-flags", label: "Feature flags", icon: FlagIcon, exact: false as const },
  { href: "/operator/durable-work", label: "Durable work", icon: QueueIcon, exact: false as const },
] as const

type OperatorShellProps = {
  title: string
  eyebrow?: string
  backHref?: string
  children: ReactNode
}

export function OperatorShell({
  title,
  eyebrow,
  backHref,
  children,
}: OperatorShellProps) {
  const pathname = usePathname()

  return (
    <main className="player-shell">
      <aside className="player-shell__sidebar">
        <BrandMark size="compact" tone="light" />
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Operator
        </p>
        <nav aria-label="Operator navigation" className="player-shell__nav">
          {navigation.map(({ href, label, icon: Icon, exact }) => {
            const active = exact
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`)

            return (
              <Link
                key={href}
                href={href}
                className={
                  active
                    ? "player-shell__nav-link player-shell__nav-link--active"
                    : "player-shell__nav-link"
                }
              >
                <Icon className="size-5" weight={active ? "fill" : "regular"} />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        <Link href="/dashboard" className="player-shell__book-link">
          Back to player app
        </Link>
      </aside>

      <section className="player-shell__main" data-player-shell-content>
        <header className="player-shell__header">
          <div className="flex min-w-0 items-center gap-3">
            {backHref ? (
              <Button asChild variant="ghost" size="icon-sm" className="rounded-full">
                <Link href={backHref} aria-label="Back">
                  <ArrowLeftIcon className="size-4" />
                </Link>
              </Button>
            ) : null}
            <div className="min-w-0">
              {eyebrow ? <p className="player-shell__eyebrow">{eyebrow}</p> : null}
              <h1>{title}</h1>
            </div>
          </div>
        </header>

        <div className="player-shell__content">{children}</div>
      </section>

      <nav aria-label="Operator navigation" className="player-shell__mobile-nav">
        {navigation.map(({ href, label, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`)

          return (
            <Link
              key={href}
              href={href}
              className={
                active
                  ? "player-shell__mobile-link player-shell__mobile-link--active"
                  : "player-shell__mobile-link"
              }
            >
              <Icon className="size-5" weight={active ? "fill" : "regular"} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </main>
  )
}
