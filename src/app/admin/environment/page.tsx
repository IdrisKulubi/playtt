import { AdminEnvironmentPanel } from "@/components/admin/admin-environment-panel"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { getEnvironmentOperationsReport } from "@/server/operations/environment-service"

export const dynamic = "force-dynamic"

export default async function AdminEnvironmentPage() {
  const access = await requireAdminPageAccess()
  const report = await getEnvironmentOperationsReport(access.context)

  return (
    <AdminShell
      title="Environment"
      subtitle="Deployment classification, credential isolation, and recovery objectives."
      backHref="/admin"
      user={adminShellUser(access)}
    >
      <AdminEnvironmentPanel report={report} />
    </AdminShell>
  )
}
