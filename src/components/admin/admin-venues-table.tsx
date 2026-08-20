"use client"

import Link from "next/link"

import { useAdminSearchFilter } from "@/components/admin/admin-context"
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
  const filtered = useAdminSearchFilter(venues, (venue) =>
    [venue.name, venue.address, venue.slug].join(" "),
  )

  return (
    <AdminDashboardCard
      title="All venues"
      action={
        canManageCatalog ? (
          <Button asChild size="sm">
            <Link href="/admin/venues/new">Add venue</Link>
          </Button>
        ) : null
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Venue</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Tables</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                {venues.length === 0 ? "No venues configured yet." : "No venues match your search."}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((venue) => (
              <TableRow key={venue.id}>
                <TableCell>
                  <Link href={`/admin/venues/${venue.id}`} className="font-medium hover:underline">
                    {venue.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{venue.slug}</p>
                </TableCell>
                <TableCell className="max-w-xs truncate">{venue.address}</TableCell>
                <TableCell>{resourceCounts[venue.id] ?? 0}</TableCell>
                <TableCell>
                  <Badge variant={venue.isActive ? "default" : "outline"}>
                    {venue.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/venues/${venue.id}`}>Manage</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </AdminDashboardCard>
  )
}
