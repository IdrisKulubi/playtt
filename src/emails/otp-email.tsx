import {
  EmailCode,
  EmailFinePrint,
  EmailHero,
  EmailLayout,
  EmailText,
  firstName,
} from "@/emails/components"

export type OtpEmailPurpose =
  | "email-verification"
  | "forget-password"
  | "sign-in"
  | "change-email"
  | "two-factor"
  | "remote-unlock"

export interface OtpEmailProps {
  otp: string
  purpose: OtpEmailPurpose
  name?: string
  email?: string
  /** Minutes until the code stops working. */
  expiresInMinutes?: number
}

const COPY: Record<OtpEmailPurpose, { subject: string; eyebrow: string; title: string; lede: string }> = {
  "email-verification": {
    subject: "Verify your email address",
    eyebrow: "Welcome to PlayTT",
    title: "Confirm it's you.",
    lede: "Enter this code in PlayTT to finish setting up your account.",
  },
  "sign-in": {
    subject: "Your PlayTT sign-in code",
    eyebrow: "Sign in",
    title: "Here's your sign-in code.",
    lede: "Enter it in PlayTT to continue.",
  },
  "forget-password": {
    subject: "Reset your PlayTT password",
    eyebrow: "Password reset",
    title: "Reset your password.",
    lede: "Enter this code in PlayTT, then choose a new password.",
  },
  "change-email": {
    subject: "Confirm your new email address",
    eyebrow: "Email change",
    title: "Confirm your new email.",
    lede: "Enter this code in PlayTT to start using this address.",
  },
  "two-factor": {
    subject: "Your PlayTT security code",
    eyebrow: "Two-step sign-in",
    title: "Your security code.",
    lede: "Enter it in PlayTT to finish signing in.",
  },
  "remote-unlock": {
    subject: "PlayTT remote unlock verification code",
    eyebrow: "Remote unlock",
    title: "Confirm the unlock.",
    lede: "Enter this code in PlayTT admin to unlock the venue door.",
  },
}

export function otpEmailSubject(purpose: OtpEmailPurpose) {
  return COPY[purpose].subject
}

export default function OtpEmail({ otp, purpose, name, email, expiresInMinutes = 5 }: OtpEmailProps) {
  const copy = COPY[purpose]

  return (
    <EmailLayout
      preview={`${copy.title} Your code is ${otp}.`}
      footerNote={email ? `Sent to ${email} because a code was requested for this address.` : undefined}
    >
      <EmailHero
        eyebrow={copy.eyebrow}
        title={name ? `${copy.title.replace(/\.$/, "")}, ${firstName(name)}.` : copy.title}
        lede={copy.lede}
      />
      <EmailCode code={otp} caption={`Expires in ${expiresInMinutes} minutes`} />
      <EmailText muted>Never share this code. PlayTT staff will never ask you for it.</EmailText>
      <EmailFinePrint>
        Didn&apos;t ask for this? You can ignore this email: nothing changes unless the code is entered. PlayTT
        emails only come from theplaytt.com.
      </EmailFinePrint>
    </EmailLayout>
  )
}

OtpEmail.PreviewProps = {
  otp: "482916",
  purpose: "sign-in",
  name: "Amina Otieno",
  email: "amina@example.com",
} satisfies OtpEmailProps
