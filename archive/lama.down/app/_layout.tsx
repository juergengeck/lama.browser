/**
 * Root layout for the app
 */

import '../global.css';

import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { OneProvider, useOneContext } from '@src/providers/OneProvider';
import { TransportProvider } from '@hooks/useLamaClient';

/**
 * Auth-aware navigation
 */
function RootNavigator() {
  const { isAuthenticated, authState, adapter } = useOneContext();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';

    console.log('[RootNavigator] Auth state:', authState, 'isAuthenticated:', isAuthenticated, 'segments:', segments);

    if (authState === 'logged_in' && isAuthenticated) {
      // User is logged in and ONE.core is ready
      if (inAuthGroup) {
        // Redirect away from auth screens
        console.log('[RootNavigator] Redirecting to app...');
        router.replace('/(tabs)/home');
      }
    } else if (authState === 'ready' || authState === 'logged_out') {
      // User needs to login
      if (!inAuthGroup) {
        // Redirect to login
        console.log('[RootNavigator] Redirecting to login...');
        router.replace('/(auth)/login');
      }
    }
  }, [isAuthenticated, authState, segments]);

  // Provide adapter only when authenticated
  if (isAuthenticated && adapter) {
    return (
      <TransportProvider adapter={adapter}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(screens)" options={{ presentation: 'modal' }} />
        </Stack>
      </TransportProvider>
    );
  }

  // Not authenticated - render without TransportProvider
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(screens)" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

/**
 * Root layout with OneProvider
 */
export default function RootLayout() {
  return (
    <OneProvider>
      <RootNavigator />
    </OneProvider>
  );
}
