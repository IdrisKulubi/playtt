import { AdminShell } from "@/components/admin/admin-shell"
import { AdminTvThemes } from "@/components/admin/admin-tv-themes"
import { adminShellUser } from "@/components/admin/admin-utils"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { getDisplayThemesOverview } from "@/server/display/themes-service"

export const dynamic = "force-dynamic"

type PageProps = { searchParams: Promise<{ preview?: string }> }

export default async function AdminTvPage({ searchParams }: PageProps) {
  const access = await requireAdminPageAccess()
  const { preview } = await searchParams

  let overview: Awaited<ReturnType<typeof getDisplayThemesOverview>> | null = null
  try {
    overview = await getDisplayThemesOverview(access.context)
  } catch (error) {
    console.error("[admin/tv] could not load display themes", error)
  }

  return (
    <AdminShell
      title="TV display"
      subtitle="Choose what venue TVs look like."
      backHref="/admin"
      user={adminShellUser(access)}
      searchable={false}
    >
      {overview ? (
        <AdminTvThemes
          themes={overview.themes}
          venues={overview.venues}
          canManage={access.canManageCatalog}
          initialPreviewKey={preview ?? null}
        />
      ) : (
        <div className="mx-auto max-w-2xl px-4 text-[15px] text-muted-foreground">
          TV themes aren&apos;t set up on this database yet. Apply the latest migration
          (<code>pnpm db:migrate</code>) and reload.
        </div>
      )}
    </AdminShell>
  )
}
