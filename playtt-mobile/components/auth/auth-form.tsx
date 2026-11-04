import type { AuthMode } from '@/constants/auth-theme';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { EnvelopeSimple } from 'phosphor-react-native/src/icons/EnvelopeSimple';
import { LockSimple } from 'phosphor-react-native/src/icons/LockSimple';
import { User } from 'phosphor-react-native/src/icons/User';
import { Eye } from 'phosphor-react-native/src/icons/Eye';
import { EyeSlash } from 'phosphor-react-native/src/icons/EyeSlash';

import { SocialAuthButton } from '@/components/auth/social-auth-button';
import { AuthFieldGroup, AuthRow } from '@/components/auth/auth-field-group';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { SegmentedControl } from '@/components/kit/segmented-control';
import { FormDivider } from '@/components/ui/form-divider';
import { PlayTTSpacing } from '@/constants/playtt-tokens';
import { typeStyle } from '@/constants/type';
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

/** Shown when someone backs out of a social sign-in: say what happened and what to try next. */
function cancelHint(provider: 'google' | 'apple') {
  return provider === 'apple'
    ? 'Sign in with Apple didn’t finish. You can try Google, or use your email and password.'
    : 'Sign in with Google didn’t finish. You can try Apple, or use your email and password.';
}

export function AuthForm({ initialMode = 'sign-in', onModeChange }: AuthFormProps) {
  const theme = useAuthTheme();
  const reducedMotion = useReducedMotion();
  const emailInput = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);
  const nameInput = useRef<ComponentRef<typeof TextInput>>(null);
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
        toast.info(cancelHint(provider));
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
        toast.info(cancelHint('apple'));
        setIsLoading(false);
        return;
      }

      authDebugError('apple-flow:failed', error);
      toast.apiError(error, 'Apple sign in failed.');
      setIsLoading(false);
    }
  }

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
        <AuthFieldGroup>
          <AuthRow
            first
            theme={theme}
            icon={({ color }) => <LockSimple size={20} color={color} />}
            accessibilityLabel="Verification code"
            error={otpErrors.otp}
            value={otpValues.otp}
            onChangeText={(otp) => setOtpValues((current) => ({ ...current, otp }))}
            placeholder="Verification code"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={8}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={handleOtpSubmit}
          />
        </AuthFieldGroup>
        <AuthPrimaryButton label="Verify and continue" theme={theme} onPress={handleOtpSubmit} loading={isLoading} />
        <Pressable accessibilityRole="button" onPress={() => setShowTwoFactor(false)} style={styles.textButton}>
          <Text style={[styles.inlineLink, { color: theme.link }]}>Return to sign in</Text>
        </Pressable>
      </View>
    );
  }

  // One-tap sign-in first (Apple on iPhone leads), email underneath (redesign plan).
  const appleButton = (
    <SocialAuthButton
      provider="apple"
      theme={theme}
      onPress={handleAppleSignIn}
      loading={isLoading}
      disabled={isIos && appleAvailable === null}
    />
  );
  const googleButton = (
    <SocialAuthButton provider="google" theme={theme} onPress={handleGoogleSignIn} loading={isLoading} />
  );

  // Each block rises in turn on arrival, like Apple's own onboarding.
  const rise = (index: number) =>
    reducedMotion ? undefined : FadeInDown.duration(420).delay(120 + index * 70);
  const swap = reducedMotion ? undefined : FadeIn.duration(220);
  const leave = reducedMotion ? undefined : FadeOut.duration(120);

  return (
    <View style={styles.form}>
      <Animated.View entering={rise(0)}>
        <SegmentedControl
          appearance="onGlass"
          label="Sign in or create an account"
          value={mode}
          onChange={handleModeChange}
          options={[
            { value: 'sign-in', label: 'Sign in' },
            { value: 'sign-up', label: 'Create account' },
          ]}
        />
      </Animated.View>

      <Animated.View entering={rise(1)} style={styles.socialStack}>
        {isIos ? appleButton : googleButton}
        {isIos ? googleButton : appleButton}
      </Animated.View>

      <Animated.View entering={rise(2)}>
        <FormDivider label="or use your email" variant="auth" authTheme={theme} compact />
      </Animated.View>

      <Animated.View entering={rise(3)} layout={reducedMotion ? undefined : LinearTransition.duration(260)}>
        {isSignIn ? (
          <Animated.View key="sign-in" entering={swap} exiting={leave}>
            <AuthFieldGroup>
              <AuthRow
                first
                theme={theme}
                icon={({ color }) => <EnvelopeSimple size={20} color={color} />}
                accessibilityLabel="Email"
                error={signInErrors.email}
                value={signInValues.email}
                onChangeText={(email) => setSignInValues((current) => ({ ...current, email }))}
                placeholder="Email"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="username"
                keyboardType="email-address"
                inputRef={emailInput}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordInput.current?.focus()}
              />
              <AuthRow
                theme={theme}
                icon={({ color }) => <LockSimple size={20} color={color} />}
                trailing={passwordVisibility}
                inputRef={passwordInput}
                accessibilityLabel="Password"
                error={signInErrors.password}
                value={signInValues.password}
                onChangeText={(password) => setSignInValues((current) => ({ ...current, password }))}
                placeholder="Password"
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleEmailSignIn}
              />
            </AuthFieldGroup>
            <Pressable accessibilityRole="button" onPress={goToResetPassword} style={styles.forgotButton}>
              <Text style={[styles.inlineLink, { color: theme.link }]}>Forgot password?</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View key="sign-up" entering={swap} exiting={leave}>
            <AuthFieldGroup>
              <AuthRow
                first
                theme={theme}
                icon={({ color }) => <User size={20} color={color} />}
                accessibilityLabel="Full name"
                error={signUpErrors.name}
                value={signUpValues.name}
                onChangeText={(name) => setSignUpValues((current) => ({ ...current, name }))}
                placeholder="Full name"
                autoComplete="name"
                textContentType="name"
                autoCapitalize="words"
                inputRef={nameInput}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => emailInput.current?.focus()}
              />
              <AuthRow
                theme={theme}
                icon={({ color }) => <EnvelopeSimple size={20} color={color} />}
                accessibilityLabel="Email"
                error={signUpErrors.email}
                value={signUpValues.email}
                onChangeText={(email) => setSignUpValues((current) => ({ ...current, email }))}
                placeholder="Email"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                inputRef={emailInput}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordInput.current?.focus()}
              />
              <AuthRow
                theme={theme}
                icon={({ color }) => <LockSimple size={20} color={color} />}
                trailing={passwordVisibility}
                inputRef={passwordInput}
                accessibilityLabel="Password"
                error={signUpErrors.password}
                value={signUpValues.password}
                onChangeText={(password) => setSignUpValues((current) => ({ ...current, password }))}
                placeholder="Password, at least 8 characters"
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={handleSignUp}
              />
            </AuthFieldGroup>
          </Animated.View>
        )}
      </Animated.View>

      <Animated.View entering={rise(4)} layout={reducedMotion ? undefined : LinearTransition.duration(260)}>
        <AuthPrimaryButton
          label={isSignIn ? 'Sign in' : 'Create account'}
          theme={theme}
          onPress={isSignIn ? handleEmailSignIn : handleSignUp}
          loading={isLoading}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 12,
  },
  visibilityButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  forgotButton: { alignSelf: 'flex-end', minHeight: 36, justifyContent: 'center', paddingHorizontal: 6 },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  inlineLink: {
    ...typeStyle('subheadline', '600'),
  },
  socialStack: {
    gap: PlayTTSpacing.sm,
  },
});
