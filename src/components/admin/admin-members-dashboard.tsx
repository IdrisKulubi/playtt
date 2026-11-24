"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { DotsThreeIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { useAdminSearchFilter } from "@/components/admin/admin-context"
import { AdminDashboardCard } from "@/components/admin/admin-dashboard"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SegmentedControl, textActionClass } from "@/components/admin/admin-grouped"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
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
import type { AdminMember, AdminMemberRole } from "@/server/admin/members-service"

const PAGE_SIZE = 50

const ROLE_LABELS: Record<AdminMemberRole, string> = {
  customer: "Customer",
  operator: "Staff",
  support: "Support",
  owner: "Admin",
}

const ROLE_ORDER: AdminMemberRole[] = ["customer", "operator", "support", "owner"]

type Filter = "all" | "customers" | "team" | "disabled"

type BulkAction =
  | { action: "delete" }
  | { action: "disable" }
  | { action: "enable" }
  | { action: "set_role"; role: AdminMemberRole }

type PendingConfirm = { members: AdminMember[]; bulk: BulkAction }

type BulkResult = {
  succeeded: string[]
  skipped: { membershipId: string; name: string; reason: string }[]
}

function actionVerb(bulk: BulkAction) {
  switch (bulk.action) {
    case "delete":
      return "Delete"
    case "disable":
      return "Disable"
    case "enable":
      return "Enable"
    case "set_role":
      return `Make ${ROLE_LABELS[bulk.role]}`
  }
}

function namesPreview(members: AdminMember[]) {
  const names = members.slice(0, 5).map((member) => member.name || member.email)
  const extra = members.length - names.length
  return extra > 0 ? `${names.join(", ")} and ${extra} more` : names.join(", ")
}

