/**
 * Authentication hook for LAMA Browser
 *
 * Uses Model.one (MultiUser) for authentication.
 * Follows one.leute pattern - direct model access, no IPC.
 * Supports automatic user creation via loginOrRegister().
 */

import { useState, useEffect } from 'react';
import { useModel } from '@model/index.js';

interface UseAuthReturn {
  isInitialized: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: Error | null;
}

/**
 * Hook for authentication state and operations
 *
 * Automatically creates users if they don't exist when logging in.
 *
 * @example
 * ```tsx
 * function LoginScreen() {
 *   const { isAuthenticated, login, logout, error } = useAuth();
 *
 *   const handleLogin = async () => {
 *     await login('user@example.com', 'password');
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
    // Check authentication state on mount
    const checkAuthState = async () => {
      try {
        const isRegistered = await model.one.isRegistered();
        console.log('[useAuth] Initial auth check:', isRegistered);
        setIsAuthenticated(isRegistered);
      } catch (e) {
        console.error('[useAuth] Failed to check auth state:', e);
        setIsAuthenticated(false);
      } finally {
        setIsInitialized(true);
        setIsLoading(false);
      }
    };

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

    checkAuthState();

    // Cleanup listeners on unmount
    return () => {
      // Note: SingleUserNoAuth doesn't have removeListener methods
      // The listeners will be cleaned up when the model shuts down
    };
  }, [model]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[useAuth] Logging in or registering user...');
      // Use loginOrRegister for automatic user creation
      // instanceName defaults to email if not provided
      await model.one.loginOrRegister(email, password, email);
      // isAuthenticated will be set by the onLogin event handler
      setIsLoading(false);
    } catch (e) {
      console.error('[useAuth] Login/register failed:', e);
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
