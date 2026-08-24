"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Icon } from "@phosphor-icons/react"
import {
  BuildingsIcon,
  CalendarBlankIcon,
  CpuIcon,
  FlagIcon,
  GaugeIcon,
  HeartbeatIcon,
  PlugsIcon,
  QueueIcon,
  ShapesIcon,
  UsersThreeIcon,
  WalletIcon,
} from "@phosphor-icons/react"

import { BrandMark } from "@/components/layout/brand-mark"

type NavItem = {
  href: string
  label: string
  icon: Icon
  exact?: boolean
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const navigationGroups: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { href: "/admin", label: "Overview", icon: GaugeIcon, exact: true },
      { href: "/admin/health", label: "Health", icon: HeartbeatIcon },
      { href: "/admin/bookings", label: "Bookings", icon: CalendarBlankIcon },
      { href: "/admin/revenue", label: "Revenue", icon: WalletIcon },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/venues", label: "Venues", icon: BuildingsIcon },
      { href: "/admin/devices", label: "Devices", icon: CpuIcon },
      { href: "/admin/vendors", label: "Vendors", icon: PlugsIcon },
    ],
  },
  {
    label: "People",
    items: [{ href: "/admin/members", label: "Members", icon: UsersThreeIcon }],
  },
  {
    label: "System",
    items: [
      { href: "/admin/resource-types", label: "Resource types", icon: ShapesIcon },
      { href: "/admin/feature-flags", label: "Feature flags", icon: FlagIcon },
      { href: "/admin/durable-work", label: "Durable work", icon: QueueIcon },
    ],
  },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <>
      {navigationGroups.map((group) => (
        <div key={group.label} className="admin-console__nav-group">
          <p className="admin-console__nav-label">{group.label}</p>
          {group.items.map(({ href, label, icon: IconComponent, exact }) => {
            const active = exact
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`)

            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={
                  active
                    ? "admin-console__nav-link admin-console__nav-link--active"
                    : "admin-console__nav-link"
                }
              >
                <IconComponent
                  className="size-4 shrink-0"
                  weight={active ? "fill" : "regular"}
                />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </>
  )
}

export function AdminSidebar({
  userName,
  userEmail,
}: {
  userName: string
  userEmail: string
}) {
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <aside className="admin-console__sidebar">
      <div className="admin-console__sidebar-brand">
        <BrandMark href="/admin" size="compact" tone="light" caption="" />
        <p className="mt-3 px-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Admin console
        </p>
      </div>

      <nav aria-label="Admin navigation" className="mt-2 flex-1 overflow-y-auto">
        <NavLinks />
      </nav>

      <div className="admin-console__sidebar-footer">
        <div className="admin-console__user">
          <div className="admin-console__user-avatar">{initials || "AD"}</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          </div>
        </div>
        <Link href="/dashboard" className="admin-console__player-link">
          Back to player app
        </Link>
      </div>
    </aside>
  )
}

export function AdminSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin navigation" className="px-2 py-4">
      <NavLinks onNavigate={onNavigate} />
    </nav>
  )
}

export const adminMobileNavItems = [
  { href: "/admin", label: "Overview", icon: GaugeIcon, exact: true as const },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarBlankIcon, exact: false as const },
  { href: "/admin/venues", label: "Venues", icon: BuildingsIcon, exact: false as const },
  { href: "/admin/members", label: "Members", icon: UsersThreeIcon, exact: false as const },
  { href: "/admin/devices", label: "More", icon: PlugsIcon, exact: false as const },
]