export function AdminMembersDashboard({
  members,
  canManage,
  currentUserId,
}: {
  members: AdminMember[]
  canManage: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [working, setWorking] = useState(false)
  const [addEmail, setAddEmail] = useState("")
  const [addRole, setAddRole] = useState<AdminMemberRole>("customer")
  const [filter, setFilter] = useState<Filter>("all")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null)
  const [skipped, setSkipped] = useState<BulkResult["skipped"]>([])

  const searched = useAdminSearchFilter(members, (member) =>
    [member.name, member.email, member.phone ?? "", ROLE_LABELS[member.role], member.status].join(" "),
  )

  const counts = useMemo(
    () => ({
      all: searched.length,
      customers: searched.filter((m) => m.role === "customer" && m.status === "active").length,
      team: searched.filter((m) => m.role !== "customer").length,
      disabled: searched.filter((m) => m.status !== "active").length,
    }),
    [searched],
  )

  const filtered = useMemo(
    () =>
      searched.filter((member) => {
        if (filter === "customers") return member.role === "customer" && member.status === "active"
        if (filter === "team") return member.role !== "customer"
        if (filter === "disabled") return member.status !== "active"
        return true
      }),
    [searched, filter],
  )
  const visible = filtered.slice(0, visibleCount)
  const selectedMembers = members.filter((member) => selected.has(member.id))
  const selectableVisible = visible.filter((member) => member.userId !== currentUserId)
  const allVisibleSelected =
    selectableVisible.length > 0 && selectableVisible.every((member) => selected.has(member.id))
  const someVisibleSelected = selectableVisible.some((member) => selected.has(member.id))

  function changeFilter(next: Filter) {
    setFilter(next)
    setVisibleCount(PAGE_SIZE)
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAllVisible(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      for (const member of selectableVisible) {
        if (checked) next.add(member.id)
        else next.delete(member.id)
      }
      return next
    })
  }

  async function handleAddMember(event: React.FormEvent) {
    event.preventDefault()
    setWorking(true)
    try {
      const response = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail.trim(), role: addRole }),
      })
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { message?: string }
        toast.error(error.message ?? "Could not add member.")
        return
      }
      toast.success(`${addEmail.trim()} added as ${ROLE_LABELS[addRole]}.`)
      setAddEmail("")
      setAddRole("customer")
      startTransition(() => router.refresh())
    } finally {
      setWorking(false)
    }
  }

  // Actions that are risky or touch many people go through a confirmation.
  function request(membersToChange: AdminMember[], bulk: BulkAction) {
    if (membersToChange.length === 0) return
    const needsConfirm =
      bulk.action === "delete" ||
      (bulk.action === "set_role" && bulk.role === "owner") ||
      membersToChange.length > 1 ||
      bulk.action === "disable"
    if (needsConfirm) {
      setConfirm({ members: membersToChange, bulk })
    } else {
      void run(membersToChange, bulk)
    }
  }

  async function run(membersToChange: AdminMember[], bulk: BulkAction) {
    setWorking(true)
    setSkipped([])
    try {
      const response = await fetch("/api/admin/members/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...bulk, membershipIds: membersToChange.map((m) => m.id) }),
      })
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { message?: string }
        toast.error(error.message ?? "Could not update members.")
        return
      }
      const payload = (await response.json()) as { data: BulkResult }
      const { succeeded, skipped: refused } = payload.data
      const verb = actionVerb(bulk).toLowerCase()
      if (succeeded.length > 0) {
        const pastTense =
          bulk.action === "delete"
            ? "deleted"
            : bulk.action === "disable"
              ? "disabled"
              : bulk.action === "enable"
                ? "enabled"
                : `changed to ${ROLE_LABELS[bulk.role]}`
        toast.success(
          `${succeeded.length} member${succeeded.length === 1 ? "" : "s"} ${pastTense}.`,
        )
      }
      if (refused.length > 0) {
        toast.warning(`${refused.length} couldn't ${verb === "delete" ? "be deleted" : "be changed"}. See details above the table.`)
        setSkipped(refused)
      }
      setSelected((current) => {
        const next = new Set(current)
        for (const id of succeeded) next.delete(id)
        return next
      })
      startTransition(() => router.refresh())
    } finally {
      setWorking(false)
    }
  }

  const busy = working || isPending
  const filterTabs: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "customers", label: "Customers" },
    { id: "team", label: "Staff & admins" },
    { id: "disabled", label: "Disabled" },
  ]

  return (
    <div className="space-y-6">
      {canManage ? (
        <AdminDashboardCard title="Add existing user">
          <form onSubmit={handleAddMember} className="flex flex-col gap-3 p-5 md:flex-row">
            <Input
              type="email"
              value={addEmail}
              onChange={(event) => setAddEmail(event.target.value)}
              placeholder="player@example.com"
              aria-label="Email of an existing PlayTT account"
            />
            <Select value={addRole} onValueChange={(value) => setAddRole(value as AdminMemberRole)}>
              <SelectTrigger className="md:w-40" aria-label="Role for the new member">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_ORDER.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={busy || !addEmail.trim()}>
              Add member
            </Button>
          </form>
        </AdminDashboardCard>
      ) : null}

      <AdminDashboardCard title={`Members (${filtered.length})`}>
        <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-3 md:flex-row md:items-center md:justify-between">
          <SegmentedControl<Filter>
            label="Member filters"
            value={filter}
            onChange={changeFilter}
            options={filterTabs.map((tab) => ({ value: tab.id, label: tab.label, count: counts[tab.id] }))}
          />
          <p className="text-[13px] text-muted-foreground">
            Search by name, email or phone with the box at the top.
          </p>
        </div>

        {canManage && selected.size > 0 ? (
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border/60 bg-background/75 px-5 py-3 backdrop-blur-xl backdrop-saturate-150">
            <span className="text-[15px] font-semibold">{selected.size} selected</span>
            <button type="button" className={textActionClass} disabled={busy} onClick={() => request(selectedMembers, { action: "enable" })}>
              Enable
            </button>
            <button type="button" className={textActionClass} disabled={busy} onClick={() => request(selectedMembers, { action: "disable" })}>
              Disable
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={textActionClass} disabled={busy}>
                  Change role
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {ROLE_ORDER.map((role) => (
                  <DropdownMenuItem key={role} onSelect={() => request(selectedMembers, { action: "set_role", role })}>
                    Make {ROLE_LABELS[role]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              className="text-[13px] font-medium text-destructive transition-opacity active:opacity-50 disabled:opacity-40"
              disabled={busy}
              onClick={() => request(selectedMembers, { action: "delete" })}
            >
              Delete
            </button>
            <button type="button" className="ml-auto text-[13px] text-muted-foreground" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        ) : null}

        {skipped.length > 0 ? (
          <div className="mx-5 mt-4 rounded-xl bg-muted/60 px-4 py-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">Some members were not changed:</p>
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSkipped([])}>
                Dismiss
              </button>
            </div>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
              {skipped.map((item) => (
                <li key={item.membershipId}>
                  <span className="text-foreground">{item.name}</span>: {item.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              {canManage ? (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                    onCheckedChange={(value) => toggleAllVisible(value === true)}
                    aria-label="Select all shown members"
                  />
                </TableHead>
              ) : null}
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Joined</TableHead>
              {canManage ? (
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No members match.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((member) => {
                const isSelf = member.userId === currentUserId
                const isChecked = selected.has(member.id)
                return (
                  <TableRow key={member.id} data-state={isChecked ? "selected" : undefined}>
                    {canManage ? (
                      <TableCell>
                        <Checkbox
                          checked={isChecked}
                          disabled={isSelf}
                          onCheckedChange={(value) => toggleOne(member.id, value === true)}
                          aria-label={`Select ${member.name}`}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/members/${member.id}`} className="font-medium hover:underline">
                          {member.name || "No name"}
                        </Link>
                        {isSelf ? <span className="text-[13px] text-muted-foreground">You</span> : null}
                      </div>
                      <p className="text-xs text-muted-foreground md:hidden">{member.email}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{member.email}</TableCell>
                    <TableCell className={member.role === "customer" ? "text-muted-foreground" : "font-medium"}>
                      {ROLE_LABELS[member.role]}
                    </TableCell>
                    <TableCell className={member.status === "active" ? "text-muted-foreground" : "font-semibold"}>
                      {member.status === "active" ? "Active" : "Disabled"}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {new Date(member.createdAt).toLocaleDateString()}
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" disabled={busy} aria-label={`Actions for ${member.name}`}>
                              <DotsThreeIcon size={20} weight="bold" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-44">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/members/${member.id}`}>View profile</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs text-muted-foreground">Role</DropdownMenuLabel>
                            {ROLE_ORDER.filter((role) => role !== member.role).map((role) => (
                              <DropdownMenuItem key={role} onSelect={() => request([member], { action: "set_role", role })}>
                                Make {ROLE_LABELS[role]}
                              </DropdownMenuItem>
                            ))}
                            {!isSelf ? (
                              <>
                                <DropdownMenuSeparator />
                                {member.status === "active" ? (
                                  <DropdownMenuItem onSelect={() => request([member], { action: "disable" })}>
                                    Disable
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onSelect={() => request([member], { action: "enable" })}>
                                    Enable
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => request([member], { action: "delete" })}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {filtered.length > visibleCount ? (
          <div className="flex items-center justify-center gap-3 border-t border-border px-5 py-4 text-sm text-muted-foreground">
            Showing {visible.length} of {filtered.length}
            <Button size="sm" variant="outline" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
              Show more
            </Button>
          </div>
        ) : null}
      </AdminDashboardCard>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => (!open ? setConfirm(null) : null)}>
        <AlertDialogContent>
          {confirm ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {actionVerb(confirm.bulk)} {confirm.members.length === 1 ? (confirm.members[0].name || "this member") : `${confirm.members.length} members`}?
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    {confirm.members.length > 1 ? <p>{namesPreview(confirm.members)}</p> : null}
                    {confirm.bulk.action === "delete" ? (
                      <p>
                        Their name, email, phone and photo are permanently erased and they can no longer sign in.
                        Past bookings and payments are kept for your records. This cannot be undone. Admins and
                        anyone with an upcoming booking will be skipped.
                      </p>
                    ) : confirm.bulk.action === "disable" ? (
                      <p>They are signed out immediately and can&apos;t sign in until you enable them again.</p>
                    ) : confirm.bulk.action === "set_role" && confirm.bulk.role === "owner" ? (
                      <p>Admins get full access to this dashboard, including members, payments and venues.</p>
                    ) : (
                      <p>This applies to everyone listed.</p>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant={confirm.bulk.action === "delete" || confirm.bulk.action === "disable" ? "destructive" : "default"}
                  onClick={() => {
                    const pending = confirm
                    setConfirm(null)
                    void run(pending.members, pending.bulk)
                  }}
                >
                  {actionVerb(confirm.bulk)}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
