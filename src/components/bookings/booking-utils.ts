import type { SlotAvailability } from "@/server/bookings/types"

export const GROUP_SIZE_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const
export type GroupSize = (typeof GROUP_SIZE_OPTIONS)[number]
export const INCLUDED_PLAYERS = 5
export const EXTRA_PLAYER_SURCHARGE = 500

export type BookingStep = "location" | "timing" | "checkout"

export function formatPricingTierLabel(
  snapshot: Record<string, unknown> | undefined
): string | null {
  if (!snapshot) return null
  const tier = snapshot.pricingTier
  if (typeof tier !== "string" || !tier.trim()) return null
  return tier
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function isSlotStartInPast(startsAtIso: string, nowMs: number): boolean {
  return new Date(startsAtIso).getTime() <= nowMs
}

export function availabilitySubtitle(
  slot: SlotAvailability,
  startInPast: boolean
): string {
  if (startInPast) return "Past"
  if (!slot.isAvailable || slot.openTableCount <= 0) return "No tables"
  if (slot.openTableCount === 1) return "1 open table"
  return `${slot.openTableCount} open tables`
}
