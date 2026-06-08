import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type OtpEmailPurpose =
  | "email-verification"
  | "forget-password"
  | "sign-in"
  | "change-email"
  | "two-factor";

interface OtpEmailProps {
  otp?: string;
  purpose?: OtpEmailPurpose;
}

const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const colors = {
  canvas: "#f5f5f7",
  foreground: "#0a1628",
  secondary: "#6b7280",
  tertiary: "#86868b",
  brand: "#00b7ff",
  divider: "#e5e5e5",
} as const;

function getEmailContent(purpose: OtpEmailPurpose) {
  switch (purpose) {
    case "forget-password":
      return {
        preview: "Your PlayTT password reset code",
        headline: "Reset your password",
        body: "Enter this code in PlayTT to choose a new password.",
      };
    case "sign-in":
      return {
        preview: "Your PlayTT sign-in code",
        headline: "Your sign-in code",
        body: "Use this code to finish signing in to your PlayTT account.",
      };
    case "change-email":
      return {
        preview: "Confirm your new PlayTT email",
        headline: "Confirm your new email",
        body: "Enter this code to confirm the email address on your PlayTT account.",
      };
    case "two-factor":
      return {
        preview: "Your PlayTT security code",
        headline: "Your security code",
        body: "Enter this code to complete two-factor authentication on your PlayTT account.",
      };
  }

  return {
    preview: "Your PlayTT verification code",
    headline: "Verify your email",
    body: "Enter this code to finish setting up your PlayTT account.",
  };
}

export default function OtpEmail({
  otp = "123456",
  purpose = "email-verification",
}: OtpEmailProps) {
  const content = getEmailContent(purpose);

  return (
    <Html>
      <Head>
        <style>{`
          body {
            font-family: ${fontFamily};
            -webkit-font-smoothing: antialiased;
          }
        `}</style>
      </Head>
      <Preview>{content.preview}</Preview>
      <Body style={{ margin: 0, backgroundColor: colors.canvas }}>
        <Container style={{ margin: "0 auto", maxWidth: "480px", padding: "48px 24px 40px" }}>
          <Section style={{ marginBottom: "32px" }}>
            <Text
              style={{
                margin: 0,
                fontFamily,
                fontSize: "15px",
                fontWeight: 600,
                lineHeight: "20px",
                color: colors.brand,
              }}
            >
              PlayTT
            </Text>
          </Section>

          <Heading
            as="h1"
            style={{
              margin: "0 0 16px",
              fontFamily,
              fontSize: "22px",
              fontWeight: 600,
              lineHeight: "28px",
              letterSpacing: "-0.01em",
              color: colors.foreground,
            }}
          >
            {content.headline}
          </Heading>

          <Text
            style={{
              margin: "0 0 32px",
              fontFamily,
              fontSize: "15px",
              fontWeight: 400,
              lineHeight: "24px",
              color: colors.foreground,
            }}
          >
            {content.body}
          </Text>

          <Text
            style={{
              margin: "0 0 24px",
              fontFamily,
              fontSize: "32px",
              fontWeight: 600,
              lineHeight: "40px",
              letterSpacing: "0.18em",
              fontVariantNumeric: "tabular-nums",
              color: colors.foreground,
            }}
          >
            {otp}
          </Text>

          <Text
            style={{
              margin: "0 0 24px",
              fontFamily,
              fontSize: "14px",
              fontWeight: 400,
              lineHeight: "20px",
              color: colors.secondary,
            }}
          >
            Expires in 5 minutes.
          </Text>

          <Text
            style={{
              margin: 0,
              fontFamily,
              fontSize: "14px",
              fontWeight: 400,
              lineHeight: "20px",
              color: colors.secondary,
            }}
          >
            If you did not request this, ignore this email.
          </Text>
        </Container>

        <Container style={{ margin: "0 auto", maxWidth: "480px", padding: "0 24px 48px" }}>
          <Hr
            style={{
              margin: "0 0 20px",
              border: 0,
              borderTop: `1px solid ${colors.divider}`,
            }}
          />
          <Text
            style={{
              margin: 0,
              fontFamily,
              fontSize: "12px",
              fontWeight: 400,
              lineHeight: "18px",
              textAlign: "center",
              color: colors.tertiary,
            }}
          >
            PlayTT will never ask you to share this code.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
