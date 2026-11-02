import { useRouter, type Href } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import {
  GlassTabBar,
  GlassTabButton,
  TabBarMinimizeProvider,
  renderFadingTabScreen,
  type GlassTabBarTheme,
  type GlassTabItem,
} from 'expo-glass-tabs';
import { useCallback, useMemo } from 'react';

import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  liquidGlassLabelColor,
  liquidGlassSelectionChipColor,
} from '@/components/ui/liquid-glass-chrome';
import { resolveColorScheme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type TabIconName =
  | 'figure.table.tennis'
  | 'calendar'
  | 'chart.bar.fill'
  | 'person.2.fill'
  | 'person.crop.circle.fill';

type TabItem = GlassTabItem & { href: Href };

// Labels name what's inside each tab (redesign plan). Route names stay the same
// so deep links and notifications keep working.
// Group-qualified hrefs: "/" alone resolves to the root app/index.tsx, not this layout.
const TABS: { name: string; label: string; href: Href; icon: TabIconName }[] = [
  { name: 'index', label: 'Play', href: '/(app)/(tabs)', icon: 'figure.table.tennis' },
  { name: 'bookings', label: 'Bookings', href: '/(app)/(tabs)/bookings', icon: 'calendar' },
  { name: 'activity', label: 'Progress', href: '/(app)/(tabs)/activity', icon: 'chart.bar.fill' },
  { name: 'community', label: 'Players', href: '/(app)/(tabs)/community', icon: 'person.2.fill' },
  { name: 'account', label: 'Me', href: '/(app)/(tabs)/account', icon: 'person.crop.circle.fill' },
];

// IconSymbol renders SF Symbols on iOS and Material Icons on Android/web,
// so we use renderIcon instead of the package's iOS-only `icon` prop.
const ITEMS: TabItem[] = TABS.map(({ icon, ...tab }) => ({
  ...tab,
  renderIcon: ({ tint, size }) => <IconSymbol name={icon} size={size} color={tint} />,
}));

export default function TabLayout() {
  const router = useRouter();
  const colorScheme = resolveColorScheme(useColorScheme());

  const theme = useMemo<Partial<GlassTabBarTheme>>(
    () => ({
      activeTint: liquidGlassLabelColor(colorScheme, true),
      inactiveTint: liquidGlassLabelColor(colorScheme, false),
      highlight: liquidGlassSelectionChipColor(colorScheme),
      glassTint:
        colorScheme === 'dark' ? 'rgba(10, 10, 12, 0.55)' : 'rgba(255, 255, 255, 0.45)',
      solidFallback:
        colorScheme === 'dark' ? 'rgba(18, 18, 20, 0.94)' : 'rgba(250, 251, 253, 0.96)',
    }),
    [colorScheme],
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
