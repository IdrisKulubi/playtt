import { z } from "zod/v3"

import { THEME_RENDERERS } from "@/lib/display-themes"
import { DisplayThemeError } from "@/server/display/themes-service"
import { mapOperatorError, operatorError } from "@/server/operator/http"

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colours must be hex values like #00b7ff.")

export const themeInputSchema = z.object({
  name: z.string().trim().min(1, "Give the theme a name.").max(48, "Keep the name under 48 characters."),
  renderer: z.enum(THEME_RENDERERS),
  palette: z.object({ base: hex, accent: hex, light: hex, deep: hex }),
  ink: z.enum(["light", "dark"]),
})

export function mapDisplayThemeError(error: unknown) {
  if (error instanceof DisplayThemeError) {
    return operatorError({ code: error.code, message: error.message, status: error.status })
  }
  return mapOperatorError(error)
}
