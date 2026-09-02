"use client"

import {
  ArrowDownIcon,
  CheckCircleIcon,
  CopyIcon,
  DesktopTowerIcon,
  DownloadSimpleIcon,
  KeyIcon,
  ShieldCheckIcon,
  WarningCircleIcon,
  type Icon,
} from "@phosphor-icons/react"
import Link from "next/link"
import { useCallback, useEffect, useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { VenueEdgeInstallerArtifactMetadata } from "@/server/replays/venue-edge-installer-metadata"
import type { VenueEdgePairingSessionView } from "@/server/replays/venue-edge-pairing-sessions"

type CreatedPairingSession = VenueEdgePairingSessionView & {
  pairingCode: string
}

const LIFECYCLE_LABELS: Record<string, string> = {
  waiting_for_install: "Waiting for install",
  pending_setup: "Setup in progress",
  online: "Connected",
  offline: "Offline",
  expired: "Expired",
  revoked: "Revoked",
  cancelled: "Cancelled",
}

const INSTALL_STEPS: Array<{
  number: string
  title: string
  detail: string
  Icon: Icon
}> = [
  {
    number: "1",
    title: "Download",
    detail: "Save the Windows installer",
    Icon: DownloadSimpleIcon,
  },
  {
    number: "2",
    title: "Install",
    detail: "Approve Windows and let it finish",
    Icon: DesktopTowerIcon,
  },
  {
    number: "3",
    title: "Pair",
    detail: "Enter the one-time venue code",
    Icon: KeyIcon,
  },
]

function lifecycleVariant(status: string) {
  if (status === "online") return "default"
  if (status === "offline") return "destructive"
  if (status === "pending_setup") return "secondary"
  return "outline"
}

function formatBytes(value: number | null) {
  if (!value || value < 1) return "Size unavailable"
  const units = ["B", "KB", "MB", "GB"]
  let amount = value
  let unit = 0
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024
    unit += 1
  }
  return `${amount.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

function shortChecksum(value: string | null) {
  return value ? `${value.slice(0, 12)}…${value.slice(-8)}` : "Not published"
}

export function NvrOnboardingPanel({
  selectedVenueId,
  canManage,
  installer,
  initialSessions,
  initialInstallationHref,
}: {
  selectedVenueId: string
  canManage: boolean
  installer: VenueEdgeInstallerArtifactMetadata
  initialSessions: VenueEdgePairingSessionView[]
  initialInstallationHref: string | null
}) {
  const [sessions, setSessions] =
    useState<VenueEdgePairingSessionView[]>(initialSessions)
  const [freshPairingCode, setFreshPairingCode] = useState<string | null>(null)
  const [freshPairingExpiresAt, setFreshPairingExpiresAt] = useState<
    string | null
  >(null)
  const [pilotAcknowledged, setPilotAcknowledged] = useState(false)
  const [downloadStarted, setDownloadStarted] = useState(false)
  const [installationHref, setInstallationHref] = useState(
    initialInstallationHref
  )
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const refreshSessions = useCallback(async () => {
    const response = await fetch(
      `/api/operator/venue-edge/pairing-sessions?locationId=${selectedVenueId}`
    )
    if (!response.ok) return
    const payload = (await response.json()) as {
      data?: { sessions?: VenueEdgePairingSessionView[] }
    }
    setSessions(payload.data?.sessions ?? [])
  }, [selectedVenueId])

  useEffect(() => {
    setFreshPairingCode(null)
    setFreshPairingExpiresAt(null)
    setPilotAcknowledged(false)
    setDownloadStarted(false)
    setInstallationHref(initialInstallationHref)
    setSessions(initialSessions)
  }, [initialInstallationHref, initialSessions, selectedVenueId])

  useEffect(() => {
    async function refreshSetupState() {
      await refreshSessions()
      const response = await fetch(
        `/api/operator/venue-edge/installations?locationId=${selectedVenueId}`
      )
      if (!response.ok) return
      const payload = (await response.json()) as {
        data?: { installations?: Array<{ nextAction: { href: string } }> }
      }
      const href = payload.data?.installations?.[0]?.nextAction.href
      if (href) setInstallationHref(href)
    }
    const timer = setInterval(() => void refreshSetupState(), 8_000)
    return () => clearInterval(timer)
  }, [refreshSessions, selectedVenueId])

  async function handleCreatePairing() {
    setMessage(null)
    setFreshPairingCode(null)
    setFreshPairingExpiresAt(null)
    const response = await fetch("/api/operator/venue-edge/pairing-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: selectedVenueId }),
    })
    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not create pairing code.")
      return
    }
    const payload = (await response.json()) as {
      data?: { session?: CreatedPairingSession }
    }
    const session = payload.data?.session
    if (!session?.pairingCode) {
      setMessage("The pairing code could not be displayed. Please try again.")
      return
    }
    setFreshPairingCode(session.pairingCode)
    setFreshPairingExpiresAt(session.expiresAt)
    startTransition(() => void refreshSessions())
  }

  async function handleCancel(sessionId: string) {
    setMessage(null)
    const response = await fetch(
      `/api/operator/venue-edge/pairing-sessions/${sessionId}/cancel`,
      { method: "POST" }
    )
    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not cancel pairing.")
      return
    }
    setFreshPairingCode(null)
    startTransition(() => void refreshSessions())
  }

  async function handleReissue(sessionId: string) {
    setMessage(null)
    const response = await fetch(
      `/api/operator/venue-edge/pairing-sessions/${sessionId}/reissue`,
      { method: "POST" }
    )
    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not reissue pairing code.")
      return
    }
    const payload = (await response.json()) as {
      data?: { session?: CreatedPairingSession }
    }
    const session = payload.data?.session
    if (session?.pairingCode) {
      setFreshPairingCode(session.pairingCode)
      setFreshPairingExpiresAt(session.expiresAt)
    }
    startTransition(() => void refreshSessions())
  }

  function handleDownload() {
    if (!installer.downloadUrl) return
    setDownloadStarted(true)
    const separator = installer.downloadUrl.includes("?") ? "&" : "?"
    const acknowledgement = installer.signed
      ? ""
      : `${separator}acknowledgeUnsignedPilot=true`
    window.location.assign(`${installer.downloadUrl}${acknowledgement}`)
    window.setTimeout(() => setDownloadStarted(false), 4_000)
  }

  async function copyPairingCode() {
    if (!freshPairingCode) return
    try {
      await navigator.clipboard.writeText(freshPairingCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2_000)
    } catch {
      setMessage("Could not copy automatically. Select the code and copy it.")
    }
  }

  const activeWaitingSession = sessions.find(
    (session) => session.status === "waiting_for_install"
  )
  const canDownload =
    canManage &&
    Boolean(installer.downloadUrl) &&
    (installer.signed || pilotAcknowledged)
  const hasInstallation = Boolean(installationHref)

  return (
    <section aria-labelledby="venue-edge-setup-title" className="space-y-6">
      <header className="max-w-3xl space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id="venue-edge-setup-title"
            className="font-heading text-xl font-semibold"
          >
            Set up a venue PC
          </h2>
          {hasInstallation ? (
            <Badge variant="secondary">VenueEdge detected</Badge>
          ) : null}
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Download one Windows installer, run it on the venue PC, then use a
          one-time code to connect it securely. No terminal or developer tools
          are needed.
        </p>
      </header>

      <ol
        className="grid overflow-hidden rounded-2xl bg-muted/35 ring-1 ring-border sm:grid-cols-3"
        aria-label="Installation steps"
      >
        {INSTALL_STEPS.map(({ number, title, detail, Icon }, index) => (
          <li
            key={number}
            className={`flex gap-3 p-4 ${index > 0 ? "border-t border-border sm:border-t-0 sm:border-l" : ""}`}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-background text-sm font-semibold ring-1 ring-border">
              {hasInstallation ? (
                <CheckCircleIcon className="text-emerald-700" weight="fill" />
              ) : (
                number
              )}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-medium">
                <Icon className="size-4" />
                {title}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {detail}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(19rem,0.9fr)]">
        <div className="rounded-2xl bg-card p-5 ring-1 ring-border sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-heading text-lg font-semibold">
                  VenueEdge for Windows
                </h3>
                <Badge variant={installer.signed ? "secondary" : "outline"}>
                  {installer.placeholder
                    ? "Awaiting release"
                    : installer.channel === "pilot"
                      ? "Pilot"
                      : "Stable"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Version {installer.version} · {formatBytes(installer.sizeBytes)}
              </p>
            </div>
            <span
              className={`inline-flex w-fit items-center gap-1.5 text-sm font-medium ${installer.signed ? "text-emerald-700" : "text-amber-800"}`}
            >
              {installer.placeholder ? (
                <WarningCircleIcon />
              ) : installer.signed ? (
                <ShieldCheckIcon weight="fill" />
              ) : (
                <WarningCircleIcon weight="fill" />
              )}
              {installer.placeholder
                ? "Not yet available"
                : installer.signed
                  ? "Publisher verified"
                  : "Unsigned pilot build"}
            </span>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">
            {installer.releaseNotes}
          </p>
          <dl className="mt-5 grid gap-x-6 gap-y-3 border-y py-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Works on</dt>
              <dd className="mt-0.5 font-medium">
                {installer.windowsRequirement}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">SHA-256</dt>
              <dd
                className="mt-0.5 font-mono text-xs font-medium"
                title={installer.sha256 ?? undefined}
              >
                {shortChecksum(installer.sha256)}
              </dd>
            </div>
          </dl>
          {canManage && !installer.signed && installer.downloadUrl ? (
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200">
              <input
                type="checkbox"
                checked={pilotAcknowledged}
                onChange={(event) => setPilotAcknowledged(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-amber-700"
              />
              <span>
                I understand this internal pilot build is not yet
                publisher-signed and Windows may show a security warning.
              </span>
            </label>
          ) : null}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              onClick={handleDownload}
              disabled={!canDownload || downloadStarted}
            >
              <DownloadSimpleIcon weight="bold" />
              {downloadStarted ? "Download starting…" : "Download installer"}
            </Button>
            {!canManage ? (
              <p className="text-sm text-muted-foreground">
                Only venue managers can download installers.
              </p>
            ) : !installer.downloadUrl ? (
              <p className="text-sm text-muted-foreground">
                No installer is published for this venue yet.
              </p>
            ) : (
              <p className="text-xs leading-5 text-muted-foreground">
                The download link expires shortly and can only be opened by an
                authorized venue administrator.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-muted/35 p-5 ring-1 ring-border sm:p-6">
          <h3 className="font-heading text-lg font-semibold">
            Connect this venue
          </h3>
          {hasInstallation ? (
            <div className="mt-4 flex gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-950 ring-1 ring-emerald-200">
              <CheckCircleIcon
                className="mt-0.5 size-5 shrink-0 text-emerald-700"
                weight="fill"
              />
              <div>
                <p className="font-medium">VenueEdge is connected</p>
                <p className="mt-1 text-sm leading-5">
                  Continue setup from the installation row above.
                </p>
                {installationHref ? (
                  <Button asChild size="sm" className="mt-3">
                    <Link href={installationHref}>Continue setup</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : freshPairingCode ? (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">
                Enter this code when the installer opens VenueEdge setup.
              </p>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-background p-4 ring-1 ring-primary/30">
                <code className="min-w-0 font-mono text-xl font-semibold tracking-[0.16em] sm:text-2xl">
                  {freshPairingCode}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void copyPairingCode()}
                  aria-label="Copy pairing code"
                >
                  <CopyIcon />
                </Button>
              </div>
              <p role="status" className="mt-2 text-xs text-muted-foreground">
                {copied
                  ? "Copied to clipboard."
                  : freshPairingExpiresAt
                    ? `Expires ${new Date(freshPairingExpiresAt).toLocaleString()}. Shown only once.`
                    : "Shown only once."}
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                Create the code when you are beside the venue PC. It expires
                after 15 minutes and contains no camera credentials.
              </p>
              {canManage ? (
                <Button
                  variant="secondary"
                  onClick={() => void handleCreatePairing()}
                  disabled={isPending || !installer.downloadUrl}
                >
                  <KeyIcon />
                  {activeWaitingSession
                    ? "Replace existing code"
                    : "Create pairing code"}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You can view status, but only venue managers can create
                  pairing codes.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <details className="group rounded-2xl bg-card ring-1 ring-border">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          Pairing history and technician details
          <ArrowDownIcon className="transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <div className="border-t px-5 py-4">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pairing attempts for this venue yet.
            </p>
          ) : (
            <ul className="divide-y" aria-label="Pairing sessions">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={lifecycleVariant(session.lifecycleStatus)}
                      >
                        {LIFECYCLE_LABELS[session.lifecycleStatus] ??
                          session.lifecycleStatus}
                      </Badge>
                      <span className="text-muted-foreground">
                        code ending …{session.codeHint}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(session.createdAt).toLocaleString()} ·
                      expires {new Date(session.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  {session.status === "waiting_for_install" && canManage ? (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => void handleCancel(session.id)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => void handleReissue(session.id)}
                      >
                        Reissue
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
      {message ? (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {message}
        </p>
      ) : null}
    </section>
  )
}
