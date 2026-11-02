import { PlayTTRadius, PlayTTSpacing } from "@/constants/playtt-tokens"

/** Layout tokens shared by the redesign component kit (`components/kit/`). */
export const KitLayout = {
  /** Smallest tappable size (Apple's minimum is 44; we design for 48). */
  minTouchTarget: 48,
  /** Gap kept between neighbouring touch targets. */
  touchGap: PlayTTSpacing.xs,
  /** Side margin for screen content. */
  screenGutter: PlayTTSpacing.md,
  rowMinHeight: 56,
  buttonHeight: 50,
  iconTile: 30,
  cardRadius: 20,
  groupRadius: 12,
  sheetRadius: PlayTTRadius.panel,
} as const
