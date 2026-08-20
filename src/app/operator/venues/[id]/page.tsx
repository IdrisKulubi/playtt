import { redirect } from "next/navigation"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function OperatorVenueDetailRedirect({ params }: PageProps) {
  const { id } = await params
  redirect(`/admin/venues/${id}`)
}
