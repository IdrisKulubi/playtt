import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { AccountFormTheme } from "@/components/account/account-form-theme"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { changePassword } from "@/lib/auth-api"
import {
  changePasswordSchema,
  type ChangePasswordValues,
} from "@/lib/auth-schemas"
import { mapZodErrors, type FieldErrors } from "@/lib/form-errors"
import { toast } from "@/lib/toast"

type ChangePasswordFormProps = {
  onSaved: () => void
}

const theme = AccountFormTheme
const fieldProps = { variant: "auth" as const, authTheme: theme, compact: true }
const inputProps = { variant: "auth" as const, authTheme: theme }

export function ChangePasswordForm({ onSaved }: ChangePasswordFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [values, setValues] = useState<ChangePasswordValues>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [fieldErrors, setFieldErrors] = useState<
    FieldErrors<keyof ChangePasswordValues>
  >({})

  async function handleSave() {
    const parsed = changePasswordSchema.safeParse(values)

    if (!parsed.success) {
      setFieldErrors(mapZodErrors(parsed))
      return
    }

    setFieldErrors({})
    setIsLoading(true)

    const result = await changePassword({
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    })

    if (!result.success) {
      toast.error(result.message)
      setIsLoading(false)
      return
    }

    toast.success("Password updated.")
    onSaved()
    setIsLoading(false)
  }

  return (
    <View style={styles.form}>
      <FormField
        label="Current password"
        error={fieldErrors.currentPassword}
        {...fieldProps}
      >
        <Input
          {...inputProps}
          value={values.currentPassword}
          onChangeText={(currentPassword) =>
            setValues((current) => ({ ...current, currentPassword }))
          }
          placeholder="Enter current password"
          secureTextEntry
          autoComplete="password"
          hasError={Boolean(fieldErrors.currentPassword)}
        />
      </FormField>

      <FormField
        label="New password"
        error={fieldErrors.newPassword}
        {...fieldProps}
      >
        <Input
          {...inputProps}
          value={values.newPassword}
          onChangeText={(newPassword) =>
            setValues((current) => ({ ...current, newPassword }))
          }
          placeholder="At least 8 characters"
          secureTextEntry
          autoComplete="new-password"
          hasError={Boolean(fieldErrors.newPassword)}
        />
      </FormField>

      <FormField
        label="Confirm new password"
        error={fieldErrors.confirmPassword}
        {...fieldProps}
      >
        <Input
          {...inputProps}
          value={values.confirmPassword}
          onChangeText={(confirmPassword) =>
            setValues((current) => ({ ...current, confirmPassword }))
          }
          placeholder="Re-enter new password"
          secureTextEntry
          autoComplete="new-password"
          hasError={Boolean(fieldErrors.confirmPassword)}
        />
      </FormField>

      <Button
        label="Update password"
        surface="auth"
        authTheme={theme}
        onPress={handleSave}
        loading={isLoading}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  form: {
    gap: PlayTTSpacing.md,
  },
})
