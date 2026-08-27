const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface CaptureReplayCommandPayloadInput {
  replayRequestId: string
  replayId: string
  mediaAssetId: string
  objectKey: string
  captureAt: string
  preRollSeconds: number
  postRollSeconds: number
  sourceType: string
  resourceId: string
  playSessionId: string
  configRevisionId: string
  uploadGrant: {
    url: string
    expiresAt: string
    contentType?: string
  }
}

export function buildCaptureReplayCommandPayload(
  input: CaptureReplayCommandPayloadInput
): Record<string, unknown> {
  if (!UUID_PATTERN.test(input.configRevisionId)) {
    throw new TypeError(
      "Capture replay commands require a valid configRevisionId."
    )
  }

  return { ...input }
}
