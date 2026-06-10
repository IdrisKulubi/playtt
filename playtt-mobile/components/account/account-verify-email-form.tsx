import { router } from "expo-router"
import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAuthTheme } from "@/hooks/use-auth-theme"
import { sendVerificationOtp } from "@/lib/auth-api"
import { authClient, refreshSession } from "@/lib/auth-client"
import { verifyEmailSchema, type VerifyEmailValues } from "@/lib/auth-schemas"
import { mapZodErrors, type FieldErrors } from "@/lib/form-errors"
import { toast } from "@/lib/toast"

type AccountVerifyEmailFormProps = {
  email: string
  onVerified: () => void
}

export function AccountVerifyEmailForm({
  email,
  onVerified,
}: AccountVerifyEmailFormProps) {
  const theme = useAuthTheme()
  const fieldProps = { variant: "auth" as const, authTheme: theme, compact: true }
  const inputProps = { variant: "auth" as const, authTheme: theme }

  const [isLoading, setIsLoading] = useState(false)
  const [values, setValues] = useState<VerifyEmailValues>({ otp: "" })
  const [fieldErrors, setFieldErrors] = useState<
    FieldErrors<keyof VerifyEmailValues>
  >({})

  async function handleVerify() {
    const parsed = verifyEmailSchema.safeParse(values)

    if (!parsed.success) {
      setFieldErrors(mapZodErrors(parsed))
      return
    }

    setFieldErrors({})
    setIsLoading(true)

    const { error } = await authClient.emailOtp.verifyEmail({
      email,
      otp: parsed.data.otp,
    })

    if (error) {
      toast.error(error.message || "Invalid verification code.")
      setIsLoading(false)
      return
    }

    await refreshSession()
    toast.success("Email verified.")
    onVerified()
    setIsLoading(false)
  }

  async function handleResend() {
    setIsLoading(true)

    const result = await sendVerificationOtp(email)

    if (!result.success) {
      toast.error(result.message)
      setIsLoading(false)
      return
    }

    toast.info("Verification code resent. Check your inbox.")
    setIsLoading(false)
  }

  return (
    <View style={styles.form}>
      <Text style={[styles.description, { color: theme.muted }]}>
        We sent a 6-digit code to {email}. Enter it below to verify your email.
      </Text>

      <FormField label="Verification code" error={fieldErrors.otp} {...fieldProps}>
        <Input
          {...inputProps}
          value={values.otp}
          onChangeText={(otp) => setValues({ otp })}
          placeholder="123456"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          hasError={Boolean(fieldErrors.otp)}
        />
      </FormField>

      <Button
        label="Verify email"
        surface="auth"
        authTheme={theme}
        onPress={handleVerify}
        loading={isLoading}
      />

      <Pressable onPress={handleResend}>
        <Text style={[styles.link, { color: theme.link }]}>Resend code</Text>
      </Pressable>

      <Pressable onPress={() => router.back()}>
        <Text style={[styles.cancel, { color: theme.muted }]}>Cancel</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  form: {
    gap: PlayTTSpacing.md,
  },
  description: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.regular,
    lineHeight: 20,
  },
  link: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.semiBold,
    textAlign: "center",
    textDecorationLine: "underline",
  },
  cancel: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.regular,
    textAlign: "center",
  },
})
