/** Deterministic preview code — not a real lock credential. */
export function mockEntryCode(bookingId: string) {
  let hash = 0

  for (let index = 0; index < bookingId.length; index += 1) {
    hash = (hash * 31 + bookingId.charCodeAt(index)) >>> 0
  }

  return String(100000 + (hash % 900000))
}
