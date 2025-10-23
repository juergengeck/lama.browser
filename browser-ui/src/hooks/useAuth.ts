/**
 * Authentication hook for LAMA Browser
 *
 * Uses Model.one (SingleUserNoAuth) for authentication.
 * Follows one.leute pattern - direct model access, no IPC.
 */

import { useState, useEffect } from 'react';
import { useModel } from '@model/index.js';

interface UseAuthReturn {
  isInitialized: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (instanceName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: Error | null;
}

/**
 * Hook for authentication state and operations
 *
 * @example
 * ```tsx
 * function LoginScreen() {
 *   const { isAuthenticated, login, logout, error } = useAuth();
 *
 *   const handleLogin = async () => {
 *     await login('my-instance', 'password');
 *   };
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
  const model = useModel();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // SingleUserNoAuth doesn't have isAuthenticated() method
    // Authentication state is tracked via onLogin/onLogout callbacks
    setIsInitialized(true);
    setIsLoading(false);

    // Listen for login/logout events
    const handleLogin = () => {
      console.log('[useAuth] Login event received');
      setIsAuthenticated(true);
      setError(null);
    };

    const handleLogout = () => {
      console.log('[useAuth] Logout event received');
      setIsAuthenticated(false);
    };

    model.one.onLogin(handleLogin);
    model.one.onLogout(handleLogout);

    // Cleanup listeners on unmount
    return () => {
      // Note: SingleUserNoAuth doesn't have removeListener methods
      // The listeners will be cleaned up when the model shuts down
    };
  }, [model]);

  const login = async (instanceName: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[useAuth] Logging in...');
      await model.one.login(instanceName, password);
      // isAuthenticated will be set by the onLogin event handler
      setIsLoading(false);
    } catch (e) {
      console.error('[useAuth] Login failed:', e);
      setError(e instanceof Error ? e : new Error(String(e)));
      setIsLoading(false);
      throw e;
    }
  };

  const logout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[useAuth] Logging out...');
      await model.one.logout();
      // isAuthenticated will be set by the onLogout event handler
      setIsLoading(false);
    } catch (e) {
      console.error('[useAuth] Logout failed:', e);
      setError(e instanceof Error ? e : new Error(String(e)));
      setIsLoading(false);
      throw e;
    }
  };

  return {
    isInitialized,
    isAuthenticated,
    isLoading,
    login,
    logout,
    error
  };
}
