/**
 * Legacy compatibility hook - useInstance
 *
 * This hook provides backwards compatibility with the legacy lama app's
 * useInstance() API while using the new plan-based architecture under the hood.
 */

import { useLamaClient } from './useLamaClient';
import { useEffect, useState } from 'react';

/**
 * Legacy instance interface
 * Provides compatibility with old app's useInstance() API
 */
export function useInstance() {
  const client = useLamaClient();
  const [models, setModels] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [authState, setAuthState] = useState('authenticated');

  useEffect(() => {
    // Create mock models that delegate to plan-based client
    setModels({
      topicModel: {
        // Delegate to chat plans
        sendMessage: async (topicId: string, content: string) => {
          return client.chat.sendMessage({ topicId, content });
        },
        getHistory: async (topicId: string, limit?: number) => {
          return client.chat.getHistory({ topicId, limit });
        }
      },
      channelManager: {
        // Mock channel manager
        // TODO: Implement when connection.core is integrated
      },
      leuteModel: {
        // Delegate to contacts plans
        getContacts: async () => {
          return client.contacts.list();
        }
      }
    });
  }, [client]);

  return {
    instance: {
      currentState: 'running'
    },
    models,
    isAuthenticated,
    authState
  };
}

/**
 * App model provider compatibility
 * For components that expect models prop
 */
export function useAppModel() {
  const { models } = useInstance();
  return { model: models };
}
