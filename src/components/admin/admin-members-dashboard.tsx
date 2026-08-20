"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { useAdminSearchFilter } from "@/components/admin/admin-context"
import { AdminDashboardCard } from "@/components/admin/admin-dashboard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AdminMember } from "@/server/admin/members-service"

export function AdminMembersDashboard({
  members,
  canManage,
}: {
  members: AdminMember[]
  canManage: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [addEmail, setAddEmail] = useState("")
  const filtered = useAdminSearchFilter(members, (member) =>
    [member.name, member.email, member.phone ?? "", member.role, member.status].join(" "),
  )

  async function handleAddMember() {
    setMessage(null)
    const response = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: addEmail }),
    })
    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not add member.")
      return
    }
    setAddEmail("")
    startTransition(() => router.refresh())
  }

  async function handleUpdateMembership(
    membershipId: string,
    patch: { role?: AdminMember["role"]; status?: AdminMember["status"] },
  ) {
    setMessage(null)
    const response = await fetch(`/api/admin/members/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not update member.")
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <AdminDashboardCard title="Add existing user">
          <div className="flex flex-col gap-3 p-5 md:flex-row">
            <Input
              value={addEmail}
              onChange={(event) => setAddEmail(event.target.value)}
              placeholder="player@example.com"
            />
            <Button onClick={handleAddMember} disabled={isPending || !addEmail.trim()}>
              Add member
            </Button>
          </div>
        </AdminDashboardCard>
      ) : null}

      <AdminDashboardCard title={`Members (${filtered.length})`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? <TableHead>Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <Link href={`/admin/members/${member.id}`} className="font-medium hover:underline">
                    {member.name}
                  </Link>
                </TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{member.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={member.status === "active" ? "default" : "secondary"}>
                    {member.status}
                  </Badge>
                </TableCell>
                {canManage ? (
                  <TableCell className="space-x-2">
                    {member.status === "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateMembership(member.id, { status: "disabled" })}
                      >
                        Disable
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateMembership(member.id, { status: "active" })}
                      >
                        Enable
                      </Button>
                    )}
                    {member.role === "customer" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateMembership(member.id, { role: "operator" })}
                      >
                        Make staff
                      </Button>
                    ) : null}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {message ? <p className="px-5 pb-4 text-sm text-destructive">{message}</p> : null}
      </AdminDashboardCard>
    </div>
  )
}
