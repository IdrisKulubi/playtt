"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type {
  OperatorDeadLetterInboxRow,
  OperatorDeadLetterOutboxRow,
} from "@/server/operator/durable-work-repository"

type ReplayKind = "inbox" | "outbox"

function ReplayButton({ kind, id }: { kind: ReplayKind; id: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleReplay = () => {
    setError(null)
    startTransition(async () => {
      const response = await fetch("/api/operator/durable-work/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, id }),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null
        setError(body?.error?.message ?? "Replay failed.")
        return
      }

      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={handleReplay}
      >
        {isPending ? "Replaying…" : "Replay"}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  )
}

function BacklogCard({
  title,
  backlog,
}: {
  title: string
  backlog: Record<string, number>
}) {
  const entries = Object.entries(backlog).sort(([left], [right]) =>
    left.localeCompare(right),
  )

  return (
    <div className="rounded-2xl border border-white/8 bg-background/40 p-4">
      <p className="text-sm font-medium">{title}</p>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No rows yet.</p>
      ) : (
        <dl className="mt-3 space-y-2">
          {entries.map(([status, count]) => (
            <div key={status} className="flex items-center justify-between gap-3">
              <dt className="font-mono text-xs text-muted-foreground">{status}</dt>
              <dd>
                <Badge variant="outline">{count}</Badge>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

export function OperatorDurableWorkPanel({
  inboxBacklog,
  outboxBacklog,
  deadLetterInbox,
  deadLetterOutbox,
}: {
  inboxBacklog: Record<string, number>
  outboxBacklog: Record<string, number>
  deadLetterInbox: OperatorDeadLetterInboxRow[]
  deadLetterOutbox: OperatorDeadLetterOutboxRow[]
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <BacklogCard title="Webhook inbox backlog" backlog={inboxBacklog} />
        <BacklogCard title="Outbox backlog" backlog={outboxBacklog} />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Dead-letter inbox</h2>
          <p className="text-sm text-muted-foreground">
            Tenant-scoped webhook rows that exhausted retries.
          </p>
        </div>
        {deadLetterInbox.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-background/40 px-4 py-6 text-sm text-muted-foreground">
            No dead-letter inbox rows for this tenant.
          </p>
        ) : (
          <div className="space-y-3">
            {deadLetterInbox.map((row) => (
              <article
                key={row.id}
                className="rounded-2xl border border-white/8 bg-background/40 px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-mono text-xs">{row.id}</p>
                    <p className="text-sm font-medium">{row.eventType}</p>
                    <p className="text-xs text-muted-foreground">
                      attempts {row.attempts} · received {row.receivedAt}
                    </p>
                  </div>
                  <ReplayButton kind="inbox" id={row.id} />
                </div>
                {row.lastError ? (
                  <p className="mt-3 text-sm text-destructive">{row.lastError}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Dead-letter outbox</h2>
          <p className="text-sm text-muted-foreground">
            Tenant-scoped outbox events that exhausted retries.
          </p>
        </div>
        {deadLetterOutbox.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-background/40 px-4 py-6 text-sm text-muted-foreground">
            No dead-letter outbox rows for this tenant.
          </p>
        ) : (
          <div className="space-y-3">
            {deadLetterOutbox.map((row) => (
              <article
                key={row.id}
                className="rounded-2xl border border-white/8 bg-background/40 px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-mono text-xs">{row.id}</p>
                    <p className="text-sm font-medium">
                      {row.eventType} v{row.eventVersion}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.aggregateType}:{row.aggregateId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      attempts {row.attempts} · created {row.createdAt}
                    </p>
                  </div>
                  <ReplayButton kind="outbox" id={row.id} />
                </div>
                {row.lastError ? (
                  <p className="mt-3 text-sm text-destructive">{row.lastError}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
