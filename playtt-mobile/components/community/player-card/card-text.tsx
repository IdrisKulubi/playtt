import { Text, type TextProps } from "react-native"

/**
 * How far text on the card art may grow with the phone's text size. The card
 * is a fixed-proportion artwork, so unbounded scaling would break it; the
 * card's accessibility label carries every detail for screen readers, and
 * the profile repeats the important facts as normal, fully scalable text.
 */
export const CARD_MAX_FONT_SCALE = 1.2

/** Text on the card faces (front and back). Mini cards use AppText instead. */
export function CardText(props: TextProps) {
  return <Text maxFontSizeMultiplier={CARD_MAX_FONT_SCALE} {...props} />
}
