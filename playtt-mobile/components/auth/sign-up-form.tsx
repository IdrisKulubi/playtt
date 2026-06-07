import { router } from "expo-router"
import { useState } from "react"
import { Pressable, StyleSheet, Text } from "react-native"

import { AuthFormCard } from "@/components/auth/auth-form-card"
import { Button } from "@/components/ui/button"
import { FormDivider } from "@/components/ui/form-divider"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import { sendVerificationOtp } from "@/lib/auth-api"
import { formatAuthError } from "@/lib/auth-errors"
import { authClient } from "@/lib/auth-client"
import { goToAuthenticatedHome, goToVerifyEmail } from "@/lib/auth-navigation"
import { waitForStoredAuth } from "@/lib/auth-helpers"
import { signUpSchema, type SignUpValues } from "@/lib/auth-schemas"
import { mapZodErrors, type FieldErrors } from "@/lib/form-errors"

export function SignUpForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [values, setValues] = useState<SignUpValues>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [fieldErrors, setFieldErrors] = useState<
    FieldErrors<keyof SignUpValues>
  >({})

  async function handleGoogleSignIn() {
    setFormError(null)
    setIsLoading(true)

    await authClient.signIn.social(
      {
        provider: "google",
        callbackURL: "/",
      },
      {
        onSuccess: async () => {
          const stored = await waitForStoredAuth()

          if (stored?.token) {
            goToAuthenticatedHome()
          }

          setIsLoading(false)
        },
        onError: (ctx) => {
          setFormError(
            formatAuthError(ctx.error.message || "Google sign in failed.")
          )
          setIsLoading(false)
        },
      }
    )
  }

  async function handleSignUp() {
    setFormError(null)
    const parsed = signUpSchema.safeParse(values)
    if (!parsed.success) {
      setFieldErrors(mapZodErrors(parsed))
      return
    }

    setFieldErrors({})
    setIsLoading(true)

    await authClient.signUp.email(
      {
        email: parsed.data.email,
        password: parsed.data.password,
        name: parsed.data.name,
      },
      {
        onSuccess: async () => {
          const result = await sendVerificationOtp(parsed.data.email)

          if (!result.success) {
            setFormError(result.message)
            setIsLoading(false)
            return
          }

          goToVerifyEmail(parsed.data.email)
          setIsLoading(false)
        },
        onError: (ctx) => {
          setFormError(
            formatAuthError(ctx.error.message || "Failed to sign up.")
          )
          setIsLoading(false)
        },
      }
    )
  }

  return (
    <AuthFormCard
      title="Create your account"
      description="Set up the player identity that bookings, payments, and future access will attach to."
      footer={
        <Text style={styles.footerText}>
          Already have an account?{" "}
          <Text
            style={styles.inlineLink}
            onPress={() => router.push("/sign-in")}
          >
            Sign in
          </Text>
        </Text>
      }
    >
      <Button
        label="Continue with Google"
        variant="outline"
        surface="product"
        onPress={handleGoogleSignIn}
        loading={isLoading}
      />

      <FormDivider label="Or use email" />

      <FormField label="Full name" error={fieldErrors.name}>
        <Input
          value={values.name}
          onChangeText={(name) =>
            setValues((current) => ({ ...current, name }))
          }
          placeholder="Your name"
          autoComplete="name"
          hasError={Boolean(fieldErrors.name)}
        />
      </FormField>

      <FormField label="Email" error={fieldErrors.email}>
        <Input
          value={values.email}
          onChangeText={(email) =>
            setValues((current) => ({ ...current, email }))
          }
          placeholder="name@theplaytt.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          hasError={Boolean(fieldErrors.email)}
        />
      </FormField>

      <FormField
        label="Password"
        error={fieldErrors.password}
        accessory={
          <Pressable onPress={() => setShowPassword((current) => !current)}>
            <Text style={styles.inlineLink}>
              {showPassword ? "Hide" : "Show"}
            </Text>
          </Pressable>
        }
      >
        <Input
          value={values.password}
          onChangeText={(password) =>
            setValues((current) => ({ ...current, password }))
          }
          placeholder="At least 8 characters"
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          hasError={Boolean(fieldErrors.password)}
        />
      </FormField>

      <FormField
        label="Confirm password"
        error={fieldErrors.confirmPassword}
        accessory={
          <Pressable
            onPress={() => setShowConfirmPassword((current) => !current)}
          >
            <Text style={styles.inlineLink}>
              {showConfirmPassword ? "Hide" : "Show"}
            </Text>
          </Pressable>
        }
      >
        <Input
          value={values.confirmPassword}
          onChangeText={(confirmPassword) =>
            setValues((current) => ({ ...current, confirmPassword }))
          }
          placeholder="Repeat your password"
          secureTextEntry={!showConfirmPassword}
          autoComplete="new-password"
          hasError={Boolean(fieldErrors.confirmPassword)}
        />
      </FormField>

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <Button
        label="Create account"
        surface="product"
        onPress={handleSignUp}
        loading={isLoading}
      />
    </AuthFormCard>
  )
}

const styles = StyleSheet.create({
  footerText: {
    ...PlayTTTypography.body,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.productMuted,
    textAlign: "center",
  },
  inlineLink: {
    ...PlayTTTypography.label,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.primary,
  },
  formError: {
    ...PlayTTTypography.label,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.destructive,
    textAlign: "center",
  },
})
