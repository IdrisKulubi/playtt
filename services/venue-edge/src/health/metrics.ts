const SECRET_KEY_PATTERN =
  /(?:password|secret|token|credential|api[_-]?key|private[_-]?key|rtsp:\/\/[^@\s]+@)/i

const SECRET_VALUE_PATTERNS = [
  /Device\s+[0-9a-f-]+\s+[A-Za-z0-9+/=_-]{8,}/i,
  /X-Amz-Credential=[^&\s]+/i,
  /X-Amz-Signature=[^&\s]+/i,
  /https?:\/\/[^@\s]+@[^/\s]+/i,
  /rtsp:\/\/[^@\s]+@[^/\s]+/i,
]

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSecrets(entry))
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

    output[key] = redactSecrets(nested)
  }

  return output
}

export function redactStringSecrets(value: string): string {
  let output = value

  for (const pattern of SECRET_VALUE_PATTERNS) {
    output = output.replace(pattern, "[redacted]")
  }

  return output
}

export function safeLog(
  level: "info" | "warn" | "error",
  message: string,
  context?: Record<string, unknown>,
): void {
  const payload = context ? redactSecrets(context) : undefined
  const line = payload
    ? `${message} ${JSON.stringify(payload)}`
    : message

  if (level === "error") {
    console.error(line)
    return
  }

  if (level === "warn") {
    console.warn(line)
    return
  }

  console.log(line)
}

export interface EdgeMetrics {
  bufferAgeSeconds: number | null
  diskUsageBytes: number
  ffmpegRunning: boolean
  uploadQueueDepth: number
  activeReplayJobs: number
}

export function createMetricsSnapshot(input: {
  bufferAgeSeconds?: number | null
  diskUsageBytes?: number
  ffmpegRunning?: boolean
  uploadQueueDepth?: number
  activeReplayJobs?: number
}): EdgeMetrics {
  return {
    bufferAgeSeconds: input.bufferAgeSeconds ?? null,
    diskUsageBytes: input.diskUsageBytes ?? 0,
    ffmpegRunning: input.ffmpegRunning ?? false,
    uploadQueueDepth: input.uploadQueueDepth ?? 0,
    activeReplayJobs: input.activeReplayJobs ?? 0,
  }
}
