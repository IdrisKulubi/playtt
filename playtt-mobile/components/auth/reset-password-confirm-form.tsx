import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PlayTTFontFamilies, PlayTTSpacing } from '@/constants/playtt-tokens';
import { useAuthTheme } from '@/hooks/use-auth-theme';
import { resetPassword } from '@/lib/auth-api';
import { goToResetPassword, goToSignIn } from '@/lib/auth-navigation';
import { resetPasswordSchema, type ResetPasswordValues } from '@/lib/auth-schemas';
import { mapZodErrors, type FieldErrors } from '@/lib/form-errors';

export function ResetPasswordConfirmForm() {
  const theme = useAuthTheme();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const resolvedToken = typeof token === 'string' ? token : '';

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [values, setValues] = useState<ResetPasswordValues>({
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<keyof ResetPasswordValues>>({});

  const fieldProps = { variant: 'auth' as const, authTheme: theme, compact: true };
  const inputProps = { variant: 'auth' as const, authTheme: theme };

  async function handleSubmit() {
    if (!resolvedToken) {
      setFormError('Reset token is missing. Request a new link.');
      return;
    }

    setFormError(null);
    const parsed = resetPasswordSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(mapZodErrors(parsed));
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    const result = await resetPassword({
      token: resolvedToken,
      newPassword: parsed.data.password,
    });

    if (!result.success) {
      setFormError(result.message);
      setIsLoading(false);
      return;
    }

    goToSignIn();
    setIsLoading(false);
  }

  if (!resolvedToken) {
    return (
      <View style={styles.form}>
        <Text style={[styles.helper, { color: theme.muted }]}>
          This screen needs the secure token from your reset email before a new password
          can be saved.
        </Text>
        <Button
          label="Request a new link"
          surface="auth"
          authTheme={theme}
          onPress={goToResetPassword}
        />
        <Pressable onPress={goToResetPassword}>
          <Text style={[styles.modeLink, { color: theme.link }]}>Request one</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <FormField
        label="New password"
        error={fieldErrors.password}
        {...fieldProps}
        accessory={
          <Pressable onPress={() => setShowPassword((current) => !current)}>
            <Text style={[styles.inlineLink, { color: theme.link }]}>
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        }>
        <Input
          {...inputProps}
          value={values.password}
          onChangeText={(password) => setValues((current) => ({ ...current, password }))}
          placeholder="At least 8 characters"
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          hasError={Boolean(fieldErrors.password)}
        />
      </FormField>

      <FormField
        label="Confirm password"
        error={fieldErrors.confirmPassword}
        {...fieldProps}
        accessory={
          <Pressable onPress={() => setShowConfirmPassword((current) => !current)}>
            <Text style={[styles.inlineLink, { color: theme.link }]}>
              {showConfirmPassword ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        }>
        <Input
          {...inputProps}
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

      {formError ? (
        <Text style={[styles.formError, { color: theme.destructive }]}>{formError}</Text>
      ) : null}

      <Button
        label="Continue"
        surface="auth"
        authTheme={theme}
        onPress={handleSubmit}
        loading={isLoading}
      />

      <Pressable onPress={() => router.replace('/auth?mode=sign-in')}>
        <Text style={[styles.modePrompt, { color: theme.muted }]}>
          <Text style={[styles.modeLink, { color: theme.foreground }]}>Back to sign in</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: PlayTTSpacing.md,
  },
  helper: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: PlayTTFontFamilies.regular,
    textAlign: 'center',
  },
  inlineLink: {
    fontSize: 12,
    fontFamily: PlayTTFontFamilies.semiBold,
  },
  modePrompt: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.regular,
    textAlign: 'center',
  },
  modeLink: {
    fontFamily: PlayTTFontFamilies.semiBold,
    textDecorationLine: 'underline',
  },
  formError: {
    fontSize: 12,
    fontFamily: PlayTTFontFamilies.regular,
    textAlign: 'center',
  },
});
