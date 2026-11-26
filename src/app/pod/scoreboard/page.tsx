import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams: Promise<{ resourceId?: string }>
}

/**
 * Retired: the venue TV (`/pod/tv`) now switches into the scoreboard on its
 * own while a match is scored. Old bookmarks land there.
 */
export default async function PodScoreboardPage({ searchParams }: PageProps) {
  const { resourceId } = await searchParams
  const id = resourceId?.trim()
  redirect(id ? `/pod/tv?resourceId=${encodeURIComponent(id)}` : "/pod/tv")
}
