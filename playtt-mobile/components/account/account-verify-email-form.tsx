import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
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
  const productTheme = useProductTheme()

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
      <FormField label="Verification code" error={fieldErrors.otp} compact>
        <Input
          compact
          value={values.otp}
          onChangeText={(otp) => setValues({ otp })}
          placeholder="6-digit code"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          hasError={Boolean(fieldErrors.otp)}
        />
      </FormField>

      <Button
        label="Verify email"
        surface="product"
        productTheme={productTheme}
        onPress={handleVerify}
        loading={isLoading}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Resend verification code"
        onPress={handleResend}
        disabled={isLoading}
        hitSlop={8}
      >
        <Text style={styles.link}>Resend code</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  form: {
    gap: PlayTTSpacing.md,
  },
  link: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.semiBold,
    textAlign: "center",
    textDecorationLine: "underline",
    color: PlayTTColors.primary,
  },
})
