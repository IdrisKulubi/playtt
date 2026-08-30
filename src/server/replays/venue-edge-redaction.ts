const SECRET_KEY_PATTERN =
  /(?:password|secret|token|credential|api[_-]?key|private[_-]?key|authorization|pairing[_-]?code|uploadGrant|rtsp:\/\/[^@\s]+@)/i

const SECRET_VALUE_PATTERNS = [
  /Device\s+[0-9a-f-]+\s+[A-Za-z0-9+/=_-]{8,}/i,
  /[0-9A-HJ-NP-Z]{4}-[0-9A-HJ-NP-Z]{6}/,
  /X-Amz-Credential=[^&\s]+/i,
  /X-Amz-Signature=[^&\s]+/i,
  /https?:\/\/[^@\s]+@[^/\s]+/i,
  /rtsp:\/\/[^@\s]+@[^/\s]+/i,
  /https?:\/\/[^\s]*[?&](?:X-Amz-Signature|X-Amz-Credential)=[^&\s]+/i,
]

function shouldRedactUrlValue(key: string, value: string): boolean {
  if (key.toLowerCase() === "url" || key.toLowerCase() === "uploadgrant") {
    return /[?&](?:X-Amz-Signature|X-Amz-Credential)=/i.test(value)
  }

  return false
}

function redactStringSecrets(value: string): string {
  let output = value

  for (const pattern of SECRET_VALUE_PATTERNS) {
    output = output.replace(pattern, "[redacted]")
  }

  return output
}

export function redactVenueEdgeSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactVenueEdgeSecrets(entry))
  }

  if (!value || typeof value !== "object") {
    if (typeof value === "string") {
      return redactStringSecrets(value)
    }

    return value
  }

  const output: Record<string, unknown> = {}

  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      output[key] = "[redacted]"
      continue
    }

    if (typeof nested === "string" && shouldRedactUrlValue(key, nested)) {
      output[key] = "[redacted]"
      continue
    }

    output[key] = redactVenueEdgeSecrets(nested)
  }

  return output
}

export function diagnosticsContainForbiddenMaterial(
  payload: unknown,
  forbidden: string[],
): boolean {
  const serialized = JSON.stringify(payload)
  return forbidden.some((value) => serialized.includes(value))
}
