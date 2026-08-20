import { redirect } from "next/navigation"

type PageProps = {
  searchParams: Promise<{ venueId?: string }>
}

export default async function OperatorDevicesRedirect({
  searchParams,
}: PageProps) {
  const params = await searchParams
  const suffix = params.venueId ? `?venueId=${params.venueId}` : ""
  redirect(`/admin/devices${suffix}`)
}
