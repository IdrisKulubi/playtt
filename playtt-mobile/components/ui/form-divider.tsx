import { StyleSheet, Text, View } from 'react-native';

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from '@/constants/playtt-tokens';

type FormDividerProps = {
  label: string;
};

export function FormDivider({ label }: FormDividerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PlayTTSpacing.sm,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: PlayTTColors.productBorder,
  },
  label: {
    ...PlayTTTypography.label,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.productMuted,
  },
});
