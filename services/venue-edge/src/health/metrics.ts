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

    if (typeof nested === "string" && shouldRedactUrlValue(key, nested)) {
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
  maxConcurrentReplays: number
  bufferingSourceCount?: number
  ffmpegProcessCount?: number
}

export function createMetricsSnapshot(input: {
  bufferAgeSeconds?: number | null
  diskUsageBytes?: number
  ffmpegRunning?: boolean
  uploadQueueDepth?: number
  activeReplayJobs?: number
  maxConcurrentReplays?: number
  bufferingSourceCount?: number
  ffmpegProcessCount?: number
}): EdgeMetrics {
  return {
    bufferAgeSeconds: input.bufferAgeSeconds ?? null,
    diskUsageBytes: input.diskUsageBytes ?? 0,
    ffmpegRunning: input.ffmpegRunning ?? false,
    uploadQueueDepth: input.uploadQueueDepth ?? 0,
    activeReplayJobs: input.activeReplayJobs ?? 0,
    maxConcurrentReplays: input.maxConcurrentReplays ?? 0,
    bufferingSourceCount: input.bufferingSourceCount ?? 0,
    ffmpegProcessCount: input.ffmpegProcessCount ?? 0,
  }
}
