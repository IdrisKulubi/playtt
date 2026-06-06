import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlayTTColors, PlayTTSpacing } from '@/constants/playtt-tokens';

type MarketingShellProps = {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

export function MarketingShell({ header, footer, children }: MarketingShellProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {header ? <View style={styles.header}>{header}</View> : null}
        <View style={styles.content}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PlayTTColors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: PlayTTSpacing.xl,
    paddingBottom: PlayTTSpacing.lg,
  },
  header: {
    paddingTop: PlayTTSpacing.md,
    paddingBottom: PlayTTSpacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  footer: {
    gap: PlayTTSpacing.sm,
    paddingTop: PlayTTSpacing.lg,
  },
});
