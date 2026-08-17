export const DEFAULT_DEBOUNCE_MS = 80

/**
 * @param {number} [debounceMs]
 */
export function createDebouncer(debounceMs = DEFAULT_DEBOUNCE_MS) {
  /** @type {Map<string, number>} */
  const lastPressAtBySide = new Map()

  return {
    /**
     * @param {"a" | "b"} side
     * @param {number} [now]
     */
    shouldAcceptPress(side, now = Date.now()) {
      const last = lastPressAtBySide.get(side) ?? 0

      if (now - last < debounceMs) {
        return false
      }

      lastPressAtBySide.set(side, now)
      return true
    },
  }
}
