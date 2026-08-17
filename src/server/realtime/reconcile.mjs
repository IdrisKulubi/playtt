/**
 * Decide how a display client should react to a score hint.
 * @param {number | null | undefined} localVersion
 * @param {number | null | undefined} hintVersion
 * @returns {"apply" | "refetch" | "noop" | "ignore"}
 */
export function reconcileScoreHint(localVersion, hintVersion) {
  if (hintVersion == null || Number.isNaN(hintVersion)) {
    return "ignore"
  }

  if (localVersion == null || Number.isNaN(localVersion)) {
    return "refetch"
  }

  if (hintVersion === localVersion) {
    return "noop"
  }

  if (hintVersion === localVersion + 1) {
    return "apply"
  }

  return "refetch"
}
