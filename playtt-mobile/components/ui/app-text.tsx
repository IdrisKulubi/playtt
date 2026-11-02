import { Text, type TextProps, type TextStyle } from "react-native"

import type { ColorRoles } from "@/constants/colors"
import { typeStyle, type TypeVariant } from "@/constants/type"
import { useAppTheme } from "@/hooks/use-app-theme"

type TextColorRole = Extract<
  keyof ColorRoles,
  | "label"
  | "secondaryLabel"
  | "tertiaryLabel"
  | "accentText"
  | "onAccent"
  | "success"
  | "warning"
  | "destructive"
>

export type AppTextProps = TextProps & {
  variant?: TypeVariant
  /** Colour role from the theme; defaults to `label`. */
  color?: TextColorRole
  /** Emphasise with weight before reaching for a bigger size. */
  weight?: TextStyle["fontWeight"]
  /** Fixed-width digits so counting numbers don't jitter. */
  tabular?: boolean
}

/**
 * The only way to put text on screen in redesigned UI. Font scaling always
 * stays on; chrome caps growth with `maxFontSizeMultiplier`.
 */
export function AppText({
  variant = "body",
  color = "label",
  weight,
  tabular = false,
  style,
  ...rest
}: AppTextProps) {
  const { colors } = useAppTheme()

  return (
    <Text
      {...rest}
      allowFontScaling
      style={[
        typeStyle(variant, weight),
        { color: colors[color] },
        tabular ? { fontVariant: ["tabular-nums"] } : null,
        style,
      ]}
    />
  )
}
