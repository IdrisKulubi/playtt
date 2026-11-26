// Dates in emails are always shown in the venue's time zone: the server runs
// in UTC, and a 6 PM game must read 6 PM wherever the email is opened.

export const DEFAULT_EMAIL_TIME_ZONE = "Africa/Nairobi"

export function formatDay(date: Date, timeZone = DEFAULT_EMAIL_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-KE", { weekday: "long", day: "numeric", month: "long", timeZone }).format(date)
}

export function formatTime(date: Date, timeZone = DEFAULT_EMAIL_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-KE", { hour: "numeric", minute: "2-digit", timeZone }).format(date)
}

export function formatTimeRange(start: Date, end: Date, timeZone = DEFAULT_EMAIL_TIME_ZONE) {
  return `${formatTime(start, timeZone)} – ${formatTime(end, timeZone)}`
}

export function formatDuration(start: Date, end: Date) {
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`
}

export function formatMoney(amount: string | number, currency: string) {
  const value = Number(amount)
  return `${currency} ${Number.isFinite(value) ? value.toLocaleString("en-KE", { maximumFractionDigits: 2 }) : amount}`
}

export function firstName(name: string | null | undefined, fallback = "there") {
  return (name ?? "").trim().split(/\s+/)[0] || fallback
}
