"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { AdminShellProvider } from "@/components/admin/admin-context"
import { AdminHeader } from "@/components/admin/admin-header"
import { AdminSidebar, adminMobileNavItems } from "@/components/admin/admin-sidebar"

export type AdminShellProps = {
  title: string
  subtitle?: string
  backHref?: string
  actions?: ReactNode
  searchable?: boolean
  user: {
    name: string
    email: string
  }
  children: ReactNode
}

export function AdminShell({
  title,
  subtitle,
  backHref,
  actions,
  searchable = true,
  user,
  children,
}: AdminShellProps) {
  const pathname = usePathname()

  return (
    <AdminShellProvider>
      <div className="admin-console">
        <AdminSidebar userName={user.name} userEmail={user.email} />

        <div className="admin-console__main">
          <AdminHeader
            title={title}
            subtitle={subtitle}
            backHref={backHref}
            actions={actions}
            searchable={searchable}
          />
          <div className="admin-console__content">{children}</div>
        </div>

        <nav aria-label="Admin mobile navigation" className="admin-console__mobile-nav">
          {adminMobileNavItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`)

            return (
              <Link
                key={href}
                href={href}
                className={
                  active
                    ? "admin-console__mobile-link admin-console__mobile-link--active"
                    : "admin-console__mobile-link"
                }
              >
                <Icon className="size-4" weight={active ? "fill" : "regular"} />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </AdminShellProvider>
  )
}
