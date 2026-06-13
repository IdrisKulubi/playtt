import { Tabs } from 'expo-router';
import { useMemo } from 'react';

import { GlassTabBar } from '@/components/navigation/glass-tab-bar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, resolveColorScheme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = resolveColorScheme(useColorScheme());
  const palette = Colors[colorScheme];

  const screenOptions = useMemo(
    () => ({
      tabBarActiveTintColor: palette.tabIconSelected,
      tabBarInactiveTintColor: palette.tabIconDefault,
      headerShown: false,
      tabBarStyle: {
        position: 'absolute' as const,
        backgroundColor: 'transparent',
        borderTopWidth: 0,
        elevation: 0,
      },
    }),
    [palette.tabIconDefault, palette.tabIconSelected],
  );

  return (
    <Tabs screenOptions={screenOptions} tabBar={(props) => <GlassTabBar {...props} />}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="calendar" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="chart.bar.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="person.2.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol size={size} name="person.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
