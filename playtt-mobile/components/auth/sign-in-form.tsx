import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthFormCard } from '@/components/auth/auth-form-card';
import { Button } from '@/components/ui/button';
import { FormDivider } from '@/components/ui/form-divider';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTTypography,
} from '@/constants/playtt-tokens';
import { formatAuthError } from '@/lib/auth-errors';
import { authClient, refreshSession } from '@/lib/auth-client';
import { goToAuthenticatedHome } from '@/lib/auth-navigation';
import { otpSchema, signInSchema, type OtpValues, type SignInValues } from '@/lib/auth-schemas';
import { mapZodErrors, type FieldErrors } from '@/lib/form-errors';

export function SignInForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [signInValues, setSignInValues] = useState<SignInValues>({ email: '', password: '' });
  const [signInErrors, setSignInErrors] = useState<FieldErrors<keyof SignInValues>>({});
  const [otpValues, setOtpValues] = useState<OtpValues>({ otp: '' });
  const [otpErrors, setOtpErrors] = useState<FieldErrors<keyof OtpValues>>({});

  async function completeSignIn() {
    await refreshSession();
    goToAuthenticatedHome();
  }

  async function handleEmailSignIn() {
    setFormError(null);
    const parsed = signInSchema.safeParse(signInValues);
    if (!parsed.success) {
      setSignInErrors(mapZodErrors(parsed));
      return;
    }

    setSignInErrors({});
    setIsLoading(true);

    await authClient.signIn.email(
      {
        email: parsed.data.email,
        password: parsed.data.password,
      },
      {
        onSuccess: async (ctx) => {
          if (ctx.data.twoFactorRedirect) {
            setShowTwoFactor(true);
            setFormError(null);
          } else {
            await completeSignIn();
          }
          setIsLoading(false);
        },
        onError: (ctx) => {
          setFormError(formatAuthError(ctx.error.message || 'Failed to sign in.'));
          setIsLoading(false);
        },
      },
    );
  }

  async function handleOtpSubmit() {
    setFormError(null);
    const parsed = otpSchema.safeParse(otpValues);
    if (!parsed.success) {
      setOtpErrors(mapZodErrors(parsed));
      return;
    }

    setOtpErrors({});
    setIsLoading(true);

    const { error } = await authClient.twoFactor.verifyOtp({
      code: parsed.data.otp,
      trustDevice: true,
    });

    if (error) {
      setFormError(formatAuthError(error.message || 'Invalid verification code.'));
      setIsLoading(false);
      return;
    }

    await completeSignIn();
    setIsLoading(false);
  }

  async function handleGoogleSignIn() {
    setFormError(null);
    setIsLoading(true);

    await authClient.signIn.social(
      {
        provider: 'google',
        callbackURL: '/(app)/(tabs)',
      },
      {
        onSuccess: () => {
          // OAuth redirect handles session
        },
        onError: (ctx) => {
          setFormError(formatAuthError(ctx.error.message || 'Google sign in failed.'));
          setIsLoading(false);
        },
      },
    );
  }

  if (showTwoFactor) {
    return (
      <AuthFormCard
        title="Check your verification code"
        description="Enter the six-digit code from your second factor to continue into PlayTT."
        footer={
          <Pressable onPress={() => setShowTwoFactor(false)}>
            <Text style={styles.inlineLink}>Return to sign in</Text>
          </Pressable>
        }>
        <FormField label="Verification code" error={otpErrors.otp}>
          <Input
            value={otpValues.otp}
            onChangeText={(otp) => setOtpValues((current) => ({ ...current, otp }))}
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            hasError={Boolean(otpErrors.otp)}
          />
        </FormField>
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <Button
          label="Verify and continue"
          surface="product"
          onPress={handleOtpSubmit}
          loading={isLoading}
        />
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard
      title="Sign in"
      description="Use your email or Google to continue."
      footer={
        <Text style={styles.footerText}>
          Need an account?{' '}
          <Text style={styles.inlineLink} onPress={() => router.push('/sign-up')}>
            Create one
          </Text>
        </Text>
      }>
      <Button
        label="Continue with Google"
        variant="outline"
        surface="product"
        onPress={handleGoogleSignIn}
        loading={isLoading}
      />

      <FormDivider label="Or use email" />

      <FormField label="Email" error={signInErrors.email}>
        <Input
          value={signInValues.email}
          onChangeText={(email) => setSignInValues((current) => ({ ...current, email }))}
          placeholder="name@theplaytt.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          hasError={Boolean(signInErrors.email)}
        />
      </FormField>

      <FormField
        label="Password"
        error={signInErrors.password}
        accessory={
          <View style={styles.passwordAccessory}>
            <Pressable onPress={() => router.push('/reset-password')}>
              <Text style={styles.inlineLink}>Forgot?</Text>
            </Pressable>
            <Pressable onPress={() => setShowPassword((current) => !current)}>
              <Text style={styles.inlineLink}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
        }>
        <Input
          value={signInValues.password}
          onChangeText={(password) => setSignInValues((current) => ({ ...current, password }))}
          placeholder="Your password"
          secureTextEntry={!showPassword}
          autoComplete="password"
          hasError={Boolean(signInErrors.password)}
        />
      </FormField>

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <Button
        label="Sign in"
        surface="product"
        onPress={handleEmailSignIn}
        loading={isLoading}
      />
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
  passwordAccessory: {
    flexDirection: 'row',
    gap: 12,
  },
  formError: {
    ...PlayTTTypography.label,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.destructive,
    textAlign: 'center',
  },
});
