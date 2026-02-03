/**
 * Hook to track browser embedding model loading status
 */

import { useState, useEffect } from 'react';
import { getBrowserEmbeddingProvider, type BrowserEmbeddingState } from '../services/BrowserEmbeddingProvider';

export interface EmbeddingStatusForUI {
  loading: boolean;
  progress: number;
  error: string | null;
}

/**
 * Hook to subscribe to embedding model loading status
 * Returns status suitable for StatusBar component
 */
export function useEmbeddingStatus(): EmbeddingStatusForUI {
  const [state, setState] = useState<BrowserEmbeddingState>(() =>
    getBrowserEmbeddingProvider().getState()
  );

  useEffect(() => {
    const provider = getBrowserEmbeddingProvider();

    // Subscribe to state changes
    const unsubscribe = provider.onStateChange((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, []);

  return {
    loading: state.status === 'loading',
    progress: state.progress,
    error: state.error
  };
}
