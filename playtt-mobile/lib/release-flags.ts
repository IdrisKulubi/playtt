/**
 * Features that are not finished stay out of release builds, so App Review only
 * sees the finished app. Turn one on for a build with its EXPO_PUBLIC_* variable
 * (see eas.json); development builds always show them.
 */

/** Coach (AI chat, insights, training). Needs a live AI backend and its consent flow. */
export const COACH_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_COACH_ENABLED === "true"

/** Buying replay packs. On iPhone this needs Apple In-App Purchase (Guideline 3.1.1). */
export const REPLAY_PURCHASES_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_REPLAY_PURCHASES === "true"

/** Public pages for the privacy policy and terms (also linked in App Store Connect). */
export const PRIVACY_URL = "https://www.theplaytt.com/privacy"
export const TERMS_URL = "https://www.theplaytt.com/terms"
export const SUPPORT_URL = "https://www.theplaytt.com/support"
export const SUPPORT_EMAIL = "hello@theplaytt.com"
