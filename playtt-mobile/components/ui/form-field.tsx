import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from '@/constants/playtt-tokens';

type FormFieldProps = {
  label: string;
  error?: string;
  accessory?: ReactNode;
  children: ReactNode;
};

export function FormField({ label, error, accessory, children }: FormFieldProps) {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {accessory}
      </View>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: PlayTTSpacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: PlayTTSpacing.sm,
  },
  label: {
    ...PlayTTTypography.label,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.productForeground,
  },
  error: {
    ...PlayTTTypography.label,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.destructive,
  },
});
