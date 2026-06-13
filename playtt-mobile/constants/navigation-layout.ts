/** Height of the floating tab bar pill (excluding bottom safe area). */
export const FLOATING_TAB_BAR_PILL_HEIGHT = 76

/** Extra bottom padding so scroll content clears the floating tab bar. */
export const FLOATING_TAB_BAR_CLEARANCE = 92

/** @deprecated Use useFloatingTabBarInset() for fixed footers like coach chat. */
export const COACH_CHAT_FOOTER_CLEARANCE = 92

export function getFloatingTabBarInset(bottomSafeArea = 0) {
  return bottomSafeArea + FLOATING_TAB_BAR_PILL_HEIGHT
}
