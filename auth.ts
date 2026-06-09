import { expo } from "@better-auth/expo"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { twoFactor, emailOTP } from "better-auth/plugins"
import { Resend } from "resend"
import db from "./db/drizzle"
import * as schema from "./db/schema"
import { user } from "./db/schema"
import { renderOtpEmailHtml } from "./src/lib/email/render-otp-email"
import { eq } from "drizzle-orm"
import { WEB_CORS_ORIGINS } from "./src/lib/web-cors-origins"

function parseOrigins(value: string | undefined) {
  return (
    value
      ?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  )
}

const MOBILE_TRUSTED_ORIGINS = [
  // Mobile app scheme. Must match app.json "expo.scheme" and expoClient.scheme.
  "playtt://",
  "playtt:///",
  "playtt://*",
  "playtt://**",

  // Expo Go / dev-client callbacks. Keep exact local IPs here when testing
  // against a hosted backend, because Better Auth validates callbackURL.
  "exp://",
  "exp://*",
  "exp://**",
  "exps://",
  "exps://*",
  "exps://**",
  "exp://localhost:8081",
  "exp://localhost:8082",
  "exps://localhost:8081",
  "exps://localhost:8082",
  "exp://192.168.*.*:*/**",
  "exps://192.168.*.*:*/**",
  "exp://10.*.*.*:*/**",
  "exps://10.*.*.*:*/**",
  "exp://172.*.*.*:*/**",
  "exps://172.*.*.*:*/**",
  ...parseOrigins(process.env.MOBILE_AUTH_CALLBACK_URLS),
]

const TRUSTED_ORIGINS = [
  ...WEB_CORS_ORIGINS,
  ...MOBILE_TRUSTED_ORIGINS,
  "https://appleid.apple.com",
]

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder")
const resendFromEmail =
  process.env.RESEND_FROM_EMAIL?.trim().toLowerCase() || "onboarding@resend.dev"

async function getUserNameByEmail(email: string) {
  const rows = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)

  return rows[0]?.name
}

async function sendEmailOrThrow(input: {
  to: string
  subject: string
  html: string
}) {
  const result = await resend.emails.send({
    from: resendFromEmail,
    to: input.to,
    subject: input.subject,
    html: input.html,
  })

  if (result.error) {
    console.error("[RESEND] Email send failed:", result.error)

    const fromDomain = resendFromEmail.split("@")[1] || resendFromEmail
    throw new Error(
      `Failed to send email from ${resendFromEmail}. Check that the sender/domain is verified in Resend (domain: ${fromDomain}).`
    )
  }

  return result
}

export const auth = betterAuth({
  trustedOrigins: TRUSTED_ORIGINS,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  user: {
    additionalFields: {
      organizationId: {
        type: "string",
      },
      role: {
        type: "string",
      },
      supplierId: {
        type: "string",
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 90, // 90 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session: { userId: string }) => {
          // Update lastLoginAt when a session is created
          try {
            await db
              .update(user)
              .set({ lastLoginAt: new Date() })
              .where(eq(user.id, session.userId))
          } catch (error) {
            console.error("Failed to update lastLoginAt:", error)
          }
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      prompt: "select_account",
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
      appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER,
    },
  },
  plugins: [
    expo(),
    {
      id: "playtt-trusted-origins",
      init: () => ({
        options: {
          trustedOrigins: TRUSTED_ORIGINS,
        },
      }),
    },
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        try {
          const subject =
            type === "forget-password"
              ? "Reset your PlayTT password"
              : type === "sign-in"
                ? "Your PlayTT sign-in code"
                : type === "change-email"
                  ? "Confirm your new email address"
                  : "Verify your email address"

          const name = await getUserNameByEmail(email)
          const emailHtml = await renderOtpEmailHtml({
            otp,
            purpose: type,
            name,
            email,
          })

          await sendEmailOrThrow({
            to: email,
            subject,
            html: emailHtml,
          })
        } catch (error) {
          console.error("[EMAIL OTP] Error sending email:", error)
          throw error
        }
      },
    }),
    twoFactor({
      issuer: "PlayTT",
      otpOptions: {
        async sendOTP({
          user,
          otp,
        }: {
          user: { email: string; name: string }
          otp: string
        }) {
          const emailHtml = await renderOtpEmailHtml({
            otp,
            purpose: "two-factor",
            name: user.name,
            email: user.email,
          })
          await sendEmailOrThrow({
            to: user.email,
            subject: "Your PlayTT Security Code",
            html: emailHtml,
          })
        },
      },
    }),
  ],
})

console.info("[AUTH] boot", {
  commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  providers: ["google", "apple"],
  appleEnv: {
    clientId: Boolean(process.env.APPLE_CLIENT_ID),
    clientSecret: Boolean(process.env.APPLE_CLIENT_SECRET),
    bundleId: process.env.APPLE_APP_BUNDLE_IDENTIFIER ?? null,
    expoClientId: process.env.APPLE_EXPO_CLIENT_ID ?? null,
  },
})
