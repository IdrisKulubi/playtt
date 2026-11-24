"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import type { Icon } from "@phosphor-icons/react"
import {
  ArrowSquareOutIcon,
  BellIcon,
  DotsThreeIcon,
  FilmSlateIcon,
  SignOutIcon,
  BuildingsIcon,
  CalendarBlankIcon,
  CpuIcon,
  HardDrivesIcon,
  FlagIcon,
  GaugeIcon,
  GlobeHemisphereWestIcon,
  HeartbeatIcon,
  MedalIcon,
  PlugsIcon,
  DoorOpenIcon,
  QueueIcon,
  ShapesIcon,
  UsersThreeIcon,
  WalletIcon,
} from "@phosphor-icons/react"

import { BrandMark } from "@/components/layout/brand-mark"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"

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
      { href: "/admin/alerts", label: "Alerts", icon: BellIcon },
      { href: "/admin/environment", label: "Environment", icon: GlobeHemisphereWestIcon },
      { href: "/admin/certification", label: "Certification", icon: MedalIcon },
      { href: "/admin/bookings", label: "Bookings", icon: CalendarBlankIcon },
      { href: "/admin/revenue", label: "Revenue", icon: WalletIcon },
      { href: "/admin/clips", label: "Replay clips", icon: FilmSlateIcon },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/venues", label: "Venues", icon: BuildingsIcon },
      { href: "/nvr", label: "VenueEdge", icon: HardDrivesIcon },
      { href: "/admin/devices", label: "Devices", icon: CpuIcon },
      { href: "/admin/access", label: "Venue access", icon: DoorOpenIcon },
      { href: "/admin/vendors", label: "Vendors", icon: PlugsIcon },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/admin/members", label: "Members", icon: UsersThreeIcon },
      { href: "/admin/community/reports", label: "Community reports", icon: FlagIcon },
      { href: "/admin/community/events", label: "Community events", icon: CalendarBlankIcon },
    ],
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
        <AdminUserMenu userName={userName} userEmail={userEmail} />
      </div>
    </aside>
  )
}

/** Name and email with a ⋯ menu for the less frequent account actions. */
function AdminUserMenu({
  userName,
  userEmail,
}: {
  userName: string
  userEmail: string
}) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const result = await authClient.signOut()
    if (result.error) {
      setSigningOut(false)
      toast.error(result.error.message || "Couldn't sign out. Try again.")
      return
    }
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors duration-100 hover:bg-muted/50 active:bg-muted data-[state=open]:bg-muted/60"
          aria-label={`Account menu for ${userName}`}
        >
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[13px] font-medium">{userName}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{userEmail}</span>
          </span>
          <DotsThreeIcon size={18} weight="bold" className="shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <ArrowSquareOutIcon />
            Back to player app
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={signingOut}
          onSelect={(event) => {
            event.preventDefault()
            void handleSignOut()
          }}
        >
          <SignOutIcon />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
  { href: "/admin/health", label: "Health", icon: HeartbeatIcon, exact: false as const },
  { href: "/admin/certification", label: "Certify", icon: MedalIcon, exact: false as const },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarBlankIcon, exact: false as const },
  { href: "/admin/venues", label: "Venues", icon: BuildingsIcon, exact: false as const },
]
