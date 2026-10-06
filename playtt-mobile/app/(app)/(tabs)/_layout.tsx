import { Tabs } from 'expo-router';
import { useMemo } from 'react';

import { GlassTabBar } from '@/components/navigation/glass-tab-bar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { resolveColorScheme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = resolveColorScheme(useColorScheme());

  const screenOptions = useMemo(
    () => ({
      tabBarActiveTintColor:
        colorScheme === 'dark' ? '#FFFFFF' : '#0A1628',
      tabBarInactiveTintColor:
        colorScheme === 'dark'
          ? 'rgba(255, 255, 255, 0.55)'
          : 'rgba(10, 22, 40, 0.48)',
      headerShown: false,
      tabBarStyle: {
        position: 'absolute' as const,
        backgroundColor: 'transparent',
        borderTopWidth: 0,
        elevation: 0,
      },
    }),
    [colorScheme],
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
