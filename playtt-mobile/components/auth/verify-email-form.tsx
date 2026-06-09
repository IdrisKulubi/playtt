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
import { verifyEmailSchema, type VerifyEmailValues } from '@/lib/auth-schemas';
import { mapZodErrors, type FieldErrors } from '@/lib/form-errors';
import { toast } from '@/lib/toast';
import { routeAfterAuth } from '@/lib/user-api';

export function VerifyEmailForm() {
  const theme = useAuthTheme();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const resolvedEmail = typeof email === 'string' ? email : '';

  const [isLoading, setIsLoading] = useState(false);
  const [values, setValues] = useState<VerifyEmailValues>({ otp: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<keyof VerifyEmailValues>>({});

  const fieldProps = { variant: 'auth' as const, authTheme: theme, compact: true };
  const inputProps = { variant: 'auth' as const, authTheme: theme };

  async function handleVerify() {
    if (!resolvedEmail) {
      toast.error('Email is missing. Please restart sign-up.');
      return;
    }

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
      toast.error(error.message || 'Invalid verification code.');
      setIsLoading(false);
      return;
    }

    await refreshSession();
    await waitForStoredAuth();
    toast.success('Email verified successfully.');
    await routeAfterAuth();
    setIsLoading(false);
  }

  async function handleResend() {
    if (!resolvedEmail) {
      return;
    }

    setIsLoading(true);

    const result = await sendVerificationOtp(resolvedEmail);

    if (!result.success) {
      toast.error(result.message);
      setIsLoading(false);
      return;
    }

    toast.info('Verification code resent. Check your inbox.');
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

      <Button
        label="Verify and continue"
        surface="auth"
        authTheme={theme}
        onPress={handleVerify}
        loading={isLoading}
      />

      <Pressable onPress={handleResend}>
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
    textDecorationLine: 'underline',
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
});
