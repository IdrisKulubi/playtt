import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder")
const resendFromEmail =
  process.env.RESEND_FROM_EMAIL?.trim().toLowerCase() || "onboarding@resend.dev"

export async function sendBookingConfirmationEmail(input: {
  email: string
  name: string
  locationName: string
  resourceName: string
  startTime: Date
  endTime: Date
  totalAmount: string
  currency: string
}) {
  if (!process.env.RESEND_API_KEY?.trim()) {
    return
  }

  const startLabel = input.startTime.toLocaleString("en-KE", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
  const endLabel = input.endTime.toLocaleTimeString("en-KE", {
    hour: "numeric",
    minute: "2-digit",
  })

  const html = `
    <p>Hi ${input.name},</p>
    <p>Your PlayTT booking is confirmed.</p>
    <p><strong>${input.locationName}</strong> · ${input.resourceName}</p>
    <p>${startLabel} – ${endLabel}</p>
    <p>Total: ${input.currency} ${input.totalAmount}</p>
    <p>See you on the table.</p>
  `

  await resend.emails.send({
    from: resendFromEmail,
    to: input.email,
    subject: "Your PlayTT booking is confirmed",
    html,
  })
}
