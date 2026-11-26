import type { ReactElement } from "react"

/** HTML plus a plain-text copy (better inbox placement, and for text-only clients). */
export async function renderEmail(element: ReactElement) {
  const { render } = await import("@react-email/components")
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })])
  return { html, text }
}
