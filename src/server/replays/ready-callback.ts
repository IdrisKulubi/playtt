import { createHash, timingSafeEqual } from "node:crypto"

export const REPLAY_VIDEO_URL_MAX_LENGTH = 2048
export const REPLAY_TITLE_MAX_LENGTH = 160

type ReplayReadyErrorBody = {
  code:
    | "INVALID_BODY"
    | "REPLAY_CALLBACK_UNAVAILABLE"
    | "UNAUTHORIZED"
    | "VALIDATION_ERROR"
  message: string
}

type ReplayReadyCallbackResult<T> =
  | { body: ReplayReadyErrorBody; status: 400 | 401 | 503 }
  | { body: { data: { replay: T } }; status: 200 }

export function verifyReplayReadySecret(input: {
  configuredSecret: string
  providedSecret: string | null
}) {
  const expected = createHash("sha256")
    .update(input.configuredSecret, "utf8")
    .digest()
  const provided = createHash("sha256")
    .update(input.providedSecret ?? "", "utf8")
    .digest()

  return timingSafeEqual(expected, provided)
}

function parseReplayReadyPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const candidate = value as { title?: unknown; videoUrl?: unknown }
  if (
    typeof candidate.videoUrl !== "string" ||
    candidate.videoUrl.length > REPLAY_VIDEO_URL_MAX_LENGTH
  ) {
    return null
  }

  const videoUrl = candidate.videoUrl.trim()
  if (!videoUrl || videoUrl.length > REPLAY_VIDEO_URL_MAX_LENGTH) {
    return null
  }

  try {
    const parsedUrl = new URL(videoUrl)
    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return null
    }
  } catch {
    return null
  }

  if (
    candidate.title !== undefined &&
    (typeof candidate.title !== "string" ||
      candidate.title.length > REPLAY_TITLE_MAX_LENGTH)
  ) {
    return null
  }

  const title =
    typeof candidate.title === "string" && candidate.title.trim()
      ? candidate.title.trim()
      : undefined

  return { title, videoUrl }
}

export async function processReplayReadyCallback<T>(input: {
  configuredSecret: string | undefined
  markReady: (payload: {
    replayId: string
    title?: string
    videoUrl: string
  }) => Promise<T>
  providedSecret: string | null
  rawBody: string
  replayId: string
}): Promise<ReplayReadyCallbackResult<T>> {
  const configuredSecret = input.configuredSecret?.trim()

  if (!configuredSecret) {
    return {
      body: {
        code: "REPLAY_CALLBACK_UNAVAILABLE",
        message: "Replay callback is temporarily unavailable.",
      },
      status: 503,
    }
  }

  if (
    !verifyReplayReadySecret({
      configuredSecret,
      providedSecret: input.providedSecret,
    })
  ) {
    return {
      body: {
        code: "UNAUTHORIZED",
        message: "Invalid replay webhook secret.",
      },
      status: 401,
    }
  }

  let requestBody: unknown

  try {
    requestBody = JSON.parse(input.rawBody) as unknown
  } catch {
    return {
      body: { code: "INVALID_BODY", message: "Invalid request body." },
      status: 400,
    }
  }

  const payload = parseReplayReadyPayload(requestBody)
  if (!payload) {
    return {
      body: {
        code: "VALIDATION_ERROR",
        message: "Invalid replay callback payload.",
      },
      status: 400,
    }
  }

  const replay = await input.markReady({
    replayId: input.replayId,
    title: payload.title,
    videoUrl: payload.videoUrl,
  })

  return { body: { data: { replay } }, status: 200 }
}
