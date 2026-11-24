import { AdminCertificationDashboard } from "@/components/admin/admin-certification-panel"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { requireAdminPageAccess } from "@/server/admin/gate"
import {
  getPhase5CertificationReport,
  getPhase7CertificationReport,
  getPhase8CertificationReport,
} from "@/server/operations/certification-service"

export const dynamic = "force-dynamic"

export default async function AdminCertificationPage() {
  const access = await requireAdminPageAccess()
  const reports = await Promise.all([
    getPhase5CertificationReport(access.context),
    getPhase7CertificationReport(access.context),
    getPhase8CertificationReport(access.context),
  ])

  return (
    <AdminShell
      title="Certification"
      subtitle="What's done and what's left before each rollout phase is signed off."
      backHref="/admin"
      user={adminShellUser(access)}
    >
      <AdminCertificationDashboard reports={reports} />
    </AdminShell>
  )
}
