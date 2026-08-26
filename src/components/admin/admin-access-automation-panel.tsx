"use client"

import { type FormEvent, useCallback, useEffect, useState } from "react"
import {
  ArrowClockwiseIcon,
  DoorOpenIcon,
  KeyIcon,
  SpinnerGapIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AccessOperationsSnapshot } from "@/server/access/admin-contract"

type ApiResponse<T> = { data?: T; message?: string }

const EMPTY_OPERATIONS: AccessOperationsSnapshot = {
  connections: [],
  gateways: [],
  locks: [],
  accessPoints: [],
  grants: [],
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiResponse<T>
  if (!response.ok || !body.data) {
    throw new Error(body.message ?? "The access operation failed.")
  }
  return body.data
}

export function AdminAccessAutomationPanel({
  liveAccessEnabled,
  ttlockEnabled,
  remoteUnlockEnabled,
}: {
  liveAccessEnabled: boolean
  ttlockEnabled: boolean
  remoteUnlockEnabled: boolean
}) {
  const [operations, setOperations] = useState(EMPTY_OPERATIONS)
  const [loading, setLoading] = useState(liveAccessEnabled)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [assignmentByLock, setAssignmentByLock] = useState<Record<string, string>>({})
  const [remoteUnlock, setRemoteUnlock] = useState({
    lockId: "",
    accessPointId: "",
    reason: "",
    otpChallengeId: "",
    otpCode: "",
  })

  const refresh = useCallback(async () => {
    if (!liveAccessEnabled) return
    setLoading(true)
    try {
      const response = await fetch("/api/admin/access/operations", {
        cache: "no-store",
      })
      const data = await readResponse<{ operations: AccessOperationsSnapshot }>(
        response,
      )
      setOperations(data.operations)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load access.")
    } finally {
      setLoading(false)
    }
  }, [liveAccessEnabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function commission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const input = Object.fromEntries(new FormData(form))
    setBusyKey("commission")
    try {
      await readResponse(
        await fetch("/api/admin/access/connections", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        }),
      )
      form.reset()
      toast.success("TTLock account connected. Credentials were not retained.")
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection failed.")
    } finally {
      setBusyKey(null)
    }
  }

  async function postAction(path: string, body: Record<string, unknown>, key: string) {
    setBusyKey(key)
    try {
      await readResponse(
        await fetch(path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      )
      toast.success("Access operation queued.")
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operation failed.")
    } finally {
      setBusyKey(null)
    }
  }

  if (!liveAccessEnabled) {
    return (
      <div className="admin-dashboard-card p-6">
        <p className="section-label">Safe rollout</p>
        <h2 className="mt-2 text-xl font-semibold">Live access is disabled</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Enable the live access feature for this tenant after simulator certification.
          TTLock, notifications, relays, and remote unlock remain independently gated.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Connections", operations.connections.length],
          ["Gateways", operations.gateways.length],
          ["Locks", operations.locks.length],
          ["Access grants", operations.grants.length],
        ].map(([label, value]) => (
          <div key={label} className="admin-dashboard-card p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      {ttlockEnabled ? (
        <section className="admin-dashboard-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <KeyIcon className="mt-1 size-5 text-primary" weight="fill" />
            <div>
              <h2 className="text-lg font-semibold">Connect TTLock</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The password is exchanged for tokens and is never stored or returned.
              </p>
            </div>
          </div>
          <form onSubmit={(event) => void commission(event)} className="mt-5 grid gap-3 sm:grid-cols-2">
            <Input name="name" placeholder="Connection name" required />
            <select
              name="region"
              defaultValue="eu"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              aria-label="TTLock region"
            >
              <option value="eu">Europe endpoint</option>
              <option value="global">Global endpoint</option>
            </select>
            <Input name="clientId" placeholder="Client ID" autoComplete="off" required />
            <Input name="clientSecret" type="password" placeholder="Client secret" autoComplete="new-password" required />
            <Input name="username" placeholder="TTLock account email" autoComplete="username" required />
            <Input name="password" type="password" placeholder="TTLock account password" autoComplete="new-password" required />
            <Button className="sm:col-span-2 sm:w-fit" disabled={busyKey === "commission"}>
              {busyKey === "commission" ? <SpinnerGapIcon className="size-4 animate-spin" /> : null}
              Connect account
            </Button>
          </form>
        </section>
      ) : null}

      <section className="admin-dashboard-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="font-semibold">TTLock inventory</h2>
            <p className="mt-1 text-sm text-muted-foreground">Gateway and V4 passcode readiness.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <ArrowClockwiseIcon className={loading ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </Button>
        </div>
        <div className="divide-y divide-border">
          {operations.connections.map((connection) => (
            <div key={connection.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="font-medium">{connection.name}</p>
                <p className="text-sm text-muted-foreground">
                  {connection.region} · token {connection.tokenHealth}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!ttlockEnabled || busyKey === `sync:${connection.id}`}
                onClick={() => void postAction(
                  "/api/admin/access/inventory/sync",
                  { connectionId: connection.id },
                  `sync:${connection.id}`,
                )}
              >
                Sync inventory
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!ttlockEnabled || busyKey === `unlock-sync:${connection.id}`}
                onClick={() => void postAction(
                  "/api/admin/access/unlock-records/sync",
                  { connectionId: connection.id },
                  `unlock-sync:${connection.id}`,
                )}
              >
                Sync unlock history
              </Button>
            </div>
          ))}
          {!loading && operations.connections.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No TTLock connections yet.</p>
          ) : null}
        </div>
      </section>

      <section className="admin-dashboard-card overflow-hidden">
        <div className="border-b border-border p-5">
          <h2 className="font-semibold">Locks and assignments</h2>
        </div>
        <div className="divide-y divide-border">
          {operations.locks.map((lock) => (
            <div key={lock.id} className="grid gap-3 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex items-start gap-3">
                <DoorOpenIcon className="mt-1 size-5 text-primary" />
                <div className="w-full">
                  <p className="font-medium">{lock.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {lock.online ? "Online" : "Offline"} · V{lock.passcodeVersion ?? "?"} passcode · battery {lock.batteryLevel ?? "?"}%
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      className="h-9 min-w-48 rounded-md border border-input bg-transparent px-3 text-sm"
                      value={assignmentByLock[lock.id] ?? lock.accessPointId ?? ""}
                      onChange={(event) =>
                        setAssignmentByLock((current) => ({
                          ...current,
                          [lock.id]: event.target.value,
                        }))
                      }
                      aria-label={`Access point for ${lock.name}`}
                    >
                      <option value="">Select access point</option>
                      {operations.accessPoints.map((point) => (
                        <option key={point.id} value={point.id}>
                          {point.name} ({point.kind})
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        !ttlockEnabled ||
                        busyKey === `assign:${lock.id}` ||
                        !(assignmentByLock[lock.id] ?? lock.accessPointId)
                      }
                      onClick={() =>
                        void postAction(
                          "/api/admin/access/assignments",
                          {
                            lockId: lock.id,
                            accessPointId:
                              assignmentByLock[lock.id] ?? lock.accessPointId,
                          },
                          `assign:${lock.id}`,
                        )
                      }
                    >
                      Assign
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Current access point: {lock.accessPointId ?? "not assigned"}
                  </p>
                </div>
              </div>
              <Badge variant={lock.online && lock.supportsCustomPasscodes && lock.passcodeVersion === 4 ? "default" : "outline"}>
                {lock.online && lock.supportsCustomPasscodes && lock.passcodeVersion === 4 ? "Ready" : "Needs attention"}
              </Badge>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-dashboard-card overflow-hidden">
        <div className="border-b border-border p-5">
          <h2 className="font-semibold">Credential recovery</h2>
          <p className="mt-1 text-sm text-muted-foreground">No passcodes are shown in this console.</p>
        </div>
        <div className="divide-y divide-border">
          {operations.grants.map((grant) => (
            <div key={grant.id} className="grid gap-3 p-5 xl:grid-cols-[1fr_auto] xl:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">Booking {grant.bookingId}</p>
                  <Badge variant="outline">{grant.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {grant.activeCredentialCount}/{grant.credentialCount} doors active
                  {grant.lastError ? ` · ${grant.lastError}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["retry", "reconcile", "revoke"] as const).map((action) => (
                  <Button
                    key={action}
                    variant="outline"
                    size="sm"
                    disabled={busyKey === `${action}:${grant.id}`}
                    onClick={() => void postAction(
                      `/api/admin/access/grants/${grant.id}/actions`,
                      { action, reason: `Admin requested ${action}` },
                      `${action}:${grant.id}`,
                    )}
                  >
                    {action[0].toUpperCase() + action.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-dashboard-card p-5">
        <h2 className="font-semibold">Remote unlock</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {remoteUnlockEnabled
            ? "Request an email OTP, then unlock a commissioned lock with a reason. Every action is audited and rate limited."
            : "Disabled until physical lock commissioning and runbook approval."}
        </p>
        {remoteUnlockEnabled ? (
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              void postAction(
                "/api/admin/access/remote-unlock",
                remoteUnlock,
                "remote-unlock",
              )
            }}
          >
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm sm:col-span-2"
              value={remoteUnlock.lockId}
              onChange={(event) => {
                const lock = operations.locks.find((item) => item.id === event.target.value)
                setRemoteUnlock((current) => ({
                  ...current,
                  lockId: event.target.value,
                  accessPointId: lock?.accessPointId ?? "",
                }))
              }}
              required
              aria-label="Lock to unlock"
            >
              <option value="">Select lock</option>
              {operations.locks
                .filter((lock) => lock.accessPointId)
                .map((lock) => (
                  <option key={lock.id} value={lock.id}>
                    {lock.name}
                  </option>
                ))}
            </select>
            <Input
              placeholder="Reason (minimum 10 characters)"
              value={remoteUnlock.reason}
              onChange={(event) =>
                setRemoteUnlock((current) => ({ ...current, reason: event.target.value }))
              }
              required
              minLength={10}
              className="sm:col-span-2"
            />
            <Input
              placeholder="OTP challenge ID"
              value={remoteUnlock.otpChallengeId}
              onChange={(event) =>
                setRemoteUnlock((current) => ({
                  ...current,
                  otpChallengeId: event.target.value,
                }))
              }
              required
            />
            <Input
              placeholder="6-digit OTP"
              value={remoteUnlock.otpCode}
              onChange={(event) =>
                setRemoteUnlock((current) => ({ ...current, otpCode: event.target.value }))
              }
              required
              pattern="^\d{6}$"
            />
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                disabled={busyKey === "remote-unlock-otp"}
                onClick={() =>
                  void (async () => {
                    setBusyKey("remote-unlock-otp")
                    try {
                      const response = await fetch("/api/admin/access/remote-unlock/otp", {
                        method: "POST",
                      })
                      const body = (await response.json()) as ApiResponse<{
                        challenge: { challengeId: string }
                      }>
                      if (!response.ok || !body.data?.challenge.challengeId) {
                        throw new Error(body.message ?? "Could not request OTP.")
                      }
                      setRemoteUnlock((current) => ({
                        ...current,
                        otpChallengeId: body.data!.challenge.challengeId,
                      }))
                      toast.success("Verification code sent to your email.")
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not request OTP.")
                    } finally {
                      setBusyKey(null)
                    }
                  })()
                }
              >
                Send email OTP
              </Button>
              <Button type="submit" disabled={busyKey === "remote-unlock"}>
                Remote unlock
              </Button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  )
}
