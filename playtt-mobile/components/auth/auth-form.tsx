import type { AuthMode } from '@/constants/auth-theme';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { SocialAuthButton } from '@/components/auth/social-auth-button';
import { Button } from '@/components/ui/button';
import { FormDivider } from '@/components/ui/form-divider';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PlayTTFontFamilies, PlayTTSpacing } from '@/constants/playtt-tokens';
import { useAuthTheme } from '@/hooks/use-auth-theme';
import {
  AppleSignInCanceledError,
  isAppleSignInAvailable,
  signInWithApple,
} from '@/lib/apple-sign-in';
import { sendVerificationOtp, signInWithAppleApi } from '@/lib/auth-api';
import { formatAuthError } from '@/lib/auth-errors';
import { toast } from '@/lib/toast';
import { authClient, refreshSession } from '@/lib/auth-client';
import { storeAppleSession, waitForStoredAuth } from '@/lib/auth-helpers';
import {
  goToResetPassword,
  goToVerifyEmail,
} from '@/lib/auth-navigation';
import { routeAfterAuth } from '@/lib/user-api';
import {
  otpSchema,
  signInSchema,
  signUpSchema,
  type OtpValues,
  type SignInValues,
  type SignUpValues,
} from '@/lib/auth-schemas';
import { mapZodErrors, type FieldErrors } from '@/lib/form-errors';

type AuthFormProps = {
  initialMode?: AuthMode;
  onModeChange?: (mode: AuthMode) => void;
};

