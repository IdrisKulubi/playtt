import Link from "next/link"
import {
  ArrowRightIcon,
  ChartBarIcon,
  UserCircleIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr"

const links = [
  {
    href: "/activity",
    title: "Replay and activity",
    copy: "Session history and Coach progress.",
    icon: ChartBarIcon,
  },
  {
    href: "/community",
    title: "Bring your crew",
    copy: "Plan a private session with your group.",
    icon: UsersThreeIcon,
  },
  {
    href: "/account",
    title: "Account settings",
    copy: "Details, notifications, and security.",
    icon: UserCircleIcon,
  },
] as const

export function DashboardQuickLinks() {
  return (
    <section className="quiet-panel divide-y divide-border">
      {links.map(({ href, title, copy, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="group flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-card/60 sm:px-5"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-4" weight="fill" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">
                {title}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                {copy}
              </span>
            </span>
          </span>
          <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
        </Link>
      ))}
    </section>
  )
}
