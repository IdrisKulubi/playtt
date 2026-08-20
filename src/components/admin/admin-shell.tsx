"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeftIcon,
  BuildingsIcon,
  CalendarBlankIcon,
  ChartLineUpIcon,
  CpuIcon,
  FlagIcon,
  GaugeIcon,
  PlugsIcon,
  QueueIcon,
  ShapesIcon,
  UsersThreeIcon,
  WalletIcon,
} from "@phosphor-icons/react"

import { BrandMark } from "@/components/layout/brand-mark"
import { Button } from "@/components/ui/button"

const navigation = [
  { href: "/admin", label: "Overview", icon: GaugeIcon, exact: true as const },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarBlankIcon, exact: false as const },
  { href: "/admin/revenue", label: "Revenue", icon: WalletIcon, exact: false as const },
  { href: "/admin/venues", label: "Venues", icon: BuildingsIcon, exact: false as const },
  { href: "/admin/devices", label: "Devices", icon: CpuIcon, exact: false as const },
  { href: "/admin/members", label: "Members", icon: UsersThreeIcon, exact: false as const },
  { href: "/admin/vendors", label: "Vendors", icon: PlugsIcon, exact: false as const },
  { href: "/admin/resource-types", label: "Resource types", icon: ShapesIcon, exact: false as const },
  { href: "/admin/feature-flags", label: "Feature flags", icon: FlagIcon, exact: false as const },
  { href: "/admin/durable-work", label: "Durable work", icon: QueueIcon, exact: false as const },
] as const

type AdminShellProps = {
  title: string
  eyebrow?: string
  backHref?: string
  children: ReactNode
}

export function AdminShell({
  title,
  eyebrow,
  backHref,
  children,
}: AdminShellProps) {
  const pathname = usePathname()

  return (
    <main className="player-shell">
      <aside className="player-shell__sidebar">
        <BrandMark size="compact" tone="light" />
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Admin
        </p>
        <nav
          aria-label="Admin navigation"
          className="player-shell__nav max-h-[calc(100vh-12rem)] overflow-y-auto"
        >
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

      <nav
        aria-label="Admin navigation"
        className="player-shell__mobile-nav overflow-x-auto"
      >
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

export function AdminOverviewMetricsCards({
  metrics,
}: {
  metrics: {
    todayBookings: number
    activeSessions: number
    revenueLast7Days: number
    revenueLast30Days: number
    activeDevices: number
    pendingDevices: number
    venueCount: number
    memberCount: number
  }
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard title="Today's bookings" value={String(metrics.todayBookings)} />
      <MetricCard title="Active sessions" value={String(metrics.activeSessions)} />
      <MetricCard
        title="Revenue (7 days)"
        value={`KES ${metrics.revenueLast7Days.toLocaleString()}`}
        icon={ChartLineUpIcon}
      />
      <MetricCard
        title="Revenue (30 days)"
        value={`KES ${metrics.revenueLast30Days.toLocaleString()}`}
        icon={WalletIcon}
      />
      <MetricCard title="Venues" value={String(metrics.venueCount)} />
      <MetricCard title="Members" value={String(metrics.memberCount)} />
      <MetricCard title="Active devices" value={String(metrics.activeDevices)} />
      <MetricCard title="Pending devices" value={String(metrics.pendingDevices)} />
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: string
  icon?: typeof GaugeIcon
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-background/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{title}</p>
        {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}
