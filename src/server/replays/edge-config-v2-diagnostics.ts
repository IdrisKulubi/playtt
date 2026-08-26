const SECRET_KEY_PATTERN =
  /(?:password|passwd|secret|token|credential|authorization|api[_-]?key|private[_-]?key)/i
const URL_CANDIDATE_PATTERN = /[a-z][a-z0-9+.-]*:\/\/[^\s<>"']+/gi

export const EDGE_CONFIG_V2_MAX_ERROR_DETAILS_BYTES = 16 * 1024

function scan(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scan(entry, `${path}[${index}]`))
    return
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key)) {
        throw new Error(
          `Configuration error details contain a secret-bearing field at ${path}.${key}.`
        )
      }
      scan(nested, `${path}.${key}`)
    }
    return
  }
  if (typeof value !== "string") return

  for (const candidate of value.match(URL_CANDIDATE_PATTERN) ?? []) {
    try {
      const url = new URL(candidate.replace(/[),.;]+$/, ""))
      const hasSecretQuery = [...url.searchParams.keys()].some((key) =>
        SECRET_KEY_PATTERN.test(key)
      )
      if (url.username || url.password || hasSecretQuery) {
        throw new Error(
          `Configuration error details contain a credentialized URL at ${path}.`
        )
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Configuration error details contain")
      ) {
        throw error
      }
    }
  }
}

export function assertSafeEdgeConfigV2ErrorDetails(
  details: Record<string, unknown>
): void {
  let serialized: string
  try {
    serialized = JSON.stringify(details)
  } catch {
    throw new Error("Configuration error details must be JSON serializable.")
  }
  if (
    new TextEncoder().encode(serialized).byteLength >
    EDGE_CONFIG_V2_MAX_ERROR_DETAILS_BYTES
  ) {
    throw new Error("Configuration error details exceed the 16 KiB limit.")
  }
  scan(details, "$.errorDetails")
}
