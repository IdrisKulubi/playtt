import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
  PlayTTTypography,
  PlayTTElevation,
} from '@/constants/playtt-tokens';

type AuthFormCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthFormCard({ title, description, children, footer }: AuthFormCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <View style={styles.content}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PlayTTColors.productInput,
    borderRadius: PlayTTRadius.card,
    borderWidth: 1,
    borderColor: PlayTTColors.productBorder,
    overflow: 'hidden',
    ...PlayTTElevation.soft,
  },
  header: {
    gap: PlayTTSpacing.xs,
    paddingHorizontal: PlayTTSpacing.lg,
    paddingTop: PlayTTSpacing.lg,
  },
  title: {
    ...PlayTTTypography.title,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.productForeground,
  },
  description: {
    ...PlayTTTypography.body,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.productMuted,
  },
  content: {
    paddingHorizontal: PlayTTSpacing.lg,
    paddingTop: PlayTTSpacing.lg,
    paddingBottom: PlayTTSpacing.lg,
    gap: PlayTTSpacing.md,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PlayTTColors.productBorder,
    paddingHorizontal: PlayTTSpacing.lg,
    paddingVertical: PlayTTSpacing.md,
  },
});
