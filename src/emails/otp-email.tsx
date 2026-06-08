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
  name?: string;
}

const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const colors = {
  canvas: "#f5f5f7",
  card: "#ffffff",
  cardBorder: "#e5e5e5",
  foreground: "#0a1628",
  secondary: "#6b7280",
  tertiary: "#86868b",
  brand: "#00b7ff",
  codeSurface: "#f2f2f2",
  divider: "#e5e5e5",
} as const;

function getEmailContent(purpose: OtpEmailPurpose) {
  switch (purpose) {
    case "forget-password":
      return {
        preview: "Your PlayTT password reset code",
        headline: "Reset your password on",
        body: "To choose a new password, enter the 6-digit code in PlayTT:",
      };
    case "sign-in":
      return {
        preview: "Your PlayTT sign-in code",
        headline: "Sign in to",
        body: "To complete sign-in, enter the 6-digit code in PlayTT:",
      };
    case "change-email":
      return {
        preview: "Confirm your new PlayTT email",
        headline: "Confirm your email on",
        body: "To confirm this email address, enter the 6-digit code in PlayTT:",
      };
    case "two-factor":
      return {
        preview: "Your PlayTT security code",
        headline: "Verify your identity on",
        body: "To finish two-factor authentication, enter the 6-digit code in PlayTT:",
      };
  }

  return {
    preview: "Your PlayTT verification code",
    headline: "Verify your email for",
    body: "To finish setting up your account, enter the 6-digit code in PlayTT:",
  };
}

function EmailBrandMark() {
  return (
    <Section style={{ marginBottom: "28px", textAlign: "center" }}>
      <table
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{ margin: "0 auto" }}
      >
        <tbody>
          <tr>
            <td
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "9999px",
                border: `1px solid ${colors.cardBorder}`,
                backgroundColor: colors.codeSurface,
                textAlign: "center",
                verticalAlign: "middle",
                fontFamily,
                fontSize: "14px",
                fontWeight: 600,
                color: colors.brand,
              }}
            >
              TT
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

export default function OtpEmail({
  otp = "123456",
  purpose = "email-verification",
  name,
}: OtpEmailProps) {
  const content = getEmailContent(purpose);
  const greeting = name?.trim() ? `Hello ${name.trim()},` : "Hello,";

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
        <Container
          style={{
            margin: "0 auto",
            maxWidth: "520px",
            padding: "40px 20px 24px",
          }}
        >
          <Section
            style={{
              backgroundColor: colors.card,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: "12px",
              padding: "40px 32px 36px",
            }}
          >
            <EmailBrandMark />

            <Heading
              as="h1"
              style={{
                margin: "0 0 24px",
                fontFamily,
                fontSize: "24px",
                fontWeight: 600,
                lineHeight: "32px",
                letterSpacing: "-0.02em",
                textAlign: "center",
                color: colors.foreground,
              }}
            >
              {content.headline}{" "}
              <span style={{ color: colors.brand }}>PlayTT</span>
            </Heading>

            <Text
              style={{
                margin: "0 0 12px",
                fontFamily,
                fontSize: "15px",
                fontWeight: 600,
                lineHeight: "24px",
                color: colors.foreground,
              }}
            >
              {greeting}
            </Text>

            <Text
              style={{
                margin: "0 0 28px",
                fontFamily,
                fontSize: "15px",
                fontWeight: 400,
                lineHeight: "24px",
                color: colors.foreground,
              }}
            >
              {content.body}
            </Text>

            <Section
              style={{
                marginBottom: "28px",
                borderRadius: "8px",
                backgroundColor: colors.codeSurface,
                padding: "20px 16px",
                textAlign: "center",
              }}
            >
              <Text
                style={{
                  margin: 0,
                  fontFamily,
                  fontSize: "36px",
                  fontWeight: 600,
                  lineHeight: "40px",
                  letterSpacing: "0.12em",
                  fontVariantNumeric: "tabular-nums",
                  color: colors.foreground,
                }}
              >
                {otp}
              </Text>
            </Section>

            <Text
              style={{
                margin: "0 0 12px",
                fontFamily,
                fontSize: "14px",
                fontWeight: 400,
                lineHeight: "20px",
                color: colors.secondary,
              }}
            >
              This code expires in 5 minutes.
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
              If you did not request this, you can ignore this email.
            </Text>
          </Section>
        </Container>

        <Container
          style={{
            margin: "0 auto",
            maxWidth: "520px",
            padding: "0 20px 40px",
          }}
        >
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
