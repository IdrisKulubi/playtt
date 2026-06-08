import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
  Tailwind,
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

const palette = {
  primary: "#00b7ff",
  primaryForeground: "#041019",
  background: "#07111d",
  elevated: "#0b1627",
  card: "#101b2b",
  border: "#203149",
  input: "#162336",
  muted: "#92a6bf",
  foreground: "#ffffff",
  copy: "#e8eef6",
} as const;

function getEmailContent(purpose: OtpEmailPurpose) {
  switch (purpose) {
    case "forget-password":
      return {
        preview: "Your PlayTT password reset code",
        eyebrow: "Password reset",
        headline: "Reset your password",
        body: "Enter this code in PlayTT to choose a new password. It is valid for a short time only.",
      };
    case "sign-in":
      return {
        preview: "Your PlayTT sign-in code",
        eyebrow: "Sign in",
        headline: "Your sign-in code",
        body: "Use this code to finish signing in to your PlayTT account.",
      };
    case "change-email":
      return {
        preview: "Confirm your new PlayTT email",
        eyebrow: "Email change",
        headline: "Confirm your new email",
        body: "Enter this code to confirm the email address change on your PlayTT account.",
      };
    case "two-factor":
      return {
        preview: "Your PlayTT security code",
        eyebrow: "Security",
        headline: "Your security code",
        body: "Enter this code to complete two-factor authentication on your PlayTT account.",
      };
  }

  return {
    preview: "Your PlayTT verification code",
    eyebrow: "Verification",
    headline: "Verify your email",
    body: "Enter this code to finish setting up your PlayTT account.",
  };
}

function OtpDigits({ otp }: { otp: string }) {
  const digits = otp.padEnd(6, " ").slice(0, 6).split("");

  return (
    <Row>
      {digits.map((digit, index) => (
        <Column
          key={`${digit}-${index}`}
          style={{
            width: "52px",
            paddingRight: index < digits.length - 1 ? "10px" : "0",
          }}
        >
          <Section
            style={{
              margin: 0,
              borderRadius: "20px",
              border: `1px solid ${palette.border}`,
              backgroundColor: palette.input,
              padding: "18px 0",
              textAlign: "center",
            }}
          >
            <Text
              style={{
                margin: 0,
                fontFamily:
                  '"Space Grotesk", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: "28px",
                fontWeight: 600,
                lineHeight: "28px",
                letterSpacing: "0.08em",
                color: palette.foreground,
              }}
            >
              {digit.trim() || "·"}
            </Text>
          </Section>
        </Column>
      ))}
    </Row>
  );
}

export default function OtpEmail({
  otp = "123456",
  purpose = "email-verification",
}: OtpEmailProps) {
  const content = getEmailContent(purpose);

  return (
    <Html>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style>{`
          body {
            font-family: "Space Grotesk", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            -webkit-font-smoothing: antialiased;
          }
        `}</style>
      </Head>
      <Preview>{content.preview}</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                primary: palette.primary,
                background: palette.background,
                card: palette.card,
                elevated: palette.elevated,
                border: palette.border,
                input: palette.input,
                muted: palette.muted,
                foreground: palette.foreground,
                copy: palette.copy,
              },
              borderRadius: {
                card: "28px",
                panel: "32px",
                field: "20px",
                pill: "9999px",
              },
              boxShadow: {
                panel: "0 28px 90px rgba(0, 0, 0, 0.32)",
                soft: "0 18px 48px rgba(0, 0, 0, 0.22)",
              },
            },
          },
        }}
      >
        <Body
          className="m-0 px-0 py-12"
          style={{ backgroundColor: palette.background }}
        >
          <Container className="mx-auto max-w-[560px] px-4">
            <Section
              className="overflow-hidden rounded-card border border-solid border-border"
              style={{
                backgroundColor: palette.card,
                boxShadow: "0 28px 90px rgba(0, 0, 0, 0.32)",
              }}
            >
              <Section
                className="px-10 pt-10"
                style={{
                  borderTop: `3px solid ${palette.primary}`,
                }}
              >
                <Text
                  className="m-0 mb-3 text-[11px] font-semibold uppercase tracking-[0.28em]"
                  style={{ color: palette.primary }}
                >
                  PlayTT
                </Text>

                <Text
                  className="m-0 mb-2 text-[12px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: palette.muted }}
                >
                  {content.eyebrow}
                </Text>

                <Heading
                  className="m-0 mb-4 text-[30px] font-semibold tracking-[-0.02em]"
                  style={{ color: palette.foreground }}
                >
                  {content.headline}
                </Heading>

                <Text
                  className="m-0 mb-8 text-[15px] leading-[1.65]"
                  style={{ color: palette.copy }}
                >
                  {content.body}
                </Text>
              </Section>

              <Section
                className="mx-10 mb-8 rounded-panel border border-solid border-border px-6 py-8"
                style={{ backgroundColor: palette.elevated }}
              >
                <Text
                  className="m-0 mb-5 text-center text-[12px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: palette.muted }}
                >
                  Your code
                </Text>

                <Section className="mb-2">
                  <OtpDigits otp={otp} />
                </Section>

                <Text
                  className="m-0 mt-6 text-center text-[13px] leading-[1.6]"
                  style={{ color: palette.muted }}
                >
                  Or copy this code:{" "}
                  <span style={{ color: palette.foreground, fontWeight: 600 }}>
                    {otp}
                  </span>
                </Text>
              </Section>

              <Section className="px-10 pb-10">
                <Section
                  className="mb-6 rounded-field px-4 py-3"
                  style={{
                    backgroundColor: "rgba(0, 183, 255, 0.08)",
                    border: `1px solid rgba(0, 183, 255, 0.18)`,
                  }}
                >
                  <Text
                    className="m-0 text-center text-[13px] leading-[1.6]"
                    style={{ color: palette.copy }}
                  >
                    This code expires in{" "}
                    <strong style={{ color: palette.foreground }}>5 minutes</strong>.
                  </Text>
                </Section>

                <Text
                  className="m-0 text-[14px] leading-[1.65]"
                  style={{ color: palette.muted }}
                >
                  If you did not request this, you can safely ignore this email. Your
                  account remains secure.
                </Text>
              </Section>
            </Section>

            <Section className="px-2 pt-6">
              <Hr
                className="mb-4 border-0 border-t border-solid"
                style={{ borderColor: palette.border }}
              />
              <Text
                className="m-0 text-center text-[12px] leading-[1.6]"
                style={{ color: "#64748b" }}
              >
                PlayTT will never ask you to share this code with anyone.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
