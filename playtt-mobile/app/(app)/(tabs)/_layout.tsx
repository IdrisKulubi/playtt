import { useRouter, type Href } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { TabBarMinimizeProvider, renderFadingTabScreen } from 'expo-glass-tabs';
import { useCallback, useMemo } from 'react';

import {
  GlassTabBar,
  GlassTabButton,
  type GlassTabBarTheme,
  type GlassTabItem,
} from '@/components/navigation/glass-tab-bar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  liquidGlassLabelColor,
  liquidGlassPillBorderColor,
  liquidGlassSelectionChipColor,
} from '@/components/ui/liquid-glass-chrome';
import { useAppTheme } from '@/hooks/use-app-theme';

type TabIconName = 'figure.table.tennis' | 'calendar' | 'chart.bar.fill' | 'person.2.fill';

type TabItem = GlassTabItem & { href: Href };

// Labels name what's inside each tab (redesign plan). Route names stay the same
// so deep links and notifications keep working. Me isn't a tab any more: your
// photo beside each large title opens it, like Apple's own apps.
// Group-qualified hrefs: "/" alone resolves to the root app/index.tsx, not this layout.
const TABS: { name: string; label: string; href: Href; icon: TabIconName }[] = [
  { name: 'index', label: 'Play', href: '/(app)/(tabs)', icon: 'figure.table.tennis' },
  { name: 'bookings', label: 'Bookings', href: '/(app)/(tabs)/bookings', icon: 'calendar' },
  { name: 'activity', label: 'Progress', href: '/(app)/(tabs)/activity', icon: 'chart.bar.fill' },
  { name: 'community', label: 'Players', href: '/(app)/(tabs)/community', icon: 'person.2.fill' },
];

// IconSymbol renders SF Symbols on iOS and Material Icons on Android/web.
const ITEMS: TabItem[] = TABS.map(({ icon, ...tab }) => ({
  ...tab,
  renderIcon: ({ tint, size }) => <IconSymbol name={icon} size={size} color={tint} />,
}));

export default function TabLayout() {
  const router = useRouter();
  const { scheme, colors } = useAppTheme();

  // Like Fitness: the current tab is in colour on a lighter chip.
  const theme = useMemo<GlassTabBarTheme>(
    () => ({
      scheme,
      activeTint: colors.accentText,
      inactiveTint: liquidGlassLabelColor(scheme, false),
      highlight: liquidGlassSelectionChipColor(scheme),
      glassTint: scheme === 'dark' ? 'rgba(10, 10, 12, 0.35)' : 'rgba(255, 255, 255, 0.35)',
      solidFallback: scheme === 'dark' ? 'rgba(28, 28, 32, 0.96)' : 'rgba(250, 251, 253, 0.97)',
      border: liquidGlassPillBorderColor(scheme),
      background: colors.background,
    }),
    [scheme, colors.accentText, colors.background],
  );

  const handleIndexSelected = useCallback(
    (index: number) => {
      const item = ITEMS[index];
      if (item) router.navigate(item.href);
    },
    [router],
  );

  return (
    <TabBarMinimizeProvider>
      <Tabs>
        <TabSlot style={{ height: '100%' }} renderFn={renderFadingTabScreen} />
        <TabList asChild>
          <GlassTabBar theme={theme} onIndexSelected={handleIndexSelected}>
            {ITEMS.map(({ href, ...item }, index) => (
              <TabTrigger key={item.name} name={item.name} href={href} asChild>
                <GlassTabButton item={item} index={index} />
              </TabTrigger>
            ))}
          </GlassTabBar>
        </TabList>
        {/* Hidden route: old coach tab links redirect to the Coach screen. */}
        <TabList style={{ display: 'none' }}>
          <TabTrigger name="coach" href="/(app)/(tabs)/coach" />
        </TabList>
      </Tabs>
    </TabBarMinimizeProvider>
  );
}
