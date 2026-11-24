import { AdminReplayPricing } from "@/components/admin/admin-replay-pricing"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { getReplayClipPricingForAdmin } from "@/server/replays/pricing"

export const dynamic = "force-dynamic"

export default async function AdminReplayClipsPage() {
  const access = await requireAdminPageAccess()
  const pricing = await getReplayClipPricingForAdmin(access.context)

  return (
    <AdminShell
      title="Replay clips"
      subtitle="Set what players pay for each replay clip."
      backHref="/admin"
      user={adminShellUser(access)}
      searchable={false}
    >
      <AdminReplayPricing pricing={pricing} canManage={access.canManageCatalog} />
    </AdminShell>
  )
}
