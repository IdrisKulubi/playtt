import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PlayTTFontFamilies, PlayTTSpacing } from '@/constants/playtt-tokens';
import { useAuthTheme } from '@/hooks/use-auth-theme';
import { sendVerificationOtp } from '@/lib/auth-api';
import { authClient, refreshSession } from '@/lib/auth-client';
import { waitForStoredAuth } from '@/lib/auth-helpers';
import { goToAuthenticatedHome } from '@/lib/auth-navigation';
import { verifyEmailSchema, type VerifyEmailValues } from '@/lib/auth-schemas';
import { mapZodErrors, type FieldErrors } from '@/lib/form-errors';

export function VerifyEmailForm() {
  const theme = useAuthTheme();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const resolvedEmail = typeof email === 'string' ? email : '';

  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [values, setValues] = useState<VerifyEmailValues>({ otp: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<keyof VerifyEmailValues>>({});

  const fieldProps = { variant: 'auth' as const, authTheme: theme, compact: true };
  const inputProps = { variant: 'auth' as const, authTheme: theme };

  async function handleVerify() {
    if (!resolvedEmail) {
      setFormError('Email is missing. Please restart sign-up.');
      return;
    }

    setFormError(null);
    setStatusMessage(null);
    const parsed = verifyEmailSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(mapZodErrors(parsed));
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    const { error } = await authClient.emailOtp.verifyEmail({
      email: resolvedEmail,
      otp: parsed.data.otp,
    });

    if (error) {
      setFormError(error.message || 'Invalid verification code.');
      setIsLoading(false);
      return;
    }

    await refreshSession();
    await waitForStoredAuth();
    goToAuthenticatedHome();
    setIsLoading(false);
  }

  async function handleResend() {
    if (!resolvedEmail) {
      return;
    }

    setFormError(null);
    setStatusMessage(null);
    setIsLoading(true);

    const result = await sendVerificationOtp(resolvedEmail);

    if (!result.success) {
      setFormError(result.message);
      setIsLoading(false);
      return;
    }

    setStatusMessage('Verification code resent. Check your inbox.');
    setIsLoading(false);
  }

  return (
    <View style={styles.form}>
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
        onPress={handleVerify}
        loading={isLoading}
      />

      <Pressable onPress={handleResend} disabled={isLoading}>
        <Text style={[styles.link, { color: theme.link }]}>Resend code</Text>
      </Pressable>

      <Pressable onPress={() => router.replace('/?mode=sign-up')}>
        <Text style={[styles.modePrompt, { color: theme.muted }]}>
          Wrong email?{' '}
          <Text style={[styles.modeLink, { color: theme.foreground }]}>Start over</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: PlayTTSpacing.md,
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
