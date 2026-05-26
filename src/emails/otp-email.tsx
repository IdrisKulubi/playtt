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
  Tailwind,
} from "@react-email/components";

interface OtpEmailProps {
  otp: string;
}

export default function OtpEmail({ otp = "123456" }: OtpEmailProps) {
  return (
    <Html>
      <Head>
        <style>{`
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
        `}</style>
      </Head>
      <Preview>Your PlayTT verification code</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                primary: "#00b7ff",
                surface: "#101b2b",
                panel: "#0b1627",
                copy: "#e8eef6",
                muted: "#92a6bf",
              },
            },
          },
        }}
      >
        <Body className="m-0 bg-[#07111d] px-0 py-10">
          <Container className="mx-auto max-w-[560px] rounded-[24px] border border-solid border-[#203149] bg-[#101b2b] px-9 py-10">
            <Section className="mb-6">
              <Text className="m-0 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00b7ff]">
                PlayTT
              </Text>
            </Section>

            <Heading className="m-0 mb-5 text-[26px] font-semibold tracking-tight text-white">
              Verification code
            </Heading>

            <Text className="m-0 mb-6 text-[15px] leading-[1.65] text-[#e8eef6]">
              Enter this code to finish signing in to PlayTT.
            </Text>

            <Section className="mb-8 rounded-2xl border border-solid border-[#203149] bg-[#0b1627] px-6 py-7">
              <Text className="m-0 text-center text-[40px] font-semibold tracking-[0.35em] text-white">
                {otp}
              </Text>
            </Section>

            <Text className="m-0 mb-4 text-[14px] leading-[1.65] text-[#e8eef6]">
              This code expires in <strong>5 minutes</strong>.
            </Text>

            <Text className="m-0 mb-2 text-[14px] leading-[1.65] text-[#92a6bf]">
              If you did not request this, you can ignore this email.
            </Text>
          </Container>

          <Container className="mx-auto max-w-[560px] px-4 pt-6">
            <Hr className="mb-4 border-0 border-t border-solid border-[#203149]" />
            <Text className="m-0 text-center text-[12px] leading-[1.6] text-[#64748b]">
              PlayTT will never ask you to share this code.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
