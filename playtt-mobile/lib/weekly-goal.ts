import * as SecureStore from "expo-secure-store"
import { useEffect, useSyncExternalStore } from "react"

/** The player's own target for table time each week. It lives on the phone. */
const KEY = "playtt.weeklyGoalMinutes"

export const DEFAULT_WEEKLY_GOAL_MINUTES = 120
export const MIN_WEEKLY_GOAL_MINUTES = 30
export const MAX_WEEKLY_GOAL_MINUTES = 600
export const WEEKLY_GOAL_STEP_MINUTES = 30

let goal = DEFAULT_WEEKLY_GOAL_MINUTES
let loaded = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function clamp(minutes: number) {
  return Math.min(MAX_WEEKLY_GOAL_MINUTES, Math.max(MIN_WEEKLY_GOAL_MINUTES, Math.round(minutes)))
}

async function load() {
  if (loaded) return
  loaded = true
  try {
    const stored = await SecureStore.getItemAsync(KEY)
    const parsed = stored ? Number(stored) : NaN
    if (Number.isFinite(parsed)) {
      goal = clamp(parsed)
      emit()
    }
  } catch {
    // No storage here (web, private mode): the default is fine.
  }
}

export async function saveWeeklyGoal(minutes: number) {
  goal = clamp(minutes)
  emit()
  try {
    await SecureStore.setItemAsync(KEY, String(goal))
  } catch {
    // Kept for this session only.
  }
}

/** Forget this player's goal (sign-out): the next person starts from the default. */
export async function resetWeeklyGoal() {
  goal = DEFAULT_WEEKLY_GOAL_MINUTES
  loaded = false
  emit()
  try {
    await SecureStore.deleteItemAsync(KEY)
  } catch {
    // Nothing stored, or no storage here.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The weekly table-time goal in minutes, shared by every screen that shows it. */
export function useWeeklyGoal() {
  const minutes = useSyncExternalStore(subscribe, () => goal)

  useEffect(() => {
    void load()
  }, [])

  return minutes
}
