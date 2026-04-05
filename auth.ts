import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor, emailOTP } from "better-auth/plugins";
import { Resend } from "resend";
import db from "./db/drizzle";
import { render } from "@react-email/components";
import OtpEmail from "./src/emails/otp-email";
import ResetPasswordEmail from "./src/emails/reset-password-email";
import { user } from "./db/schema";
import { eq } from "drizzle-orm";

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder");
const resendFromEmail =
  process.env.RESEND_FROM_EMAIL?.trim().toLowerCase() ||
  "onboarding@resend.dev";

async function sendEmailOrThrow(input: {
  to: string;
  subject: string;
  html: string;
}) {
  const result = await resend.emails.send({
    from: resendFromEmail,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  if (result.error) {
    console.error("[RESEND] Email send failed:", result.error);

    const fromDomain = resendFromEmail.split("@")[1] || resendFromEmail;
    throw new Error(
      `Failed to send email from ${resendFromEmail}. Check that the sender/domain is verified in Resend (domain: ${fromDomain}).`,
    );
  }

  return result;
}

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        // schema: {...} // Optional: Pass schema if needed, but CLI generation is preferred
    }),
    user: {
        additionalFields: {
            organizationId: {
                type: "string"
            },
            role: {
                type: "string"
            },
            supplierId: {
                type: "string"
            }
        }
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 1 week
        updateAge: 60 * 60 * 24, // 1 day
    },
    databaseHooks: {
        session: {
            create: {
                after: async (session: { userId: string }) => {
                    // Update lastLoginAt when a session is created
                    try {
                        await db.update(user)
                            .set({ lastLoginAt: new Date() })
                            .where(eq(user.id, session.userId));
                    } catch (error) {
                        console.error("Failed to update lastLoginAt:", error);
                    }
                }
            }
        }
    },
    emailAndPassword: {
        enabled: true,
        async sendResetPassword(data: { user: { email: string; name: string }; url: string }) {
            const { user, url } = data;
            const emailHtml = await render(ResetPasswordEmail({
                resetLink: url,
                userName: user.name || "User"
            }));

            await sendEmailOrThrow({
                to: user.email,
                subject: "Reset your PlayTT password",
                html: emailHtml,
            });
        },
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
            prompt: "select_account",
        },
    },
    plugins: [
        emailOTP({
            async sendVerificationOTP({ email, otp, type }: { email: string; otp: string; type: string }) {
                try {
                    // Reuse existing OtpEmail template
                    const emailHtml = await render(OtpEmail({ otp }));

                    await sendEmailOrThrow({
                        to: email,
                        subject: "Verify your email address",
                        html: emailHtml,
                    });
                } catch (error) {
                    console.error("[EMAIL OTP] Error sending email:", error);
                    throw error;
                }
            },
        }),
        twoFactor({
            issuer: "PlayTT",
            otpOptions: {
                async sendOTP({ user, otp }: { user: { email: string; name: string }; otp: string }) {
                    const emailHtml = await render(OtpEmail({ otp }));
                    await sendEmailOrThrow({
                        to: user.email,
                        subject: "Your PlayTT Security Code",
                        html: emailHtml,
                    });
                },
            },
        }),
    ],
});
