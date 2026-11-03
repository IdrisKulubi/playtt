import { haptics } from "@/lib/haptics"
import { toast } from "@/lib/toast"

export type CalendarGame = {
  venue: string
  table: string
  startIso: string
  endIso: string
  players: number
}

/** What happened when we offered to add a game to the calendar. */
export type AddToCalendarResult = "saved" | "canceled" | "unavailable"

/** Reminder before the game, in minutes (negative = before the start). */
const REMINDER_MINUTES_BEFORE = -60

/**
 * Opens the phone's own "New Event" form, already filled in with the game.
 * The player confirms or cancels there, so PlayTT never needs to read their
 * calendar. The calendar module loads only when this runs, so an app build
 * without it shows a message instead of crashing.
 */
export async function addGameToCalendar(game: CalendarGame): Promise<AddToCalendarResult> {
  if (process.env.EXPO_OS === "web") {
    toast.info("Adding to your calendar works in the PlayTT phone app.")
    return "unavailable"
  }

  try {
    const { createEventInCalendarAsync } = await import("expo-calendar/legacy")
    const result = await createEventInCalendarAsync({
      title: `Table tennis at ${game.venue}`,
      startDate: new Date(game.startIso),
      endDate: new Date(game.endIso),
      location: `${game.venue} · ${game.table}`,
      notes: `${game.table} · ${game.players} players. Your entry code is in the PlayTT app under Bookings.`,
      alarms: [{ relativeOffset: REMINDER_MINUTES_BEFORE }],
    })

    // Only iOS reports a confirmed save. Android always says "done", even after
    // a cancel, so we don't claim success there.
    if (result.action === "saved") {
      haptics.success()
      toast.success("Added to your calendar, with a reminder an hour before.")
      return "saved"
    }
    return result.action === "done" ? "saved" : "canceled"
  } catch {
    toast.error("Couldn't open your calendar. Please update the PlayTT app and try again.")
    return "unavailable"
  }
}
