import { AdminCertificationPanel } from "@/components/admin/admin-certification-panel"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { getPhase7CertificationReport } from "@/server/operations/certification-service"

export const dynamic = "force-dynamic"

export default async function AdminCertificationPage() {
  const access = await requireAdminPageAccess()
  const report = await getPhase7CertificationReport(access.context)

  return (
    <AdminShell
      title="Certification"
      subtitle="Phase 7 software gates, hardware acceptance, and rollout readiness."
      backHref="/admin"
      user={adminShellUser(access)}
    >
      <AdminCertificationPanel report={report} />
    </AdminShell>
  )
}
