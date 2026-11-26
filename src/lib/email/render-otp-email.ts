import type { OtpEmailPurpose } from "@/emails/otp-email"

/** HTML for a one-time-code email (sign in, verify, reset, 2FA, remote unlock). */
export async function renderOtpEmailHtml(input: {
  otp: string
  purpose: OtpEmailPurpose
  name?: string
  email?: string
  expiresInMinutes?: number
}) {
  const [{ renderEmail }, { default: OtpEmail }] = await Promise.all([
    import("@/emails/render"),
    import("@/emails/otp-email"),
  ])

  const { html } = await renderEmail(OtpEmail(input))
  return html
}
