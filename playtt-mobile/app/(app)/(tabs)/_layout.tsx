import { Tabs } from 'expo-router';
import { useMemo } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProductThemes } from '@/constants/product-theme';
import { Colors, resolveColorScheme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = resolveColorScheme(useColorScheme());
  const palette = Colors[colorScheme];
  const productTheme = ProductThemes[colorScheme];

  const screenOptions = useMemo(
    () => ({
      tabBarActiveTintColor: palette.tabIconSelected,
      tabBarInactiveTintColor: palette.tabIconDefault,
      tabBarStyle: {
        backgroundColor: productTheme.elevated,
        borderTopColor: productTheme.border,
      },
      headerShown: false,
      tabBarButton: HapticTab,
    }),
    [palette.tabIconDefault, palette.tabIconSelected, productTheme.border, productTheme.elevated],
  );

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="book.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
