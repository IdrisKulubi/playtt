import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder")
const resendFromEmail =
  process.env.RESEND_FROM_EMAIL?.trim().toLowerCase() || "onboarding@resend.dev"

export async function sendReplayReadyEmail(input: {
  email: string
  name: string
  locationName: string
  title: string
  replayUrl: string
  idempotencyKey: string
}) {
  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error("Replay ready email provider is not configured.")
  }

  const html = `
    <p>Hi ${input.name},</p>
    <p>Your PlayTT highlight is ready.</p>
    <p><strong>${input.title}</strong> at ${input.locationName}</p>
    <p><a href="${input.replayUrl}">Watch your clip</a></p>
    <p>This link opens in the PlayTT app and does not expire like a temporary media URL.</p>
  `

  const result = await resend.emails.send(
    {
      from: resendFromEmail,
      to: input.email,
      subject: "Your PlayTT highlight is ready",
      html,
    },
    { idempotencyKey: input.idempotencyKey },
  )

  if (result.error) {
    throw new Error("Replay ready email provider rejected the request.")
  }
}
