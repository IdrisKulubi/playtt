"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AdminMember } from "@/server/admin/members-service"

export function AdminMembersPanel({
  members,
  canManage,
}: {
  members: AdminMember[]
  canManage: boolean
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [addEmail, setAddEmail] = useState("")

  const filtered = members.filter((member) => {
    if (!query.trim()) return true
    const needle = query.toLowerCase()
    return (
      member.name.toLowerCase().includes(needle) ||
      member.email.toLowerCase().includes(needle) ||
      (member.phone ?? "").toLowerCase().includes(needle)
    )
  })

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
        <Card>
          <CardHeader>
            <CardTitle>Add existing user as member</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row">
            <Input
              value={addEmail}
              onChange={(event) => setAddEmail(event.target.value)}
              placeholder="player@example.com"
            />
            <Button onClick={handleAddMember} disabled={isPending || !addEmail.trim()}>
              Add member
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Members ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, email, or phone"
          />
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
                    <Badge
                      variant={member.status === "active" ? "default" : "secondary"}
                    >
                      {member.status}
                    </Badge>
                  </TableCell>
                  {canManage ? (
                    <TableCell className="space-x-2">
                      {member.status === "active" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleUpdateMembership(member.id, { status: "disabled" })
                          }
                        >
                          Disable
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleUpdateMembership(member.id, { status: "active" })
                          }
                        >
                          Enable
                        </Button>
                      )}
                      {member.role === "customer" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleUpdateMembership(member.id, { role: "operator" })
                          }
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
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}

export function AdminMemberDetailForm({
  member,
  venues,
  canManage,
}: {
  member: AdminMember
  venues: { id: string; name: string }[]
  canManage: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [name, setName] = useState(member.name)
  const [phone, setPhone] = useState(member.phone ?? "")
  const [skillLevel, setSkillLevel] = useState(member.skillLevel)
  const [defaultLocationId, setDefaultLocationId] = useState(
    member.defaultLocationId ?? "",
  )

  if (!canManage) return null

  async function handleSave() {
    setMessage(null)
    const response = await fetch(`/api/admin/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone: phone || null,
        skillLevel,
        defaultLocationId: defaultLocationId || null,
      }),
    })
    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not save profile.")
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit member</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="member-name">Name</Label>
          <Input id="member-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="member-phone">Phone</Label>
          <Input
            id="member-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Skill level</Label>
          <Select value={skillLevel} onValueChange={(v) => setSkillLevel(v as typeof skillLevel)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Default venue</Label>
          <Select
            value={defaultLocationId || undefined}
            onValueChange={setDefaultLocationId}
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              {venues.map((venue) => (
                <SelectItem key={venue.id} value={venue.id}>
                  {venue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
        <Button onClick={handleSave} disabled={isPending}>
          Save changes
        </Button>
      </CardContent>
    </Card>
  )
}
