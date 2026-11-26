// What the table tablet says when a replay can't be saved. Players read these,
// so they explain what happened and what to do, in plain words, never codes.

export interface KioskNotice {
  title: string
  detail: string
  /** "retry": the player can fix it by tapping Replay again (button in brand cyan). */
  action: "retry" | "ok"
  /** Closes by itself after this long, for things players can't fix. */
  autoDismissMs?: number
}

const NOT_SET_UP: KioskNotice = {
  title: "Replays aren't set up here yet",
  detail: "This venue hasn't switched on replays. Ask staff for help.",
  action: "ok",
}

const NO_CAMERA: KioskNotice = {
  title: "This table has no camera yet",
  detail: "Replays aren't available on this table right now. Ask staff to set up its camera.",
  action: "ok",
}

const RECORDER_OFFLINE: KioskNotice = {
  title: "Replays are offline for a moment",
  detail: "The venue's recorder isn't connected. Keep playing and try again in a few minutes, or ask staff.",
  action: "retry",
}

const DID_NOT_SAVE: KioskNotice = {
  title: "That replay didn't save",
  detail: "Something interrupted it. Tap Replay to try again.",
  action: "retry",
}

export const NETWORK_NOTICE: KioskNotice = {
  title: "No connection",
  detail: "The tablet couldn't reach PlayTT. Check the Wi-Fi and try again.",
  action: "retry",
}

/** The replay request was refused before capture started. */
export function noticeForRequestError(code: string | undefined): KioskNotice {
  switch (code) {
    case "SESSION_NOT_ACTIVE":
      return {
        title: "Replays start with your session",
        detail: "Replay works while a booked session is running on this table. Book in the PlayTT app to play here.",
        action: "ok",
        autoDismissMs: 8_000,
      }
    case "NO_CREDITS":
      return {
        title: "You're out of replay clips",
        detail: "Buy a clip pack in the PlayTT app, then tap Replay again.",
        action: "ok",
      }
    case "REPLAY_IN_FLIGHT":
      return {
        title: "Already saving a replay",
        detail: "Your last tap is still being saved. It plays on the TV in a moment.",
        action: "ok",
        autoDismissMs: 5_000,
      }
    case "VENUE_EDGE_UNAVAILABLE":
      return RECORDER_OFFLINE
    case "REPLAY_EDGE_DISABLED":
    case "PRIVATE_MEDIA_DISABLED":
    case "EDGE_CONFIG_NOT_READY":
    case "EDGE_CONFIG_REVISION_MISSING":
      return NOT_SET_UP
    case "RESOURCE_NOT_FOUND":
      return {
        title: "This tablet isn't linked to a table",
        detail: "Ask staff to open the tablet page for this table again.",
        action: "ok",
      }
    default:
      return DID_NOT_SAVE
  }
}

/** Capture started but finished in a failed state. */
export function noticeForCaptureFailure(status: string, reason: string | null): KioskNotice {
  if (reason === "resource_not_configured" || reason === "no_source_configured") {
    return NO_CAMERA
  }
  if (status === "edge_offline") return RECORDER_OFFLINE
  if (status === "buffer_missing") {
    return {
      title: "The camera is still warming up",
      detail: "Give it a few seconds, then tap Replay again.",
      action: "retry",
    }
  }
  return DID_NOT_SAVE
}
