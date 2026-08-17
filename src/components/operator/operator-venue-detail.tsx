import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { OperatorAccessPointPanels } from "@/components/operator/operator-access-points"
import type { OperatorVenueCatalogDetail } from "@/server/operator/service"

export function OperatorVenueDetail({
  detail,
  canManage = false,
}: {
  detail: OperatorVenueCatalogDetail
  canManage?: boolean
}) {
  const resourceTypeName = new Map(
    detail.resourceTypes.map((type) => [type.id, type.name]),
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{detail.venue.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
          <p>Slug: {detail.venue.slug}</p>
          <p>Timezone: {detail.venue.timezone}</p>
          <p>Address: {detail.venue.address}</p>
          <p>
            Status:{" "}
            <Badge variant={detail.venue.isActive ? "default" : "outline"}>
              {detail.venue.isActive ? "Active" : "Inactive"}
            </Badge>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zones ({detail.zones.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {detail.zones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No zones configured.</p>
          ) : (
            detail.zones.map((zone) => (
              <div
                key={zone.id}
                className="flex items-center justify-between rounded-xl border border-white/8 px-3 py-2"
              >
                <span>{zone.name}</span>
                <Badge variant="outline">{zone.slug}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resources ({detail.resources.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {detail.resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resources configured.</p>
          ) : (
            detail.resources.map((resource) => {
              const capabilities = detail.capabilitiesByResourceId[resource.id] ?? []

              return (
                <div
                  key={resource.id}
                  className="rounded-2xl border border-white/8 bg-background/30 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{resource.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {resource.code ?? resource.slug} · {resource.type}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {resource.resourceTypeId ? (
                        <Badge variant="outline">
                          {resourceTypeName.get(resource.resourceTypeId) ?? "Type"}
                        </Badge>
                      ) : null}
                      <Badge variant={resource.isActive ? "default" : "outline"}>
                        {resource.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>

                  {capabilities.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {capabilities.map((capability) => (
                        <Badge key={capability.id} variant="secondary">
                          {capability.code}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      No capabilities configured.
                    </p>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <OperatorAccessPointPanels detail={detail} canManage={canManage} />
    </div>
  )
}
