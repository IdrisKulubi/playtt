"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { CaretRightIcon } from "@phosphor-icons/react"

import { useAdminSearchFilter } from "@/components/admin/admin-context"
import {
  GroupedList,
  LargeTitle,
  SectionHeader,
  SegmentedControl,
  textActionClass,
} from "@/components/admin/admin-grouped"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AdminBookingRow } from "@/server/admin/analytics-service"

// Venues run on Nairobi time; fixed locale + zone keeps server and browser output identical.
const TIME_ZONE = "Africa/Nairobi"
const LOCALE = "en-GB"
const PAGE_SIZE = 30
const DELETED_EMAIL_SUFFIX = "@deleted.theplaytt.com"

type View = "upcoming" | "today" | "past" | "cancelled" | "all"

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
const timeFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit", hour12: true })
const dayLabelFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" })
const yearLabelFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" })

function nairobiDayKey(date: Date) {
  return dayKeyFormat.format(date)
}

function dayHeading(key: string, todayKey: string, tomorrowKey: string, yesterdayKey: string) {
  if (key === todayKey) return "Today"
  if (key === tomorrowKey) return "Tomorrow"
  if (key === yesterdayKey) return "Yesterday"
  const date = new Date(`${key}T12:00:00+03:00`)
  return key.slice(0, 4) === todayKey.slice(0, 4) ? dayLabelFormat.format(date) : yearLabelFormat.format(date)
}

function formatMoney(amount: string, currency: string) {
  return `${currency} ${Math.round(Number(amount)).toLocaleString("en-KE")}`
}

