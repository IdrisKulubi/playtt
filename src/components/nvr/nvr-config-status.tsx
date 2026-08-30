import { Badge } from "@/components/ui/badge"
import type { VenueEdgeInstallationDetailView } from "@/server/replays/venue-edge-fleet"

export function NvrConfigStatus({
  installation,
}: {
  installation: VenueEdgeInstallationDetailView
}) {
  return (
    <div className="space-y-4 rounded-xl bg-muted/45 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">Configuration delivery</h3>
        <Badge variant="outline">
          desired v{installation.publishedConfigRevision?.version ?? "—"}
        </Badge>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Cloud desired</dt>
          <dd>
            {installation.publishedConfigRevision
              ? `v${installation.publishedConfigRevision.version}`
              : "Not published"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Agent applied</dt>
          <dd>
            {installation.lastAppliedConfigRevision
              ? `v${installation.lastAppliedConfigRevision.version}`
              : "Never"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Delivery</dt>
          <dd>{installation.configApplication?.status ?? "No acknowledgement"}</dd>
        </div>
      </dl>
      {installation.configApplication?.diagnostic ? (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">
            {installation.configApplication.diagnostic.code}
            {installation.configApplication.diagnostic.staleReason
              ? ` · ${installation.configApplication.diagnostic.staleReason}`
              : ""}
          </p>
          <p className="mt-1 leading-6">
            {installation.configApplication.diagnostic.remediation}
          </p>
          {installation.configApplication.diagnostic.localVersion !== null ? (
            <p className="mt-1 text-xs">
              Venue PC v{installation.configApplication.diagnostic.localVersion}
              {installation.configApplication.diagnostic.receivedVersion !== null
                ? ` · received v${installation.configApplication.diagnostic.receivedVersion}`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
