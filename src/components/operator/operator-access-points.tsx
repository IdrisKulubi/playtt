"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

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
import type { OperatorVenueCatalogDetail } from "@/server/operator/service"

type OperatorAccessPointFormProps = {
  venueId: string
  canManage: boolean
}

export function OperatorAccessPointForm({
  venueId,
  canManage,
}: OperatorAccessPointFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [kind, setKind] = useState<"entrance" | "hall" | "resource">("entrance")
  const [message, setMessage] = useState<string | null>(null)

  if (!canManage) {
    return null
  }

  async function handleCreateAccessPoint() {
    setMessage(null)
    const response = await fetch("/api/operator/access-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId: venueId,
        code,
        name,
        kind,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not create access point.")
      return
    }

    setCode("")
    setName("")
    startTransition(() => router.refresh())
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure access points</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="access-point-code">Door code</Label>
            <Input
              id="access-point-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="main-entrance"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="access-point-name">Door name</Label>
            <Input
              id="access-point-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Main Entrance"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="access-point-kind">Kind</Label>
            <Select value={kind} onValueChange={(value) => setKind(value as typeof kind)}>
              <SelectTrigger id="access-point-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrance">Entrance</SelectItem>
                <SelectItem value="hall">Hall</SelectItem>
                <SelectItem value="resource">Resource</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={isPending || !code || !name}
            onClick={() => void handleCreateAccessPoint()}
          >
            Create door
          </Button>
        </div>

        {message ? <p className="text-sm text-destructive">{message}</p> : null}
      </CardContent>
    </Card>
  )
}

export function OperatorAccessPointPanels({
  detail,
  canManage,
}: {
  detail: OperatorVenueCatalogDetail
  canManage: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [resourceId, setResourceId] = useState(detail.resources[0]?.id ?? "")
  const [message, setMessage] = useState<string | null>(null)

  async function handleAttachMapping(accessPointId: string) {
    if (!resourceId) {
      setMessage("Select a resource before attaching a door.")
      return
    }

    setMessage(null)
    const response = await fetch("/api/operator/access-points/mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessPointId, resourceId }),
    })

    if (!response.ok) {
      const error = await response.json()
      setMessage(error.message ?? "Could not attach mapping.")
      return
    }

    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Attachment target</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="access-point-resource">Resource for door mappings</Label>
              <Select value={resourceId} onValueChange={setResourceId}>
                <SelectTrigger id="access-point-resource">
                  <SelectValue placeholder="Select resource" />
                </SelectTrigger>
                <SelectContent>
                  {detail.resources.map((resource) => (
                    <SelectItem key={resource.id} value={resource.id}>
                      {resource.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Access points ({detail.accessPoints.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {detail.accessPoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No access points configured for this venue.
            </p>
          ) : (
            detail.accessPoints.map((accessPoint) => (
              <div
                key={accessPoint.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 px-3 py-2"
              >
                <div>
                  <p className="font-medium">{accessPoint.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {accessPoint.code} · {accessPoint.kind}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Order {accessPoint.sortOrder}</Badge>
                  {canManage ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isPending || !resourceId}
                      onClick={() => void handleAttachMapping(accessPoint.id)}
                    >
                      Attach resource
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Required doors by resource</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {detail.resources.map((resource) => {
            const requiredDoors =
              detail.requiredAccessPointsByResourceId[resource.id] ?? []

            return (
              <div
                key={resource.id}
                className="rounded-2xl border border-white/8 bg-background/30 p-4"
              >
                <p className="font-medium">{resource.name}</p>
                {requiredDoors.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No required doors configured.
                  </p>
                ) : (
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                    {requiredDoors.map((door) => (
                      <li key={door.id}>
                        {door.name} ({door.code})
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-destructive">{message}</p> : null}

      <OperatorAccessPointForm
        venueId={detail.venue.id}
        canManage={canManage}
      />
    </div>
  )
}
