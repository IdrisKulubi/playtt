"use client"

import { useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  FEATURE_FLAG_LABELS,
  type KnownFeatureFlagKey,
} from "@/server/operator/feature-flag-keys"
import type { OperatorFeatureFlag } from "@/server/operator/types"

function featureFlagLabel(key: string) {
  if (key in FEATURE_FLAG_LABELS) {
    return FEATURE_FLAG_LABELS[key as KnownFeatureFlagKey]
  }

  return key
}

export function OperatorFeatureFlagTable({
  featureFlags,
  canManage = false,
}: {
  featureFlags: OperatorFeatureFlag[]
  canManage?: boolean
}) {
  const [flags, setFlags] = useState(featureFlags)
  const [message, setMessage] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleToggle(flag: OperatorFeatureFlag, enabled: boolean) {
    setMessage(null)
    setPendingKey(flag.key)

    const previous = flags
    setFlags((current) =>
      current.map((row) =>
        row.key === flag.key ? { ...row, enabled } : row,
      ),
    )

    try {
      const response = await fetch(
        `/api/operator/feature-flags/${encodeURIComponent(flag.key)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        },
      )

      if (!response.ok) {
        const error = (await response.json()) as { message?: string }
        setFlags(previous)
        setMessage(error.message ?? "Could not update feature flag.")
        return
      }

      const payload = (await response.json()) as { data: OperatorFeatureFlag }
      setFlags((current) =>
        current.map((row) =>
          row.key === flag.key ? payload.data : row,
        ),
      )
    } catch {
      setFlags(previous)
      setMessage("Network error while updating feature flag.")
    } finally {
      setPendingKey(null)
      startTransition(() => undefined)
    }
  }

  if (flags.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          No feature flags configured for this tenant.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature flags</CardTitle>
        {message ? (
          <p className="text-sm text-destructive">{message}</p>
        ) : canManage ? (
          <p className="text-sm text-muted-foreground">
            Toggle platform features for this tenant.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Read-only view. Catalog managers can toggle flags here.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead>Scope</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flags.map((flag) => {
              const isRowPending = isPending && pendingKey === flag.key

              return (
                <TableRow key={flag.key}>
                  <TableCell className="font-mono text-xs">{flag.key}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {featureFlagLabel(flag.key)}
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <div className="flex items-center gap-3">
                        <Switch
                          id={`feature-flag-${flag.key}`}
                          checked={flag.enabled}
                          disabled={isRowPending}
                          onCheckedChange={(checked) =>
                            void handleToggle(flag, checked)
                          }
                          aria-label={`Toggle ${flag.key}`}
                        />
                        <Label
                          htmlFor={`feature-flag-${flag.key}`}
                          className="text-sm font-normal"
                        >
                          {flag.enabled ? "On" : "Off"}
                        </Label>
                      </div>
                    ) : (
                      <Badge variant={flag.enabled ? "default" : "outline"}>
                        {flag.enabled ? "On" : "Off"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                    {flag.scope ? JSON.stringify(flag.scope) : "—"}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
