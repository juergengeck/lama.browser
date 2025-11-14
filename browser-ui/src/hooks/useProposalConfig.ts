/**
 * useProposalConfig Hook
 * React hook for managing proposal configuration
 *
 * Browser platform - uses Model.proposalsPlan directly (no IPC)
 */

import { useState, useEffect, useCallback } from 'react';
import { getModel } from '@/model';
import type { ProposalConfig } from '../types/proposals';

interface UseProposalConfigResult {
  config: ProposalConfig | null;
  loading: boolean;
  error: string | null;
  updateConfig: (updates: Partial<ProposalConfig>) => Promise<void>;
  reload: () => Promise<void>;
}

/**
 * Hook for accessing and updating proposal configuration
 */
export function useProposalConfig(): UseProposalConfigResult {
  const [config, setConfig] = useState<ProposalConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load config from Model
   */
  const loadConfig = useCallback(async () => {
    const model = getModel();
    if (!model.initialized) {
      console.log('[useProposalConfig] Skipping - model not initialized yet');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await model.proposalsPlan.getConfig({});
      setConfig(response.config);
    } catch (err: any) {
      console.error('[useProposalConfig] Failed to load:', err);
      setError(err.message || 'Failed to load proposal configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update proposal configuration
   */
  const updateConfig = useCallback(async (updates: Partial<ProposalConfig>): Promise<void> => {
    const model = getModel();
    if (!model.initialized) {
      throw new Error('Model not initialized');
    }

    if (!config) {
      throw new Error('Config not loaded');
    }

    try {
      const response = await model.proposalsPlan.updateConfig({
        config: {
          ...config,
          ...updates,
        },
      });

      setConfig(response.config);
    } catch (err: any) {
      console.error('[useProposalConfig] Failed to update:', err);
      throw err;
    }
  }, [config]);

  /**
   * Reload config (force refresh)
   */
  const reload = useCallback(async () => {
    await loadConfig();
  }, [loadConfig]);

  // Load config on mount
  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  return {
    config,
    loading,
    error,
    updateConfig,
    reload,
  };
}
