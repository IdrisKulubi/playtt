import { TableReplayKiosk } from "@/components/replay/table-replay-kiosk"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams: Promise<{ resourceId?: string }>
}

export default async function ReplayKioskPage({ searchParams }: PageProps) {
  const { resourceId } = await searchParams

  if (!resourceId?.trim()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] px-6 text-center text-white">
        <div>
          <h1 className="text-2xl font-semibold">Missing resource</h1>
          <p className="mt-3 text-white/60">
            Open this page with <code>?resourceId=&lt;uuid&gt;</code> or bookmark
            <code>/replay/table-01</code> when a table code is configured.
          </p>
        </div>
      </div>
    )
  }

  return <TableReplayKiosk resourceId={resourceId.trim()} />
}