export function AuthForm({ initialMode = 'sign-in', onModeChange }: AuthFormProps) {
  const theme = useAuthTheme();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [isLoading, setIsLoading] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [signInValues, setSignInValues] = useState<SignInValues>({
    email: '',
    password: '',
  });
  const [signInErrors, setSignInErrors] = useState<FieldErrors<keyof SignInValues>>({});
  const [signUpValues, setSignUpValues] = useState<SignUpValues>({
    name: '',
    email: '',
    password: '',
  });
  const [signUpErrors, setSignUpErrors] = useState<FieldErrors<keyof SignUpValues>>({});
  const [otpValues, setOtpValues] = useState<OtpValues>({ otp: '' });
  const [otpErrors, setOtpErrors] = useState<FieldErrors<keyof OtpValues>>({});

  const isSignIn = mode === 'sign-in';
  const isIos = Platform.OS === 'ios';
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (!isIos) {
      return;
    }

    void isAppleSignInAvailable().then(setAppleAvailable);
  }, [isIos]);

  function handleModeChange(nextMode: AuthMode) {
    setMode(nextMode);
    onModeChange?.(nextMode);
  }

  async function completeSignIn() {
    await refreshSession();
    await waitForStoredAuth();
    await routeAfterAuth();
  }

  async function handleEmailSignIn() {
    const parsed = signInSchema.safeParse(signInValues);
    if (!parsed.success) {
      setSignInErrors(mapZodErrors(parsed));
      return;
    }

    setSignInErrors({});
    setIsLoading(true);

    await authClient.signIn.email(
      { email: parsed.data.email, password: parsed.data.password },
      {
        onSuccess: async (ctx) => {
          if (ctx.data.twoFactorRedirect) {
            setShowTwoFactor(true);
            toast.info('Two-factor verification is required.');
          } else {
            await completeSignIn();
          }
          setIsLoading(false);
        },
        onError: (ctx) => {
          toast.error(formatAuthError(ctx.error.message || 'Failed to sign in.'));
          setIsLoading(false);
        },
      },
    );
  }

  async function handleSignUp() {
    const parsed = signUpSchema.safeParse(signUpValues);
    if (!parsed.success) {
      setSignUpErrors(mapZodErrors(parsed));
      return;
    }

    setSignUpErrors({});
    setIsLoading(true);

    await authClient.signUp.email(
      {
        email: parsed.data.email,
        password: parsed.data.password,
        name: parsed.data.name,
      },
      {
        onSuccess: async () => {
          const result = await sendVerificationOtp(parsed.data.email);
          if (!result.success) {
            toast.error(result.message);
            setIsLoading(false);
            return;
          }
          goToVerifyEmail(parsed.data.email);
          setIsLoading(false);
        },
        onError: (ctx) => {
          toast.error(formatAuthError(ctx.error.message || 'Failed to sign up.'));
          setIsLoading(false);
        },
      },
    );
  }

  async function handleOtpSubmit() {
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
      toast.error(formatAuthError(error.message || 'Invalid verification code.'));
      setIsLoading(false);
      return;
    }

    await completeSignIn();
    setIsLoading(false);
  }

  async function handleGoogleSignIn() {
    setIsLoading(true);

    try {
      await authClient.signIn.social(
        { provider: 'google', callbackURL: '/' },
        {
          onSuccess: async () => {
            const stored = await waitForStoredAuth();
            if (stored?.token) {
              await routeAfterAuth();
            }
            setIsLoading(false);
          },
          onError: (ctx) => {
            toast.error(formatAuthError(ctx.error.message || 'Google sign in failed.'));
            setIsLoading(false);
          },
        },
      );
    } catch (error) {
      toast.apiError(error, 'Google sign in failed.');
      setIsLoading(false);
    }
  }

  async function handleAppleSignIn() {
    setIsLoading(true);

    try {
      console.log('[PlayTT auth] Apple sign-in via /api/apple/sign-in');
      const credential = await signInWithApple();
      const result = await signInWithAppleApi(credential);

      await storeAppleSession(result.user, result.token);
      await routeAfterAuth();
      setIsLoading(false);
    } catch (error) {
      if (error instanceof AppleSignInCanceledError) {
        setIsLoading(false);
        return;
      }

      toast.apiError(error, 'Apple sign in failed.');
      setIsLoading(false);
    }
  }

  const fieldProps = { variant: 'auth' as const, authTheme: theme, compact: true };
  const inputProps = { variant: 'auth' as const, authTheme: theme };

  if (showTwoFactor) {
    return (
      <View style={styles.form}>
        <FormField label="Verification code" error={otpErrors.otp} {...fieldProps}>
          <Input
            {...inputProps}
            value={otpValues.otp}
            onChangeText={(otp) => setOtpValues((current) => ({ ...current, otp }))}
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            hasError={Boolean(otpErrors.otp)}
          />
        </FormField>
        <Button
          label="Verify and continue"
          surface="auth"
          authTheme={theme}
          onPress={handleOtpSubmit}
          loading={isLoading}
        />
        <Pressable onPress={() => setShowTwoFactor(false)}>
          <Text style={[styles.modeLink, { color: theme.link }]}>Return to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      {isSignIn ? (
        <>
          <FormField label="Email" error={signInErrors.email} {...fieldProps}>
            <Input
              {...inputProps}
              value={signInValues.email}
              onChangeText={(email) =>
                setSignInValues((current) => ({ ...current, email }))
              }
              placeholder="Enter your email address"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              hasError={Boolean(signInErrors.email)}
            />
          </FormField>

          <FormField
            label="Password"
            error={signInErrors.password}
            {...fieldProps}
            accessory={
              <View style={styles.passwordAccessory}>
                <Pressable onPress={goToResetPassword}>
                  <Text style={[styles.inlineLink, { color: theme.link }]}>Forgot?</Text>
                </Pressable>
                <Pressable onPress={() => setShowPassword((current) => !current)}>
                  <Text style={[styles.inlineLink, { color: theme.link }]}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </Pressable>
              </View>
            }>
            <Input
              {...inputProps}
              value={signInValues.password}
              onChangeText={(password) =>
                setSignInValues((current) => ({ ...current, password }))
              }
              placeholder="Your password"
              secureTextEntry={!showPassword}
              autoComplete="password"
              hasError={Boolean(signInErrors.password)}
            />
          </FormField>
        </>
      ) : (
        <>
          <FormField label="Full name" error={signUpErrors.name} {...fieldProps}>
            <Input
              {...inputProps}
              value={signUpValues.name}
              onChangeText={(name) => setSignUpValues((current) => ({ ...current, name }))}
              placeholder="Your name"
              autoComplete="name"
              hasError={Boolean(signUpErrors.name)}
            />
          </FormField>

          <FormField label="Email" error={signUpErrors.email} {...fieldProps}>
            <Input
              {...inputProps}
              value={signUpValues.email}
              onChangeText={(email) =>
                setSignUpValues((current) => ({ ...current, email }))
              }
              placeholder="Enter your email address"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              hasError={Boolean(signUpErrors.email)}
            />
          </FormField>

          <FormField
            label="Password"
            error={signUpErrors.password}
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
              value={signUpValues.password}
              onChangeText={(password) =>
                setSignUpValues((current) => ({ ...current, password }))
              }
              placeholder="At least 8 characters"
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              hasError={Boolean(signUpErrors.password)}
            />
          </FormField>
        </>
      )}

      <Button
        label={isSignIn ? 'Sign in' : 'Continue'}
        surface="auth"
        authTheme={theme}
        onPress={isSignIn ? handleEmailSignIn : handleSignUp}
        loading={isLoading}
      />

      <FormDivider
        label="or continue with"
        variant="auth"
        authTheme={theme}
        compact
      />

      <View style={styles.socialRow}>
        <View style={styles.socialButtonSlot}>
          <SocialAuthButton
            provider="google"
            theme={theme}
            onPress={handleGoogleSignIn}
            loading={isLoading}
          />
        </View>
        {isIos && appleAvailable ? (
          <View style={styles.socialButtonSlot}>
            <SocialAuthButton
              provider="apple"
              theme={theme}
              onPress={handleAppleSignIn}
              loading={isLoading}
            />
          </View>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => handleModeChange(isSignIn ? 'sign-up' : 'sign-in')}>
        <Text style={[styles.modePrompt, { color: theme.muted }]}>
          {isSignIn ? 'New here? ' : 'Existing user? '}
          <Text style={[styles.modeLink, { color: theme.foreground }]}>
            {isSignIn ? 'Create account' : 'Log in'}
          </Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: PlayTTSpacing.md,
  },
  passwordAccessory: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineLink: {
    fontSize: 12,
    fontFamily: PlayTTFontFamilies.semiBold,
  },
  socialRow: {
    flexDirection: 'row',
    gap: PlayTTSpacing.sm,
  },
  socialButtonSlot: {
    flex: 1,
    minWidth: 0,
  },
  modePrompt: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.regular,
    textAlign: 'center',
    marginTop: PlayTTSpacing.xs,
  },
  modeLink: {
    fontFamily: PlayTTFontFamilies.semiBold,
    textDecorationLine: 'underline',
  },
});
