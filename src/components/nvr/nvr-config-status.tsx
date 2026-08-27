import { Badge } from "@/components/ui/badge"
import type { VenueEdgeInstallationDetailView } from "@/server/replays/venue-edge-fleet"

export function NvrConfigStatus({
  installation,
}: {
  installation: VenueEdgeInstallationDetailView
}) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">Configuration delivery</h3>
        <Badge variant="outline">
          desired v{installation.publishedConfigRevision?.version ?? "—"}
        </Badge>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Published</dt>
          <dd>
            {installation.publishedConfigRevision?.publishedAt ?? "Not published"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last applied revision</dt>
          <dd>
            {installation.lastAppliedConfigRevision
              ? `v${installation.lastAppliedConfigRevision.version} at ${installation.lastAppliedConfigRevision.appliedAt}`
              : "Never"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Application status</dt>
          <dd>{installation.configApplication?.status ?? "No acknowledgement"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Application error</dt>
          <dd>{installation.configApplication?.errorCode ?? "—"}</dd>
        </div>
      </dl>
    </div>
  )
}
