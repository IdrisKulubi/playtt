import { notFound } from "next/navigation"

import { OperatorShell } from "@/components/operator/operator-shell"
import { OperatorVenueDetail } from "@/components/operator/operator-venue-detail"
import { requireOperatorPageAccess } from "@/server/operator/gate"
import { getVenueCatalogDetail } from "@/server/operator/service"
import { canPerformTenantAction } from "@/server/tenancy/permissions"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function OperatorVenueDetailPage({ params }: PageProps) {
  const { id } = await params
  const { context } = await requireOperatorPageAccess()
  const detail = await getVenueCatalogDetail(context, id)

  if (!detail) {
    notFound()
  }

  return (
    <OperatorShell
      title={detail.venue.name}
      eyebrow="Venue catalog"
      backHref="/operator/venues"
    >
      <OperatorVenueDetail
        detail={detail}
        canManage={canPerformTenantAction(context.role, "catalog.manage")}
      />
    </OperatorShell>
  )
}
