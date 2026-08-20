import { Tabs } from 'expo-router';
import { Globe, Heart, House, TrendingUp } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { colors, font } from '@/theme/tokens';

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color }) => <House size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: t('tabs.portfolio'),
          tabBarIcon: ({ color }) => <TrendingUp size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: t('tabs.watchlist'),
          tabBarIcon: ({ color }) => <Heart size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="blog"
        options={{
          title: t('tabs.blog'),
          tabBarIcon: ({ color }) => <Globe size={24} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
