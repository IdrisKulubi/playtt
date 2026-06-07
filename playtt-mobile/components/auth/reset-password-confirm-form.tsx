import { router, useLocalSearchParams } from "expo-router"
import { useState } from "react"
import { Pressable, StyleSheet, Text } from "react-native"

import { AuthFormCard } from "@/components/auth/auth-form-card"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import { resetPassword } from "@/lib/auth-api"
import { goToResetPassword, goToSignIn } from "@/lib/auth-navigation"
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/lib/auth-schemas"
import { mapZodErrors, type FieldErrors } from "@/lib/form-errors"

export function ResetPasswordConfirmForm() {
  const { token } = useLocalSearchParams<{ token?: string }>()
  const resolvedToken = typeof token === "string" ? token : ""

  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [values, setValues] = useState<ResetPasswordValues>({
    password: "",
    confirmPassword: "",
  })
  const [fieldErrors, setFieldErrors] = useState<
    FieldErrors<keyof ResetPasswordValues>
  >({})

  async function handleSubmit() {
    if (!resolvedToken) {
      setFormError("Reset token is missing. Request a new link.")
      return
    }

    setFormError(null)
    const parsed = resetPasswordSchema.safeParse(values)
    if (!parsed.success) {
      setFieldErrors(mapZodErrors(parsed))
      return
    }

    setFieldErrors({})
    setIsLoading(true)

    const result = await resetPassword({
      token: resolvedToken,
      newPassword: parsed.data.password,
    })

    if (!result.success) {
      setFormError(result.message)
      setIsLoading(false)
      return
    }

    goToSignIn()
    setIsLoading(false)
  }

  if (!resolvedToken) {
    return (
      <AuthFormCard
        title="Reset link incomplete"
        description="This screen needs the secure token from your reset email before a new password can be saved."
        footer={
          <Text style={styles.footerText}>
            Need a fresh link?{" "}
            <Text style={styles.inlineLink} onPress={goToResetPassword}>
              Request one
            </Text>
          </Text>
        }
      >
        <Button
          label="Request a new link"
          surface="product"
          onPress={goToResetPassword}
        />
      </AuthFormCard>
    )
  }

  return (
    <AuthFormCard
      title="Choose a new password"
      description="Use at least eight characters. You can sign in right after saving."
      footer={
        <Text style={styles.footerText}>
          <Text
            style={styles.inlineLink}
            onPress={() => router.replace("/sign-in")}
          >
            Back to sign in
          </Text>
        </Text>
      }
    >
      <FormField
        label="New password"
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
        label="Save new password"
        surface="product"
        onPress={handleSubmit}
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
