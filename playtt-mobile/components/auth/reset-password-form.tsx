import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AuthFormCard } from '@/components/auth/auth-form-card';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTTypography,
} from '@/constants/playtt-tokens';
import { requestPasswordReset } from '@/lib/auth-api';
import { requestResetSchema, type RequestResetValues } from '@/lib/auth-schemas';
import { mapZodErrors, type FieldErrors } from '@/lib/form-errors';

export function ResetPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [values, setValues] = useState<RequestResetValues>({ email: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<keyof RequestResetValues>>({});

  async function handleSubmit() {
    setFormError(null);
    setStatusMessage(null);
    const parsed = requestResetSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(mapZodErrors(parsed));
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    const result = await requestPasswordReset(parsed.data.email);

    if (!result.success) {
      setFormError(result.message);
      setIsLoading(false);
      return;
    }

    setStatusMessage(
      'If an account exists for that email, a reset link has been sent. Open it on this device to continue.',
    );
    setIsLoading(false);
  }

  return (
    <AuthFormCard
      title="Reset your password"
      description="We will email a secure link that opens PlayTT on this device."
      footer={
        <Text style={styles.footerText}>
          Remembered it?{' '}
          <Text style={styles.inlineLink} onPress={() => router.replace('/sign-in')}>
            Back to sign in
          </Text>
        </Text>
      }>
      <FormField label="Email" error={fieldErrors.email}>
        <Input
          value={values.email}
          onChangeText={(email) => setValues({ email })}
          placeholder="name@theplaytt.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          hasError={Boolean(fieldErrors.email)}
        />
      </FormField>

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}

      <Button
        label="Send reset link"
        surface="product"
        onPress={handleSubmit}
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
