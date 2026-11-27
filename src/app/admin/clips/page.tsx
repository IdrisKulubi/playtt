import { AdminReplayClipLength } from "@/components/admin/admin-replay-clip-length"
import { AdminReplayPricing } from "@/components/admin/admin-replay-pricing"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { getReplayClipSettingsForAdmin } from "@/server/replays/clip-settings"
import { getReplayClipPricingForAdmin } from "@/server/replays/pricing"

export const dynamic = "force-dynamic"

export default async function AdminReplayClipsPage() {
  const access = await requireAdminPageAccess()
  const [pricing, clipSettings] = await Promise.all([
    getReplayClipPricingForAdmin(access.context),
    getReplayClipSettingsForAdmin(access.context),
  ])

  return (
    <AdminShell
      title="Replay clips"
      subtitle="Set what players pay for each replay clip and how long each clip is."
      backHref="/admin"
      user={adminShellUser(access)}
      searchable={false}
    >
      <div className="space-y-10">
        <AdminReplayPricing pricing={pricing} canManage={access.canManageCatalog} />
        <div className="mx-auto max-w-2xl">
          <AdminReplayClipLength settings={clipSettings} canManage={access.canManageCatalog} />
        </div>
      </div>
    </AdminShell>
  )
}
