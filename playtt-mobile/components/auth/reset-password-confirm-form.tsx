import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PlayTTFontFamilies, PlayTTSpacing } from '@/constants/playtt-tokens';
import { useAuthTheme } from '@/hooks/use-auth-theme';
import { requestPasswordReset } from '@/lib/auth-api';
import { authClient } from '@/lib/auth-client';
import { goToResetPassword, goToSignIn } from '@/lib/auth-navigation';
import { resetPasswordOtpSchema, type ResetPasswordOtpValues } from '@/lib/auth-schemas';
import { mapZodErrors, type FieldErrors } from '@/lib/form-errors';

export function ResetPasswordConfirmForm() {
  const theme = useAuthTheme();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const resolvedEmail = typeof email === 'string' ? email : '';

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [values, setValues] = useState<ResetPasswordOtpValues>({
    otp: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<keyof ResetPasswordOtpValues>>({});

  const fieldProps = { variant: 'auth' as const, authTheme: theme, compact: true };
  const inputProps = { variant: 'auth' as const, authTheme: theme };

  async function handleSubmit() {
    if (!resolvedEmail) {
      setFormError('Email is missing. Request a new code.');
      return;
    }

    setFormError(null);
    setStatusMessage(null);
    const parsed = resetPasswordOtpSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(mapZodErrors(parsed));
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    const { error } = await authClient.emailOtp.resetPassword({
      email: resolvedEmail,
      otp: parsed.data.otp,
      password: parsed.data.password,
    });

    if (error) {
      setFormError(error.message || 'Failed to reset password.');
      setIsLoading(false);
      return;
    }

    goToSignIn();
    setIsLoading(false);
  }

  async function handleResend() {
    if (!resolvedEmail) {
      return;
    }

    setFormError(null);
    setStatusMessage(null);
    setIsLoading(true);

    const result = await requestPasswordReset(resolvedEmail);

    if (!result.success) {
      setFormError(result.message);
      setIsLoading(false);
      return;
    }

    setStatusMessage('Reset code resent. Check your inbox.');
    setIsLoading(false);
  }

  if (!resolvedEmail) {
    return (
      <View style={styles.form}>
        <Text style={[styles.helper, { color: theme.muted }]}>
          This screen needs the email from the previous step before a new password can be saved.
        </Text>
        <Button
          label="Request a new code"
          surface="auth"
          authTheme={theme}
          onPress={goToResetPassword}
        />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <FormField label="Reset code" error={fieldErrors.otp} {...fieldProps}>
        <Input
          {...inputProps}
          value={values.otp}
          onChangeText={(otp) => setValues((current) => ({ ...current, otp }))}
          placeholder="123456"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          hasError={Boolean(fieldErrors.otp)}
        />
      </FormField>

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

      {formError ? (
        <Text style={[styles.formError, { color: theme.destructive }]}>{formError}</Text>
      ) : null}
      {statusMessage ? (
        <Text style={[styles.statusMessage, { color: theme.muted }]}>{statusMessage}</Text>
      ) : null}

      <Button
        label="Continue"
        surface="auth"
        authTheme={theme}
        onPress={handleSubmit}
        loading={isLoading}
      />

      <Pressable onPress={handleResend} disabled={isLoading}>
        <Text style={[styles.link, { color: theme.link }]}>Resend code</Text>
      </Pressable>

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
  link: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.semiBold,
    textAlign: 'center',
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
  statusMessage: {
    fontSize: 12,
    fontFamily: PlayTTFontFamilies.regular,
    textAlign: 'center',
  },
});
