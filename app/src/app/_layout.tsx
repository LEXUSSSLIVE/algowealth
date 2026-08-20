import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import '@/i18n';
import { SessionProvider, useSession } from '@/auth/session';
import { OfflineBanner } from '@/components/offline-banner';

SplashScreen.preventAutoHideAsync();

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { status } = useSession();
  const ready = fontsLoaded && status !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'authed'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="search" options={{ presentation: 'modal' }} />
        <Stack.Screen name="stock/[symbol]" />
        <Stack.Screen name="blog/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="terms" />
      </Stack.Protected>
      <Stack.Protected guard={status !== 'authed'}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider>
        <StatusBar style="dark" />
        <RootNavigator fontsLoaded={fontsLoaded} />
        <OfflineBanner />
      </SessionProvider>
    </GestureHandlerRootView>
  );
}
