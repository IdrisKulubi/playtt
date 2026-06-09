import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PlayTTFontFamilies, PlayTTSpacing } from '@/constants/playtt-tokens';
import { useAuthTheme } from '@/hooks/use-auth-theme';
import { requestPasswordReset } from '@/lib/auth-api';
import { goToResetPasswordConfirm } from '@/lib/auth-navigation';
import { requestResetSchema, type RequestResetValues } from '@/lib/auth-schemas';
import { mapZodErrors, type FieldErrors } from '@/lib/form-errors';
import { toast } from '@/lib/toast';

export function ResetPasswordForm() {
  const theme = useAuthTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [values, setValues] = useState<RequestResetValues>({ email: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<keyof RequestResetValues>>({});

  const fieldProps = { variant: 'auth' as const, authTheme: theme, compact: true };
  const inputProps = { variant: 'auth' as const, authTheme: theme };

  async function handleSubmit() {
    const parsed = requestResetSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(mapZodErrors(parsed));
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    const result = await requestPasswordReset(parsed.data.email);

    if (!result.success) {
      toast.error(result.message);
      setIsLoading(false);
      return;
    }

    toast.info('Reset code sent. Check your inbox.');
    goToResetPasswordConfirm(parsed.data.email);
    setIsLoading(false);
  }

  return (
    <View style={styles.form}>
      <FormField label="Email" error={fieldErrors.email} {...fieldProps}>
        <Input
          {...inputProps}
          value={values.email}
          onChangeText={(email) => setValues({ email })}
          placeholder="Enter your email address"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          hasError={Boolean(fieldErrors.email)}
        />
      </FormField>

      <Button
        label="Continue"
        surface="auth"
        authTheme={theme}
        onPress={handleSubmit}
        loading={isLoading}
      />

      <Pressable onPress={() => router.replace('/?mode=sign-in')}>
        <Text style={[styles.modePrompt, { color: theme.muted }]}>
          Remembered it?{' '}
          <Text style={[styles.modeLink, { color: theme.foreground }]}>Log in</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: PlayTTSpacing.md,
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