function durationLabel(start: Date, end: Date) {
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = minutes / 60
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`
}

/** One plain-language status. `attention` marks the ones a person should act on. */
function describeStatus(booking: AdminBookingRow, now: number): { label: string; attention: boolean } {
  const { status, paymentStatus } = booking
  if (paymentStatus === "refunded") return { label: "Refunded", attention: false }
  if (paymentStatus === "partially_refunded") return { label: "Part refunded", attention: false }
  if (status === "cancelled") return { label: "Cancelled", attention: false }
  if (status === "expired") return { label: "Expired", attention: false }
  if (status === "failed" || paymentStatus === "failed") return { label: "Payment failed", attention: true }
  if (status === "completed") return { label: "Played", attention: false }
  if (status === "pending" || paymentStatus === "unpaid" || paymentStatus === "pending") {
    return { label: "Awaiting payment", attention: true }
  }
  if (status === "confirmed") {
    const start = new Date(booking.startTime).getTime()
    const end = new Date(booking.endTime).getTime()
    if (now >= start && now < end) return { label: "Playing now", attention: false }
    if (now >= end) return { label: "Played", attention: false }
    return { label: "Confirmed", attention: false }
  }
  return { label: status, attention: false }
}

function isInactive(booking: AdminBookingRow) {
  return ["cancelled", "expired", "failed"].includes(booking.status) || booking.paymentStatus === "refunded"
}

export function AdminBookingsList({ bookings, limit }: { bookings: AdminBookingRow[]; limit: number }) {
  const [now] = useState(() => Date.now())
  const todayKey = nairobiDayKey(new Date(now))
  const tomorrowKey = nairobiDayKey(new Date(now + 86_400_000))
  const yesterdayKey = nairobiDayKey(new Date(now - 86_400_000))

  const searched = useAdminSearchFilter(bookings, (booking) =>
    [booking.userName, booking.userEmail, booking.locationName, booking.resourceName, booking.status, booking.paymentStatus].join(" "),
  )

  const venues = useMemo(
    () => [...new Map(bookings.map((b) => [b.locationId, b.locationName])).entries()],
    [bookings],
  )
  const [venueId, setVenueId] = useState("all")
  const scoped = venueId === "all" ? searched : searched.filter((b) => b.locationId === venueId)

  const buckets = useMemo(() => {
    const upcoming = scoped.filter((b) => !isInactive(b) && new Date(b.endTime).getTime() > now)
    const today = scoped.filter((b) => nairobiDayKey(new Date(b.startTime)) === todayKey)
    const past = scoped.filter((b) => !isInactive(b) && new Date(b.endTime).getTime() <= now)
    const cancelled = scoped.filter(isInactive)
    return { upcoming, today, past, cancelled, all: scoped }
  }, [scoped, now, todayKey])

  const [view, setView] = useState<View>(() =>
    bookings.some((b) => !isInactive(b) && new Date(b.endTime).getTime() > Date.now()) ? "upcoming" : "all",
  )
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const list = useMemo(() => {
    const rows = [...buckets[view]]
    const ascending = view === "upcoming" || view === "today"
    rows.sort((a, b) => {
      const diff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      return ascending ? diff : -diff
    })
    return rows
  }, [buckets, view])

  const visible = list.slice(0, visibleCount)
  const groups = useMemo(() => {
    const map = new Map<string, AdminBookingRow[]>()
    for (const booking of visible) {
      const key = nairobiDayKey(new Date(booking.startTime))
      map.set(key, [...(map.get(key) ?? []), booking])
    }
    return [...map.entries()]
  }, [visible])

  const needsAttention = scoped.filter((b) => describeStatus(b, now).attention).length

  function selectView(next: View) {
    setView(next)
    setVisibleCount(PAGE_SIZE)
  }

  const summary = [
    `${buckets.today.length} today`,
    needsAttention > 0 ? `${needsAttention} awaiting payment or failed` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="space-y-6">
      <LargeTitle title={`${buckets.upcoming.length} upcoming`} subtitle={summary} />

      {/* Translucent bar; the list scrolls underneath it. */}
      <div className="sticky top-0 z-10 -mx-1 flex flex-col gap-2 bg-background/75 px-5 py-2 backdrop-blur-xl backdrop-saturate-150 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl<View>
          label="Booking views"
          value={view}
          onChange={selectView}
          options={[
            { value: "upcoming", label: "Upcoming", count: buckets.upcoming.length },
            { value: "today", label: "Today", count: buckets.today.length },
            { value: "past", label: "Past", count: buckets.past.length },
            { value: "cancelled", label: "Cancelled", count: buckets.cancelled.length },
            { value: "all", label: "All", count: buckets.all.length },
          ]}
        />
        {venues.length > 1 ? (
          <Select value={venueId} onValueChange={(value) => { setVenueId(value); setVisibleCount(PAGE_SIZE) }}>
            <SelectTrigger className="sm:w-52" aria-label="Filter by venue">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All venues</SelectItem>
              {venues.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <p className="text-[17px] font-semibold">
            {view === "upcoming" ? "No upcoming bookings" : view === "today" ? "Nothing booked today" : "No bookings"}
          </p>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {searched.length !== bookings.length ? "Try clearing the search." : "New bookings appear here as players book."}
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map(([key, rows]) => {
            const dayTotal = rows.filter((b) => b.paymentStatus === "paid").reduce((sum, b) => sum + Number(b.totalAmount), 0)
            return (
              <section key={key}>
                <SectionHeader accessory={dayTotal > 0 ? `KES ${dayTotal.toLocaleString("en-KE")} paid` : undefined}>
                  {dayHeading(key, todayKey, tomorrowKey, yesterdayKey)}
                </SectionHeader>
                <GroupedList>
                  {rows.map((booking) => {
                    const start = new Date(booking.startTime)
                    const end = new Date(booking.endTime)
                    const status = describeStatus(booking, now)
                    const deleted = booking.userEmail.endsWith(DELETED_EMAIL_SUFFIX)
                    const inactive = isInactive(booking)
                    return (
                      <li key={booking.id}>
                        <Link
                          href={`/admin/bookings/${booking.id}`}
                          className="flex items-center gap-4 px-4 py-3 transition-colors duration-100 hover:bg-muted/30 active:bg-muted/60"
                        >
                          <div className="w-[4.5rem] shrink-0">
                            <p className={`text-[15px] font-semibold tabular-nums ${inactive ? "text-muted-foreground" : ""}`}>
                              {timeFormat.format(start)}
                            </p>
                            <p className="text-[13px] text-muted-foreground">{durationLabel(start, end)}</p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-[15px] ${inactive || deleted ? "text-muted-foreground" : "font-medium"}`}>
                              {deleted ? "Deleted player" : booking.userName}
                            </p>
                            <p className="truncate text-[13px] text-muted-foreground">
                              {booking.resourceName}
                              {venues.length > 1 ? ` · ${booking.locationName}` : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`text-[15px] tabular-nums ${inactive ? "text-muted-foreground" : ""}`}>
                              {formatMoney(booking.totalAmount, booking.currency)}
                            </p>
                            <p className={`text-[13px] ${status.attention ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                              {status.label}
                            </p>
                          </div>
                          <CaretRightIcon size={14} className="shrink-0 text-muted-foreground/50" aria-hidden />
                        </Link>
                      </li>
                    )
                  })}
                </GroupedList>
              </section>
            )
          })}
        </div>
      )}

      {list.length > visibleCount ? (
        <p className="text-center text-[13px] text-muted-foreground">
          Showing {visible.length} of {list.length} ·{" "}
          <button type="button" className={textActionClass} onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
            Show more
          </button>
        </p>
      ) : null}

      {bookings.length >= limit ? (
        <p className="text-center text-[13px] text-muted-foreground">Showing the latest {limit} bookings.</p>
      ) : null}
    </div>
  )
}
