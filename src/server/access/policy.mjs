import { createHmac, randomInt } from "node:crypto"

export const DEFAULT_EARLY_ENTRY_MINUTES = 5
export const DEFAULT_ACCESS_GRACE_MINUTES = 5

function boundedMinutes(value, fallback) {
  return Number.isInteger(value) && value >= 0 && value <= 60 ? value : fallback
}

export function resolveAccessWindow({ startTime, endTime, venueSettings = null }) {
  const start = new Date(startTime)
  const end = new Date(endTime)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new TypeError("Access window requires valid booking timestamps.")
  }
  if (end <= start) throw new RangeError("Booking end must be after start.")

  const earlyEntryMinutes = boundedMinutes(
    venueSettings?.earlyEntryMinutes,
    DEFAULT_EARLY_ENTRY_MINUTES,
  )
  const gracePeriodMinutes = boundedMinutes(
    venueSettings?.gracePeriodMinutes,
    DEFAULT_ACCESS_GRACE_MINUTES,
  )

  return {
    validFrom: new Date(start.getTime() - earlyEntryMinutes * 60_000),
    validUntil: new Date(end.getTime() + gracePeriodMinutes * 60_000),
    earlyEntryMinutes,
    gracePeriodMinutes,
  }
}

export function generateBookingPasscode(randomInteger = randomInt) {
  return String(randomInteger(10_000_000, 100_000_000))
}

export function fingerprintPasscode(passcode, fingerprintKey) {
  if (!/^\d{8}$/.test(passcode)) throw new TypeError("Passcode must be eight digits.")
  if (!fingerprintKey) throw new TypeError("Passcode fingerprint key is required.")
  return createHmac("sha256", fingerprintKey).update(passcode).digest("hex")
}

export function buildProviderPasscodeName(grantId, credentialId) {
  if (!grantId || !credentialId) throw new TypeError("Grant and credential IDs are required.")
  return `playtt:${grantId}:${credentialId}`
}
