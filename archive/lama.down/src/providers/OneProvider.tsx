/**
 * OneProvider - ONE.core initialization and authentication for lama.app
 *
 * This provider handles:
 * 1. Creating MultiUser authenticator instance (pre-login)
 * 2. Login/logout flows
 * 3. Initializing ONE.core storage after login
 * 4. Creating and initializing plans (ChatPlan, ContactsPlan, etc.)
 * 5. Providing initialized transport adapter to the app
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { PropsWithChildren } from 'react';
import { StyleSheet, ActivityIndicator, View, Text } from 'react-native';
import { PlanTransportAdapter } from '@transport/PlanTransportAdapter';
import { SettingsPlan } from '@settings/core';
import type { Settings } from '@settings/core';
import { ExpoSettingsStorage } from '@storage/ExpoSettingsStorage';

// Dynamic imports to avoid bundling issues
type MultiUserType = any; // Will import dynamically
type SHA256IdHash = any;
type Person = any;

/**
 * Authentication state
 */
type AuthState = 'uninit' | 'initializing' | 'ready' | 'logging_in' | 'logged_in' | 'logging_out' | 'logged_out';

interface OneContextValue {
  authState: AuthState;
  authenticator: MultiUserType | null;
  adapter: PlanTransportAdapter | null;
  settingsPlan: SettingsPlan | null;
  settings: Settings | null;
  login: (email: string, secret: string, instanceName: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  personId: SHA256IdHash<Person> | null;
}

const OneContext = createContext<OneContextValue | null>(null);

/**
 * Configuration for ONE.core
 */
const ONE_CONFIG = {
  directory: 'lama-app',
  name: 'lama-mobile',
};

/**
 * OneProvider component
 */
export function OneProvider({ children }: PropsWithChildren) {
  const [authState, setAuthState] = useState<AuthState>('uninit');
  const [authenticator, setAuthenticator] = useState<MultiUserType | null>(null);
  const [adapter, setAdapter] = useState<PlanTransportAdapter | null>(null);
  const [settingsPlan, setSettingsPlan] = useState<SettingsPlan | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [personId, setPersonId] = useState<SHA256IdHash<Person> | null>(null);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Initialize settings FIRST (before auth, doesn't need login)
   */
  useEffect(() => {
    const initSettings = async () => {
      console.log('[OneProvider] Initializing settings...');

      try {
        const storage = new ExpoSettingsStorage();
        const plan = new SettingsPlan(storage);
        await plan.init();

        setSettingsPlan(plan);

        // Load settings
        const result = await plan.getAllSettings({});
        setSettings(result.settings);

        // Subscribe to changes
        plan.addEventListener((event) => {
          if (event.type === 'changed') {
            plan.getAllSettings({}).then((updated) => {
              setSettings(updated.settings);
            });
          }
        });

        console.log('[OneProvider] ✅ Settings initialized');
      } catch (err) {
        console.error('[OneProvider] Settings initialization failed:', err);
        // Non-fatal - continue with defaults
      }
    };

    initSettings();
  }, []);

  /**
   * Initialize ONE.core storage and plans after successful login
   */
  const initializeAfterLogin = useCallback(async (auth: MultiUserType, instanceName: string, secret: string) => {
    console.log('[OneProvider] Initializing ONE.core after login...');

    try {
      // Get instance owner person ID
      const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance');
      const ownerPersonId = getInstanceOwnerIdHash();

      if (!ownerPersonId) {
        throw new Error('Failed to get instance owner person ID');
      }

      setPersonId(ownerPersonId);
      console.log('[OneProvider] Person ID:', ownerPersonId.toString().substring(0, 12) + '...');

      // Initialize storage
      const { initStorage } = await import('@refinio/one.core/lib/system/storage-base');
      const { getInstanceIdHash } = await import('@refinio/one.core/lib/instance');

      const instanceIdHash = getInstanceIdHash();
      if (!instanceIdHash) {
        throw new Error('Failed to get instance ID hash');
      }

      await initStorage({
        instanceIdHash,
        name: ONE_CONFIG.name,
        encryptStorage: false,
        secretForStorageKey: secret || null,
      });

      console.log('[OneProvider] ✅ Storage initialized');

      // Initialize ObjectEventDispatcher
      const { objectEvents } = await import('@refinio/one.models/lib/misc/ObjectEventDispatcher');
      await objectEvents.init();
      console.log('[OneProvider] ✅ ObjectEvents initialized');

      // Initialize PlanTransportAdapter with ONE.core
      const newAdapter = new PlanTransportAdapter();
      await newAdapter.initialize();
      setAdapter(newAdapter);

      console.log('[OneProvider] ✅ Plans initialized and ready');
    } catch (err) {
      console.error('[OneProvider] Failed to initialize after login:', err);
      setError(err as Error);
      // Trigger logout on failure
      if (authenticator) {
        await authenticator.logout();
      }
    }
  }, [authenticator, adapter]);

  /**
   * Cleanup after logout
   */
  const cleanupAfterLogout = useCallback(async () => {
    console.log('[OneProvider] Cleaning up after logout...');

    try {
      // Shutdown adapter
      if (adapter && adapter.shutdown) {
        await adapter.shutdown();
      }
      setAdapter(null);

      // Close storage
      const { closeStorage } = await import('@refinio/one.core/lib/system/storage-base');
      closeStorage();

      // Clear state
      setPersonId(null);
      setAuthState('logged_out');

      console.log('[OneProvider] ✅ Cleanup complete');
    } catch (err) {
      console.error('[OneProvider] Cleanup error:', err);
    }
  }, [adapter]);

  /**
   * Initialize MultiUser authenticator (pre-login)
   */
  useEffect(() => {
    if (authState !== 'uninit') return;

    const initAuth = async () => {
      console.log('[OneProvider] Initializing MultiUser authenticator...');
      setAuthState('initializing');

      try {
        // Dynamic imports
        const MultiUser = (await import('@refinio/one.models/lib/models/Authenticator/MultiUser')).default;
        const RecipesStable = (await import('@refinio/one.models/lib/recipes/recipes-stable')).default;
        const RecipesExperimental = (await import('@refinio/one.models/lib/recipes/recipes-experimental')).default;

        // Create authenticator with minimal setup
        const auth = new MultiUser({
          directory: ONE_CONFIG.directory,
          recipes: [
            ...RecipesStable,
            ...RecipesExperimental,
            // TODO: Add custom recipes from lama.app
          ],
          reverseMaps: new Map([
            ['Someone', new Set(['personId', 'mainProfile', 'identities'])],
            ['Profile', new Set(['personId', 'owner'])]
          ]),
        });

        // Attach auth state listeners
        if (auth.authState?.onStateChange) {
          auth.authState.onStateChange.listen((oldState: string, newState: string) => {
            console.log(`[OneProvider] Auth state: ${oldState} → ${newState}`);

            if (newState === 'logged_in') {
              setAuthState('logged_in');
            } else if (newState === 'logged_out') {
              setAuthState('logged_out');
            }
          });
        }

        // Attach login handler
        auth.onLogin.listen(async (instanceName: string, secret: string) => {
          console.log('[OneProvider] Login handler triggered');
          await initializeAfterLogin(auth, instanceName, secret);
        });

        // Attach logout handler
        auth.onLogout(async () => {
          console.log('[OneProvider] Logout handler triggered');
          await cleanupAfterLogout();
        });

        setAuthenticator(auth);
        setAuthState('ready');
        console.log('[OneProvider] ✅ Authenticator ready');
      } catch (err) {
        console.error('[OneProvider] Failed to initialize authenticator:', err);
        setError(err as Error);
      }
    };

    initAuth();
  }, [authState, initializeAfterLogin, cleanupAfterLogout]);

  /**
   * Login function
   */
  const login = useCallback(async (email: string, secret: string, instanceName: string) => {
    if (!authenticator) {
      throw new Error('Authenticator not initialized');
    }

    console.log('[OneProvider] Logging in...');
    setAuthState('logging_in');
    setError(null);

    try {
      await authenticator.loginOrRegister(email, secret, instanceName);
      // State will be updated by auth state listener
    } catch (err) {
      console.error('[OneProvider] Login failed:', err);
      setError(err as Error);
      setAuthState('ready');
      throw err;
    }
  }, [authenticator]);

  /**
   * Logout function
   */
  const logout = useCallback(async () => {
    if (!authenticator) {
      throw new Error('Authenticator not initialized');
    }

    console.log('[OneProvider] Logging out...');
    setAuthState('logging_out');
    setError(null);

    try {
      await authenticator.logout();
      // State will be updated by auth state listener
    } catch (err) {
      console.error('[OneProvider] Logout failed:', err);
      setError(err as Error);
      throw err;
    }
  }, [authenticator]);

  const isAuthenticated = authState === 'logged_in' && adapter !== null;

  const contextValue: OneContextValue = {
    authState,
    authenticator,
    adapter,
    settingsPlan,
    settings,
    login,
    logout,
    isAuthenticated,
    personId,
  };

  // Render loading state
  if (authState === 'uninit' || authState === 'initializing') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Initializing LAMA...</Text>
      </View>
    );
  }

  // Render error state
  if (error && authState !== 'logging_in') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Initialization Error</Text>
        <Text style={styles.errorDetails}>{error.message}</Text>
      </View>
    );
  }

  // Render children with context
  return (
    <OneContext.Provider value={contextValue}>
      {children}
    </OneContext.Provider>
  );
}

/**
 * Hook to access ONE context
 */
export function useOneContext(): OneContextValue {
  const context = useContext(OneContext);
  if (!context) {
    throw new Error('useOneContext must be used within OneProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 8,
  },
  errorDetails: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
