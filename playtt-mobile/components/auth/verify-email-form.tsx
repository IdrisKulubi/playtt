import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AuthFormCard } from '@/components/auth/auth-form-card';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTTypography,
} from '@/constants/playtt-tokens';
import { sendVerificationOtp } from '@/lib/auth-api';
import { authClient, refreshSession } from '@/lib/auth-client';
import { goToAuthenticatedHome } from '@/lib/auth-navigation';
import { verifyEmailSchema, type VerifyEmailValues } from '@/lib/auth-schemas';
import { mapZodErrors, type FieldErrors } from '@/lib/form-errors';

export function VerifyEmailForm() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const resolvedEmail = typeof email === 'string' ? email : '';

  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [values, setValues] = useState<VerifyEmailValues>({ otp: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<keyof VerifyEmailValues>>({});

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
    <AuthFormCard
      title="Verify your email"
      description={
        resolvedEmail
          ? `Enter the six-digit code sent to ${resolvedEmail}.`
          : 'Enter the six-digit code from your inbox.'
      }
      footer={
        <Text style={styles.footerText}>
          Wrong email?{' '}
          <Text style={styles.inlineLink} onPress={() => router.replace('/sign-up')}>
            Start over
          </Text>
        </Text>
      }>
      <FormField label="Verification code" error={fieldErrors.otp}>
        <Input
          value={values.otp}
          onChangeText={(otp) => setValues({ otp })}
          placeholder="123456"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          hasError={Boolean(fieldErrors.otp)}
        />
      </FormField>

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}

      <Button
        label="Verify and continue"
        surface="product"
        onPress={handleVerify}
        loading={isLoading}
      />

      <Pressable onPress={handleResend} disabled={isLoading}>
        <Text style={styles.resendLink}>Resend code</Text>
      </Pressable>
    </AuthFormCard>
  );
}

const styles = StyleSheet.create({
  footerText: {
    ...PlayTTTypography.body,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.productMuted,
    textAlign: 'center',
  },
  inlineLink: {
    ...PlayTTTypography.label,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.primary,
  },
  resendLink: {
    ...PlayTTTypography.label,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.primary,
    textAlign: 'center',
  },
  formError: {
    ...PlayTTTypography.label,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.destructive,
    textAlign: 'center',
  },
  statusMessage: {
    ...PlayTTTypography.label,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.productMuted,
    textAlign: 'center',
  },
});
