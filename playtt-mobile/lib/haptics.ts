import * as Haptics from "expo-haptics"

/**
 * The four haptic moments in the redesign. Fire on the same frame as the
 * visual change. No haptics for scrolling, typing or ordinary navigation.
 */

function run(effect: () => Promise<void>) {
  if (process.env.EXPO_OS === "web") return
  void effect().catch(() => undefined)
}

export const haptics = {
  /** Tab change, picking a time slot. */
  selection: () => run(() => Haptics.selectionAsync()),
  /** Sheet snaps open, toggle flips. */
  commit: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Booking confirmed, payment done. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Payment failed, slot just taken. */
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
}
