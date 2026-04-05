import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";
import * as React from "react";

interface ResetPasswordEmailProps {
  resetLink: string;
  userName?: string;
}

export default function ResetPasswordEmail({
  resetLink = "http://localhost:3000/reset-password/confirm?token=xyz",
  userName = "Player",
}: ResetPasswordEmailProps) {
  const previewText = "Reset your PlayTT password";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                primary: "#00b7ff",
                surface: "#121212",
                panel: "#1e1e1e",
                copy: "#ffffff",
                muted: "#94a3b8",
              },
            },
          },
        }}
      >
        <Body className="m-0 bg-[#0b0b0c] px-0 py-[32px] font-sans">
          <Container className="mx-auto max-w-[620px] rounded-[28px] border border-solid border-[#1f2937] bg-[#121212] px-[36px] py-[40px]">
            <Section className="mb-[28px]">
              <Text className="m-0 text-[12px] font-semibold uppercase tracking-[0.35em] text-[#00b7ff]">
                PlayTT
              </Text>
            </Section>

            <Heading className="m-0 mb-[18px] text-[30px] font-semibold tracking-tight text-white">
              Reset your password
            </Heading>

            <Text className="m-0 mb-[16px] text-[16px] leading-[1.7] text-[#e5e7eb]">
              Hello {userName},
            </Text>

            <Text className="m-0 mb-[16px] text-[16px] leading-[1.7] text-[#e5e7eb]">
              We received a request to reset the password for your PlayTT
              account. If that was you, use the secure link below to set a new
              password.
            </Text>

            <Text className="m-0 mb-[28px] text-[16px] leading-[1.7] text-[#e5e7eb]">
              This reset link expires in <strong>1 hour</strong>.
            </Text>

            <Section className="mb-[28px]">
              <Link
                href={resetLink}
                className="inline-block rounded-[999px] bg-[#00b7ff] px-[22px] py-[14px] text-[15px] font-semibold text-white no-underline"
              >
                Reset password
              </Link>
            </Section>

            <Text className="m-0 mb-[24px] text-[14px] leading-[1.7] text-[#94a3b8]">
              If you did not request this, you can safely ignore this email and
              your password will remain unchanged.
            </Text>

            <Hr className="my-[24px] border-0 border-t border-solid border-[#1f2937]" />

            <Text className="m-0 mb-[10px] text-[12px] leading-[1.7] text-[#94a3b8]">
              If the button above doesn&apos;t work, copy and paste this URL into
              your browser:
            </Text>
            <Text className="m-0 break-all text-[12px] leading-[1.7] text-[#00b7ff]">
              {resetLink}
            </Text>
          </Container>

          <Container className="mx-auto max-w-[620px] px-[8px] pt-[18px]">
            <Text className="m-0 text-center text-[12px] leading-[1.6] text-[#64748b]">
              © 2026 PlayTT. Autonomous Table Tennis. Anytime.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
