export const NOTIFICATION_PREFERENCE_KEYS = [
  "accessReady",
  "accessFailed",
  "sessionReminder",
  "sessionWarning",
  "sessionEnded",
  "replayReady",
  "communityMessages",
  "communityFollows",
  "communityOpenToPlay",
  "communityKudos",
] as const

export type NotificationPreferenceKey =
  (typeof NOTIFICATION_PREFERENCE_KEYS)[number]

export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  accessReady: true,
  accessFailed: true,
  sessionReminder: true,
  sessionWarning: true,
  sessionEnded: true,
  replayReady: true,
  communityMessages: true,
  communityFollows: true,
  communityOpenToPlay: true,
  communityKudos: true,
}

export const NOTIFICATION_TEMPLATE_COPY: Record<
  string,
  { title: string; body: (bookingId?: string) => string }
> = {
  access_ready: {
    title: "Venue access is ready",
    body: () => "Your door code is ready to reveal in the PlayTT app.",
  },
  access_failed: {
    title: "Venue access needs attention",
    body: () => "Venue support is preparing a safe access alternative.",
  },
  session_reminder: {
    title: "Session starting soon",
    body: () => "Your table session is about to begin.",
  },
  session_warning: {
    title: "Five minutes remaining",
    body: () => "Your session ends in five minutes.",
  },
  session_ended: {
    title: "Session ended",
    body: () => "Thanks for playing. Venue automation is completing.",
  },
  replay_ready: {
    title: "Replay ready",
    body: () => "A clip from your session is ready to watch.",
  },
  // Community copy is personalised per event (sender name, preview), so the
  // worker passes `copy` to queueAndDeliverPushNotification. These are fallbacks.
  community_message: {
    title: "New message",
    body: () => "You have a new message in Community.",
  },
  community_message_request: {
    title: "New message request",
    body: () => "Someone wants to play. Open Community to reply.",
  },
  community_follow: {
    title: "New follower",
    body: () => "Someone started following you.",
  },
  community_followee_open: {
    title: "Someone you follow is open to play",
    body: () => "Open Community to say hi.",
  },
  community_kudos: {
    title: "You got kudos",
    body: () => "A player gave you kudos.",
  },
  community_play_again: {
    title: "Play again?",
    body: () => "Fancy another match?",
  },
}

export const notificationNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Cookie, Authorization, x-tenant-id",
}
