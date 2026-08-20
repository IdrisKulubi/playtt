"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeftIcon, ListIcon, MagnifyingGlassIcon } from "@phosphor-icons/react"

import { useAdminShell } from "@/components/admin/admin-context"
import { AdminSidebarNav } from "@/components/admin/admin-sidebar"
import { ModeToggle } from "@/components/theme/mode-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function AdminHeader({
  title,
  subtitle,
  backHref,
  actions,
  searchable = true,
}: {
  title: string
  subtitle?: string
  backHref?: string
  actions?: ReactNode
  searchable?: boolean
}) {
  const { searchQuery, setSearchQuery } = useAdminShell()

  return (
    <header className="admin-console__header">
      <div className="admin-console__header-row">
        <div className="flex min-w-0 items-start gap-3">
          {backHref ? (
            <Button asChild variant="ghost" size="icon-sm" className="mt-0.5 rounded-full">
              <Link href={backHref} aria-label="Back">
                <ArrowLeftIcon className="size-4" />
              </Link>
            </Button>
          ) : null}
          <div className="min-w-0">
            <h1 className="admin-console__header-title">{title}</h1>
            {subtitle ? (
              <p className="admin-console__header-subtitle">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="admin-console__header-tools">
          {searchable ? (
            <label className="admin-console__search">
              <MagnifyingGlassIcon className="size-4 shrink-0 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search this page..."
                className="admin-console__search-input border-0 shadow-none focus-visible:ring-0"
              />
            </label>
          ) : null}
          <ModeToggle />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full lg:hidden">
                <ListIcon className="size-4" />
                <span className="sr-only">Open admin menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[18rem] p-0">
              <SheetHeader className="border-b border-border px-4 py-4 text-left">
                <SheetTitle>Admin menu</SheetTitle>
              </SheetHeader>
              <AdminSidebarNav />
            </SheetContent>
          </Sheet>
          {actions}
        </div>
      </div>
    </header>
  )
}
