const SECRET_KEY_PATTERN =
  /(?:password|secret|token|credential|api[_-]?key|private[_-]?key)/i

export function filterEdgeConfigSecrets(
  config: Record<string, unknown>,
  deviceType: string,
): Record<string, unknown> {
  if (deviceType === "venue_edge") {
    return config
  }

  return redactSecrets(config) as Record<string, unknown>
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSecrets(entry))
  }

  if (!value || typeof value !== "object") {
    return value
  }

  const output: Record<string, unknown> = {}

  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      output[key] = "[redacted]"
      continue
    }

    output[key] = redactSecrets(nested)
  }

  return output
}
