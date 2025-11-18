/**
 * Entry point that redirects based on auth state
 */

import { Redirect } from 'expo-router';
import { useOneContext } from '@src/providers/OneProvider';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
  const { authState, isAuthenticated } = useOneContext();

  // Show loading while initializing
  if (authState === 'uninit' || authState === 'initializing') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  // Redirect based on auth state
  if (isAuthenticated) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#2196F3',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 48,
    color: '#666',
  },
  menuContainer: {
    gap: 16,
  },
  menuButton: {
    backgroundColor: '#2196F3',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    marginTop: 48,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
