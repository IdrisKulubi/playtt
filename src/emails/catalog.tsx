// Every email PlayTT sends, with sample data, for the dev preview page at
// /dev/emails. Add new templates here so they can be checked before sending.

import type { ReactElement } from "react"

import BookingConfirmedEmail from "@/emails/booking-confirmed-email"
import BookingTableChangedEmail from "@/emails/booking-table-changed-email"
import OtpEmail, { otpEmailSubject, type OtpEmailPurpose } from "@/emails/otp-email"
import ReplayReadyEmail from "@/emails/replay-ready-email"

export interface EmailCatalogEntry {
  id: string
  name: string
  subject: string
  render: () => ReactElement
}

const otp = (purpose: OtpEmailPurpose, name: string): EmailCatalogEntry => ({
  id: `otp-${purpose}`,
  name,
  subject: otpEmailSubject(purpose),
  render: () => (
    <OtpEmail
      {...OtpEmail.PreviewProps}
      purpose={purpose}
      expiresInMinutes={purpose === "remote-unlock" ? 10 : 5}
    />
  ),
})

export const EMAIL_CATALOG: EmailCatalogEntry[] = [
  {
    id: "booking-confirmed",
    name: "Booking confirmed",
    subject: "You're booked at PlayTT Hurlingham",
    render: () => <BookingConfirmedEmail {...BookingConfirmedEmail.PreviewProps} />,
  },
  {
    id: "booking-table-changed",
    name: "Table changed",
    subject: "Your PlayTT booking is now on Table 1",
    render: () => <BookingTableChangedEmail {...BookingTableChangedEmail.PreviewProps} />,
  },
  {
    id: "replay-ready",
    name: "Replay ready",
    subject: "Your PlayTT highlight is ready",
    render: () => <ReplayReadyEmail {...ReplayReadyEmail.PreviewProps} />,
  },
  otp("sign-in", "Sign-in code"),
  otp("email-verification", "Verify email"),
  otp("forget-password", "Password reset"),
  otp("change-email", "Change email"),
  otp("two-factor", "Two-step code"),
  otp("remote-unlock", "Remote unlock (admin)"),
]
