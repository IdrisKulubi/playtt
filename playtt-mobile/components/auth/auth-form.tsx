import type { AuthMode } from '@/constants/auth-theme';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { EnvelopeSimple } from 'phosphor-react-native/src/icons/EnvelopeSimple';
import { LockSimple } from 'phosphor-react-native/src/icons/LockSimple';
import { User } from 'phosphor-react-native/src/icons/User';
import { Eye } from 'phosphor-react-native/src/icons/Eye';
import { EyeSlash } from 'phosphor-react-native/src/icons/EyeSlash';

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
import { authDebug, authDebugError } from '@/lib/auth-debug';
import { formatAuthError } from '@/lib/auth-errors';
import { getApiBaseUrl } from '@/lib/env';
import { toast } from '@/lib/toast';
import { authClient, refreshSession } from '@/lib/auth-client';
import { storeAppleSession, waitForStoredAuth } from '@/lib/auth-helpers';
import { acceptAuthenticatedSession } from '@/lib/auth-session-state';
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
  const [appleAvailable, setAppleAvailable] = useState<boolean | null>(isIos ? null : false);

  useEffect(() => {
    if (!isIos) {
      return;
    }

    let mounted = true;
    void isAppleSignInAvailable().then((available) => {
      if (mounted) setAppleAvailable(available);
    }).catch((error) => {
      authDebugError('apple-availability:failed', error);
      if (mounted) setAppleAvailable(false);
    });
    return () => { mounted = false; };
  }, [isIos]);

  function handleModeChange(nextMode: AuthMode) {
    setMode(nextMode);
    onModeChange?.(nextMode);
  }

  async function completeSignIn() {
    authDebug('complete-sign-in:start');
    const result = await refreshSession();
    if (!result.data?.session) {
      throw new Error('Your sign in could not be confirmed. Please try again.');
    }
    await acceptAuthenticatedSession();
    const stored = await waitForStoredAuth();
    authDebug('complete-sign-in:stored-auth', {
      found: Boolean(stored?.token),
      source: stored?.source,
    });
    await routeAfterAuth();
    authDebug('complete-sign-in:done');
  }

  async function handleEmailSignIn() {
    const parsed = signInSchema.safeParse(signInValues);
    if (!parsed.success) {
      setSignInErrors(mapZodErrors(parsed));
      return;
    }

    setSignInErrors({});
    setIsLoading(true);

    try {
      const { data, error } = await authClient.signIn.email({
        email: parsed.data.email, password: parsed.data.password,
      });
      if (error) {
        toast.error(formatAuthError(error.message || 'Failed to sign in.'));
        return;
      }
      if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) {
        setShowTwoFactor(true);
        toast.info('Two-factor verification is required.');
      } else {
        await completeSignIn();
      }
    } catch (error) {
      toast.apiError(error, 'Failed to sign in.');
    } finally {
      setIsLoading(false);
    }
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
    await handleSocialSignIn('google');
  }

  async function handleSocialSignIn(provider: 'google' | 'apple') {
    const providerLabel = provider === 'google' ? 'Google' : 'Apple';
    setIsLoading(true);

    try {
      const callbackURL = Platform.OS === 'web'
        ? '/'
        : Linking.createURL('/', { scheme: 'playtt' });
      authDebug(`${provider}-flow:start`, {
        callbackURL,
        apiBaseURL: getApiBaseUrl(),
        executionEnvironment: Constants.executionEnvironment,
        platform: Platform.OS,
      });
      // The Expo plugin opens the browser in its success hook. Wait for all
      // hooks before refreshing or routing, otherwise stale auth can interrupt it.
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL,
      });
      if (error) {
        authDebugError(`${provider}-flow:rejected`, new Error(error.message || `${providerLabel} sign in failed.`), {
          code: error.code,
          callbackURL,
          apiBaseURL: getApiBaseUrl(),
        });
        toast.error(error.code === 'INVALID_CALLBACK_URL'
          ? `${providerLabel} sign in could not return to this app. Please try another sign-in method.`
          : formatAuthError(error.message || `${providerLabel} sign in failed.`));
        return;
      }
      const result = await refreshSession();
      // Canceling the browser also resolves the social request successfully.
      if (!result.data?.session) {
        return;
      }
      await completeSignIn();
    } catch (error) {
      toast.apiError(error, `${providerLabel} sign in failed.`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAppleSignIn() {
    if (!isIos || !appleAvailable) {
      await handleSocialSignIn('apple');
      return;
    }
    setIsLoading(true);
    authDebug('apple-flow:start');

    try {
      const credential = await signInWithApple();
      const result = await signInWithAppleApi(credential);

      authDebug('apple-flow:store-session-start', {
        userId: result.user.id,
        isNewUser: result.isNewUser,
      });
      await storeAppleSession(result.user, result.token);

      const stored = await waitForStoredAuth();
      if (!stored?.token) {
        throw new Error('Apple sign in saved no local session. Check SecureStore.');
      }

      authDebug('apple-flow:route-after-auth-start', {
        source: stored.source,
      });
      await routeAfterAuth();
      authDebug('apple-flow:success');
      setIsLoading(false);
    } catch (error) {
      if (error instanceof AppleSignInCanceledError) {
        authDebug('apple-flow:canceled');
        setIsLoading(false);
        return;
      }

      authDebugError('apple-flow:failed', error);
      toast.apiError(error, 'Apple sign in failed.');
      setIsLoading(false);
    }
  }

  const fieldProps = { variant: 'auth' as const, authTheme: theme, compact: true };
  const inputProps = { variant: 'auth' as const, authTheme: theme };
  const passwordVisibility = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
      onPress={() => setShowPassword((current) => !current)}
      style={styles.visibilityButton}>
      {showPassword ? <Eye size={20} color={theme.muted} /> : <EyeSlash size={20} color={theme.muted} />}
    </Pressable>
  );

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
              accessibilityLabel="Email"
              leadingIcon={<EnvelopeSimple size={18} color={theme.muted} />}
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
            >
            <Input
              {...inputProps}
              accessibilityLabel="Password"
              leadingIcon={<LockSimple size={18} color={theme.muted} />}
              trailingAccessory={passwordVisibility}
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
          <Pressable accessibilityRole="button" onPress={goToResetPassword} style={styles.forgotButton}>
            <Text style={[styles.inlineLink, { color: theme.link }]}>Forgot password?</Text>
          </Pressable>
        </>
      ) : (
        <>
          <FormField label="Full name" error={signUpErrors.name} {...fieldProps}>
            <Input
              {...inputProps}
              accessibilityLabel="Full name"
              leadingIcon={<User size={18} color={theme.muted} />}
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
              accessibilityLabel="Email"
              leadingIcon={<EnvelopeSimple size={18} color={theme.muted} />}
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
            >
            <Input
              {...inputProps}
              accessibilityLabel="Password"
              leadingIcon={<LockSimple size={18} color={theme.muted} />}
              trailingAccessory={passwordVisibility}
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
        label={isSignIn ? 'Sign in' : 'Create account'}
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
          <View style={styles.socialButtonSlot}>
            <SocialAuthButton
              provider="apple"
              theme={theme}
              onPress={handleAppleSignIn}
              loading={isLoading}
              disabled={isIos && appleAvailable === null}
            />
          </View>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isLoading}
        style={styles.modeButton}
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
    gap: 16,
  },
  visibilityButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  forgotButton: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', marginTop: -12, marginBottom: -4 },
  modeButton: { minHeight: 44, justifyContent: 'center', marginTop: 12 },
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
