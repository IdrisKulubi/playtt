import { deriveOperationalAlerts } from "@/server/operations/alert-catalog"
import {
  countAlertsBySeverity,
  type TenantOperationalAlerts,
} from "@/server/operations/alert-types"
import { getTenantHealthOverview } from "@/server/operations/health-service"
import type { TenantHealthOverview } from "@/server/operations/health-status"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import type { TenantContext } from "@/server/tenancy/types"

export function buildTenantOperationalAlertsFromOverview(
  overview: TenantHealthOverview,
): TenantOperationalAlerts {
  const alerts = deriveOperationalAlerts(overview)

  return {
    generatedAt: overview.generatedAt,
    alerts,
    counts: countAlertsBySeverity(alerts),
  }
}

export async function getTenantOperationalAlerts(
  context: TenantContext,
): Promise<TenantOperationalAlerts> {
  authorize(context, "venue.read")

  const overview = await getTenantHealthOverview(context)
  return buildTenantOperationalAlertsFromOverview(overview)
}
