import { AdminCreateVenueForm } from "@/components/admin/admin-catalog-forms"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function AdminNewVenuePage() {
  const access = await requireAdminPageAccess()

  if (!access.canManageCatalog) {
    redirect("/admin/venues")
  }

  return (
    <AdminShell
      title="Add venue"
      subtitle="Create a new PlayTT location."
      backHref="/admin/venues"
      user={adminShellUser(access)}
      searchable={false}
    >
      <div className="admin-dashboard-card max-w-2xl">
        <AdminCreateVenueForm />
      </div>
    </AdminShell>
  )
}
