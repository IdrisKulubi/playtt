import type { ReactElement } from "react"

import { Resend } from "resend"

import { renderEmail } from "@/emails/render"

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder")

export const EMAIL_FROM = process.env.RESEND_FROM_EMAIL?.trim().toLowerCase() || "onboarding@resend.dev"

/**
 * Renders a React Email template and sends it through Resend. Every PlayTT
 * email goes through here, so they all look and behave the same.
 */
export async function sendPlayttEmail(input: {
  to: string
  subject: string
  email: ReactElement
  /** Resend de-duplicates retries with the same key. */
  idempotencyKey?: string
  /** Used in errors so logs say which email failed. */
  kind: string
}) {
  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error(`Email provider is not configured (${input.kind}).`)
  }

  const { html, text } = await renderEmail(input.email)

  const result = await resend.emails.send(
    { from: EMAIL_FROM, to: input.to, subject: input.subject, html, text },
    input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
  )

  if (result.error) {
    const domain = EMAIL_FROM.split("@")[1] || EMAIL_FROM
    throw new Error(
      `Email provider rejected the ${input.kind} email. Check the sender domain is verified in Resend (${domain}).`,
    )
  }

  return result.data
}
