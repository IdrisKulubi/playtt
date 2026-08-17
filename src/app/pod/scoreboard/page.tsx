import { LiveScoreDisplay } from "@/components/display/live-score-display"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams: Promise<{ resourceId?: string }>
}

export default async function PodScoreboardPage({ searchParams }: PageProps) {
  const { resourceId } = await searchParams

  if (!resourceId?.trim()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] px-6 text-center text-white">
        <div>
          <h1 className="text-2xl font-semibold">Missing resource</h1>
          <p className="mt-3 text-white/60">
            Open this page with <code>?resourceId=&lt;uuid&gt;</code>.
          </p>
        </div>
      </div>
    )
  }

  return <LiveScoreDisplay resourceId={resourceId.trim()} variant="kiosk" />
}
