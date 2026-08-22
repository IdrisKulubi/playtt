import { notFound } from "next/navigation"

import { TableReplayKiosk } from "@/components/replay/table-replay-kiosk"
import { resolveResourceIdByCodeOrId } from "@/server/realtime/display-query"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ code: string }>
}

export default async function ReplayKioskCodePage({ params }: PageProps) {
  const { code } = await params
  const resourceId = await resolveResourceIdByCodeOrId(code)

  if (!resourceId) {
    notFound()
  }

  return <TableReplayKiosk resourceId={resourceId} />
}
