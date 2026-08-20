import { AdminCreateVenueForm } from "@/components/admin/admin-catalog-forms"
import { AdminShell } from "@/components/admin/admin-shell"
import { requireOwnerAdminAccess } from "@/server/admin/gate"

export const dynamic = "force-dynamic"

export default async function AdminNewVenuePage() {
  await requireOwnerAdminAccess()

  return (
    <AdminShell title="Add venue" eyebrow="Catalog" backHref="/admin/venues">
      <AdminCreateVenueForm />
    </AdminShell>
  )
}
