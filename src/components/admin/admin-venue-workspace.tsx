"use client"

import type { ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const VENUE_TABS = ["tables", "cameras", "controllers", "replays", "access", "details"] as const
export type VenueTab = (typeof VENUE_TABS)[number]

const LABELS: Record<VenueTab, string> = {
  tables: "Tables",
  cameras: "Cameras",
  controllers: "Score controllers",
  replays: "Replays",
  access: "Doors & access",
  details: "Venue details",
}

function isVenueTab(value: string | null): value is VenueTab {
  return Boolean(value && (VENUE_TABS as readonly string[]).includes(value))
}

/**
 * One venue, split into the jobs people come here for. The selected tab lives
 * in the URL (?tab=) so links such as "Add table" can open the right place.
 */
export function AdminVenueWorkspace({ panels }: { panels: Record<VenueTab, ReactNode> }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requested = searchParams.get("tab")
  const tab: VenueTab = isVenueTab(requested) ? requested : "tables"

  function select(value: string) {
    if (!isVenueTab(value) || value === tab) return
    router.replace(`${pathname}?tab=${value}`, { scroll: false })
  }

  return (
    <Tabs value={tab} onValueChange={select} className="gap-6">
      <div className="-mx-1 overflow-x-auto px-1">
        <TabsList>
          {VENUE_TABS.map((value) => (
            <TabsTrigger key={value} value={value} className="px-4">
              {LABELS[value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {VENUE_TABS.map((value) => (
        <TabsContent key={value} value={value} className="space-y-6">
          {panels[value]}
        </TabsContent>
      ))}
    </Tabs>
  )
}
