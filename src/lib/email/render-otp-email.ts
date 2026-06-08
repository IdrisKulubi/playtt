import type { OtpEmailPurpose } from "@/emails/otp-email";

export async function renderOtpEmailHtml(input: {
  otp: string;
  purpose: OtpEmailPurpose;
  name?: string;
  email?: string;
}) {
  const [{ render }, { default: OtpEmail }] = await Promise.all([
    import("@react-email/components"),
    import("@/emails/otp-email"),
  ]);

  return render(
    OtpEmail({
      otp: input.otp,
      purpose: input.purpose,
      name: input.name,
      email: input.email,
    }),
  );
}
