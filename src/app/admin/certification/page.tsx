import Link from "next/link"

import { AdminCertificationNav } from "@/components/admin/admin-certification-nav"
import { AdminCertificationPanel } from "@/components/admin/admin-certification-panel"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { Button } from "@/components/ui/button"
import { requireAdminPageAccess } from "@/server/admin/gate"
import {
  getPhase5CertificationReport,
  getPhase7CertificationReport,
  getPhase8CertificationReport,
} from "@/server/operations/certification-service"

export const dynamic = "force-dynamic"

export default async function AdminCertificationPage() {
  const access = await requireAdminPageAccess()
  const [phase5Report, phase7Report, phase8Report] = await Promise.all([
    getPhase5CertificationReport(access.context),
    getPhase7CertificationReport(access.context),
    getPhase8CertificationReport(access.context),
  ])

  return (
    <AdminShell
      title="Certification"
      subtitle="Phase 5 access rollout, Phase 7 operations readiness, and Phase 8 VenueEdge certification."
      backHref="/admin"
      user={adminShellUser(access)}
      actions={
        <Button asChild size="sm">
          <Link href="#phase-p8">Phase 8</Link>
        </Button>
      }
    >
      <AdminCertificationNav />
      <div className="space-y-10">
        <AdminCertificationPanel report={phase5Report} anchorId="phase-p5" />
        <AdminCertificationPanel report={phase7Report} anchorId="phase-p7" />
        <AdminCertificationPanel report={phase8Report} anchorId="phase-p8" />
      </div>
    </AdminShell>
  )
}
