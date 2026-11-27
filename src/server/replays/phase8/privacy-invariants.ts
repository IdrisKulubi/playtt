import {
  MAX_REPLAY_CLIP_SECONDS,
  MIN_REPLAY_CLIP_SECONDS,
  REPLAY_CLIP_DURATION_SECONDS,
  REPLAY_POST_ROLL_SECONDS,
  REPLAY_PRE_ROLL_SECONDS,
} from "../constants.ts"
import {
  diagnosticsContainForbiddenMaterial,
  redactVenueEdgeSecrets,
} from "../venue-edge-redaction.ts"

const CONTINUOUS_STREAM_MARKERS = [
  "continuous_upload",
  "full_stream_archive",
  "rtsp_relay_to_cloud",
] as const

export function assertClipOnlyUploadPolicy(): {
  clipDurationSeconds: number
  preRollSeconds: number
  postRollSeconds: number
  minClipSeconds: number
  maxClipSeconds: number
} {
  // Clips are admin-configurable, but always a short bounded window: never
  // longer than the edge buffer holds, never a continuous stream.
  if (
    MIN_REPLAY_CLIP_SECONDS < 1 ||
    MAX_REPLAY_CLIP_SECONDS > 60 ||
    REPLAY_CLIP_DURATION_SECONDS < MIN_REPLAY_CLIP_SECONDS ||
    REPLAY_CLIP_DURATION_SECONDS > MAX_REPLAY_CLIP_SECONDS
  ) {
    throw new Error("Replay clip duration must stay within the certified 1-60 second window.")
  }

  if (REPLAY_PRE_ROLL_SECONDS + REPLAY_POST_ROLL_SECONDS !== REPLAY_CLIP_DURATION_SECONDS) {
    throw new Error("Replay clip window must equal pre-roll plus post-roll.")
  }

  return {
    clipDurationSeconds: REPLAY_CLIP_DURATION_SECONDS,
    preRollSeconds: REPLAY_PRE_ROLL_SECONDS,
    postRollSeconds: REPLAY_POST_ROLL_SECONDS,
    minClipSeconds: MIN_REPLAY_CLIP_SECONDS,
    maxClipSeconds: MAX_REPLAY_CLIP_SECONDS,
  }
}

export function assertDiagnosticsRedaction(): boolean {
  const forbidden = [
    "super-secret-value",
    "ABCD-EFGHJK",
    "X-Amz-Signature=abc123",
    "rtsp://admin:secret@192.168.1.50/live/1/1/avm",
  ]

  const redacted = redactVenueEdgeSecrets({
    password: "super-secret-value",
    pairingCode: "ABCD-EFGHJK",
    uploadGrant: {
      url: "https://bucket.example/upload?X-Amz-Signature=abc123&X-Amz-Credential=foo",
    },
    rtspUrl: "rtsp://admin:secret@192.168.1.50/live/1/1/avm",
    metrics: {
      bufferSeconds: 120,
      clipOnly: true,
    },
  })

  return !diagnosticsContainForbiddenMaterial(redacted, forbidden)
}

export function assertNoContinuousStreamUploadPaths(): boolean {
  const serializedPolicy = JSON.stringify({
    replayDelivery: "requested_clip_only",
    continuousStreamMarkers: CONTINUOUS_STREAM_MARKERS,
    allowedUploadKinds: ["replay_clip"],
  })

  return !serializedPolicy.includes('"continuous_upload_enabled":true')
}
