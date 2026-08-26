import { AdminAccessAutomationPanel } from "@/components/admin/admin-access-automation-panel"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import {
  ACCESS_FEATURE_KEYS,
  isAccessFeatureEnabled,
} from "@/server/access/feature-policy"
import { requireAdminPageAccess } from "@/server/admin/gate"

export const dynamic = "force-dynamic"

export default async function AdminAccessPage() {
  const access = await requireAdminPageAccess()
  const [liveAccessEnabled, ttlockEnabled, remoteUnlockEnabled] =
    await Promise.all([
      isAccessFeatureEnabled(access.context, ACCESS_FEATURE_KEYS.liveAccess),
      isAccessFeatureEnabled(access.context, ACCESS_FEATURE_KEYS.ttlockProvider),
      isAccessFeatureEnabled(access.context, ACCESS_FEATURE_KEYS.remoteUnlock),
    ])

  return (
    <AdminShell
      title="Venue access"
      subtitle="Commission locks, inspect credential health, and recover access safely."
      backHref="/admin"
      user={adminShellUser(access)}
    >
      <AdminAccessAutomationPanel
        liveAccessEnabled={liveAccessEnabled}
        ttlockEnabled={ttlockEnabled}
        remoteUnlockEnabled={remoteUnlockEnabled}
      />
    </AdminShell>
  )
}
