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
        <Body
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
          className="m-0 bg-[#07111d] px-0 py-10"
        >
          <Container className="mx-auto max-w-[620px] rounded-[28px] border border-solid border-[#203149] bg-[#101b2b] px-9 py-10">
            <Section className="mb-6">
              <Text className="m-0 text-[12px] font-semibold uppercase tracking-[0.35em] text-[#00b7ff]">
                PlayTT
              </Text>
            </Section>

            <Heading className="m-0 mb-5 text-[30px] font-semibold tracking-tight text-white">
              Reset your password
            </Heading>

            <Text className="m-0 mb-4 text-[16px] leading-[1.7] text-[#e8eef6]">
              Hello {userName},
            </Text>

            <Text className="m-0 mb-6 text-[16px] leading-[1.7] text-[#e8eef6]">
              We received a request to reset the password for your PlayTT
              account. If that was you, use the secure link below to set a new
              password.
            </Text>

            <Text className="m-0 mb-8 text-[15px] leading-[1.7] text-[#92a6bf]">
              This reset link expires in <strong className="text-[#e8eef6]">1 hour</strong>.
            </Text>

            <Section className="mb-8">
              <Link
                href={resetLink}
                className="inline-block rounded-[999px] bg-[#00b7ff] px-[22px] py-[14px] text-[15px] font-semibold text-white no-underline"
              >
                Reset password
              </Link>
            </Section>

            <Text className="m-0 mb-6 text-[14px] leading-[1.7] text-[#92a6bf]">
              If you did not request this, you can safely ignore this email and
              your password will remain unchanged.
            </Text>

            <Hr className="my-6 border-0 border-t border-solid border-[#203149]" />

            <Text className="m-0 mb-3 text-[12px] leading-[1.7] text-[#92a6bf]">
              If the button above doesn&apos;t work, copy and paste this URL into
              your browser:
            </Text>
            <Text className="m-0 break-all text-[12px] leading-[1.7] text-[#00b7ff]">
              {resetLink}
            </Text>
          </Container>

          <Container className="mx-auto max-w-[620px] px-2 pt-5">
            <Text className="m-0 text-center text-[12px] leading-[1.6] text-[#64748b]">
              © 2026 PlayTT. Autonomous Table Tennis. Anytime.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
