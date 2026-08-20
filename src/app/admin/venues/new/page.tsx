import { AdminCreateVenueForm } from "@/components/admin/admin-catalog-forms"
import { AdminShell } from "@/components/admin/admin-shell"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function AdminNewVenuePage() {
  const { canManageCatalog } = await requireAdminPageAccess()

  if (!canManageCatalog) {
    redirect("/admin/venues")
  }

  return (
    <AdminShell title="Add venue" eyebrow="Catalog" backHref="/admin/venues">
      <AdminCreateVenueForm />
    </AdminShell>
  )
}
