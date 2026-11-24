"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { useAdminSearchFilter } from "@/components/admin/admin-context"
import { AdminCreateVenueDialog } from "@/components/admin/admin-catalog-forms"
import { AdminDashboardCard } from "@/components/admin/admin-dashboard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { OperatorVenue } from "@/server/operator/types"

export function AdminVenuesTable({
  venues,
  resourceCounts,
  canManageCatalog,
}: {
  venues: OperatorVenue[]
  resourceCounts: Record<string, number>
  canManageCatalog: boolean
}) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newVenueId, setNewVenueId] = useState<string | null>(null)
  const filtered = useAdminSearchFilter(venues, (venue) =>
    [venue.name, venue.address, venue.slug].join(" "),
  )
  const sorted = [...filtered].sort((a, b) => {
    if (a.id === newVenueId) return -1
    if (b.id === newVenueId) return 1
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  function handleCreated(venue: { id: string; name: string }) {
    setNewVenueId(venue.id)
    router.refresh()
    toast.success(`${venue.name} created`, {
      description: "Next, add its tables.",
      action: {
        label: "Add tables",
        onClick: () => router.push(`/admin/venues/${venue.id}`),
      },
    })
  }

  return (
    <>
      <AdminDashboardCard
        title={`All venues${venues.length > 0 ? ` (${venues.length})` : ""}`}
        action={
          canManageCatalog ? (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              Add venue
            </Button>
          ) : null
        }
      >
        {venues.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-medium">No venues yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your first location, then set up its tables and devices.
            </p>
            {canManageCatalog ? (
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                Add your first venue
              </Button>
            ) : null}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead className="hidden md:table-cell">Address</TableHead>
                <TableHead>Tables</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No venues match your search.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((venue) => {
                  const href = `/admin/venues/${venue.id}`
                  const tableCount = resourceCounts[venue.id] ?? 0
                  const isNew = venue.id === newVenueId
                  return (
                    <TableRow
                      key={venue.id}
                      onClick={() => router.push(href)}
                      className={`cursor-pointer ${isNew ? "bg-muted/40" : ""}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link
                            href={href}
                            className="font-medium hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {venue.name}
                          </Link>
                          {isNew ? <span className="text-[13px] text-muted-foreground">New</span> : null}
                        </div>
                        <p className="text-xs text-muted-foreground md:hidden">
                          {venue.address}
                        </p>
                      </TableCell>
                      <TableCell className="hidden max-w-xs truncate md:table-cell">
                        {venue.address}
                      </TableCell>
                      <TableCell>
                        {tableCount === 0 ? (
                          <span className="font-semibold">None yet</span>
                        ) : (
                          `${tableCount} table${tableCount === 1 ? "" : "s"}`
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={venue.isActive ? "default" : "outline"}>
                          {venue.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
                            <Link href={`/admin/devices?venueId=${venue.id}`}>Devices</Link>
                          </Button>
                          <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
                            <Link href={`/nvr?venueId=${venue.id}`}>Replay PC</Link>
                          </Button>
                          <Button asChild variant={tableCount === 0 ? "default" : "outline"} size="sm">
                            <Link href={href}>{tableCount === 0 ? "Add tables" : "Manage"}</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        )}
      </AdminDashboardCard>

      {canManageCatalog ? (
        <AdminCreateVenueDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCreated={handleCreated}
        />
      ) : null}
    </>
  )
}
