export function ceilToStartStep(value: Date | number | string, stepMinutes?: number): Date
export function floorToStartStep(value: Date | number | string, stepMinutes?: number): Date
export function isOnStartStep(value: Date | number | string, stepMinutes?: number): boolean
export function isStartInPast(start: Date | number | string, now?: Date | number): boolean
export function earliestBookableStart(now?: Date | number): Date
export function isAllowedDuration(minutes: number): boolean
export function freeWindows(
  busy: { start: number; end: number }[],
  rangeStart: number,
  rangeEnd: number,
): { start: number; end: number }[]
export function freeResourceIds(input: {
  resourceIds: string[]
  bookings: { resourceId: string; startTime: Date | string; endTime: Date | string }[]
  start: Date | number
  end: Date | number
}): string[]

export type PlanSuggestion = {
  kind: "later" | "earlier" | "shorter"
  resourceId: string
  startsAt: Date
  endsAt: Date
  durationMinutes: number
  shiftMinutes: number
}

export type PlanResult =
  | { status: "available"; resourceId: string; resourceIds: string[] }
  | {
      status: "conflict"
      conflicts: { resourceId: string; startsAt: Date; endsAt: Date }[]
      suggestions: PlanSuggestion[]
    }

export function planBooking(input: {
  resourceIds: string[]
  bookings: { resourceId: string; startTime: Date | string; endTime: Date | string }[]
  start: Date | number
  durationMinutes: number
  now?: Date | number
  searchStart: Date | number
  searchEnd: Date | number
  maxSuggestions?: number
}): PlanResult
