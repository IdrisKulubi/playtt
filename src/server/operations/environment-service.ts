import { evaluateEnvironmentIsolation } from "@/server/operations/environment-isolation"
import type { EnvironmentOperationsReport } from "@/server/operations/environment-types"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import type { TenantContext } from "@/server/tenancy/types"

export async function getEnvironmentOperationsReport(
  context: TenantContext,
): Promise<EnvironmentOperationsReport> {
  authorize(context, "venue.read")
  return evaluateEnvironmentIsolation()
}
