import {
  Body,
  Container,
  Head,
  Heading,
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
  email?: string;
}

const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const colors = {
  background: "#ffffff",
  foreground: "#0a1628",
  secondary: "#6b7280",
  tertiary: "#86868b",
  brand: "#00b7ff",
  codeSurface: "#f2f2f2",
} as const;

function getEmailContent(purpose: OtpEmailPurpose) {
  switch (purpose) {
    case "forget-password":
      return {
        preview: "Your PlayTT password reset code",
        headline: "Reset your password on PlayTT",
        detailPrefix: "We received a password reset request for ",
        detailSuffix: ".",
        instruction: "Enter the 6-digit code in PlayTT to choose a new password.",
      };
    case "sign-in":
      return {
        preview: "Your PlayTT sign-in code",
        headline: "Verify your email to sign in to PlayTT",
        detailPrefix: "We received a sign-in attempt for ",
        detailSuffix: ".",
        instruction: "Enter the 6-digit code in PlayTT to continue.",
      };
    case "change-email":
      return {
        preview: "Confirm your new PlayTT email",
        headline: "Confirm your new email on PlayTT",
        detailPrefix: "Confirm the new email address ",
        detailSuffix: ".",
        instruction: "Enter the 6-digit code in PlayTT to confirm this change.",
      };
    case "two-factor":
      return {
        preview: "Your PlayTT security code",
        headline: "Verify your identity on PlayTT",
        detailPrefix: "Two-factor authentication was requested for ",
        detailSuffix: ".",
        instruction: "Enter the 6-digit code in PlayTT to finish signing in.",
      };
  }

  return {
    preview: "Your PlayTT verification code",
    headline: "Verify your email for PlayTT",
    detailPrefix: "Finish setting up your account for ",
    detailSuffix: ".",
    instruction: "Enter the 6-digit code in PlayTT to continue.",
  };
}

function EmailBrandMark() {
  return (
    <Section style={{ marginBottom: "32px", textAlign: "center" }}>
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
                border: "1px solid #e5e5e5",
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

const bodyTextStyle = {
  margin: "0 0 16px",
  fontFamily,
  fontSize: "15px",
  fontWeight: 400,
  lineHeight: "24px",
  color: colors.foreground,
} as const;

export default function OtpEmail({
  otp = "123456",
  purpose = "email-verification",
  name,
  email = "",
}: OtpEmailProps) {
  const content = getEmailContent(purpose);
  const greeting = name?.trim() ? `Hello ${name.trim()},` : "Hello,";
  const accountLabel = email.trim() || "your account";

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
      <Body style={{ margin: 0, backgroundColor: colors.background }}>
        <Container
          style={{
            margin: "0 auto",
            maxWidth: "480px",
            padding: "48px 24px 56px",
          }}
        >
          <EmailBrandMark />

          <Heading
            as="h1"
            style={{
              margin: "0 0 28px",
              fontFamily,
              fontSize: "30px",
              fontWeight: 600,
              lineHeight: "36px",
              letterSpacing: "-0.02em",
              textAlign: "center",
              color: colors.foreground,
            }}
          >
            {content.headline}
          </Heading>

          <Text
            style={{
              margin: "0 0 16px",
              fontFamily,
              fontSize: "15px",
              fontWeight: 600,
              lineHeight: "24px",
              color: colors.foreground,
            }}
          >
            {greeting}
          </Text>

          <Text style={bodyTextStyle}>
            {content.detailPrefix}
            <strong>{accountLabel}</strong>
            {content.detailSuffix}
          </Text>

          <Text style={bodyTextStyle}>{content.instruction}</Text>

          <Section
            style={{
              marginBottom: "24px",
              borderRadius: "8px",
              backgroundColor: colors.codeSurface,
              padding: "24px 16px",
              textAlign: "center",
            }}
          >
            <Text
              style={{
                margin: 0,
                fontFamily,
                fontSize: "48px",
                fontWeight: 600,
                lineHeight: "52px",
                letterSpacing: "0.14em",
                fontVariantNumeric: "tabular-nums",
                color: colors.foreground,
              }}
            >
              {otp}
            </Text>
          </Section>

          <Text
            style={{
              margin: "0 0 28px",
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
              margin: "0 0 12px",
              fontFamily,
              fontSize: "13px",
              fontWeight: 400,
              lineHeight: "20px",
              color: colors.tertiary,
            }}
          >
            If you did not request this, you can ignore this email. The request
            will not be completed unless you enter the code above.
          </Text>

          <Text
            style={{
              margin: "0 0 12px",
              fontFamily,
              fontSize: "13px",
              fontWeight: 400,
              lineHeight: "20px",
              color: colors.tertiary,
            }}
          >
            Do not share this code with anyone. PlayTT will never ask you to read
            this code out loud.
          </Text>

          <Text
            style={{
              margin: 0,
              fontFamily,
              fontSize: "13px",
              fontWeight: 400,
              lineHeight: "20px",
              color: colors.tertiary,
            }}
          >
            Make sure you recognize this request before entering the code. Emails
            from PlayTT will only come from theplaytt.com.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
