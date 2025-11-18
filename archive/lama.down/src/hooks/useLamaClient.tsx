/**
 * useLamaClient - React hook for accessing LAMA operations
 *
 * Provides type-safe access to all plan operations through the transport layer.
 */

import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import type { TransportAdapter } from '../transport/TransportAdapter';

/**
 * Transport context
 */
const TransportContext = createContext<TransportAdapter | null>(null);

/**
 * Transport provider component
 *
 * @example
 * ```typescript
 * const adapter = new MockTransportAdapter();
 *
 * <TransportProvider adapter={adapter}>
 *   <App />
 * </TransportProvider>
 * ```
 */
export function TransportProvider({
  adapter,
  children
}: {
  adapter: TransportAdapter;
  children: ReactNode;
}) {
  return (
    <TransportContext.Provider value={adapter}>
      {children}
    </TransportContext.Provider>
  );
}

/**
 * Chat client interface
 */
interface ChatClient {
  sendMessage: (request: {
    topicId: string;
    content: string;
    attachments?: string[];
  }) => Promise<{
    messageId: string;
    timestamp: number;
  }>;

  getHistory: (request: {
    topicId: string;
    limit?: number;
    before?: string;
  }) => Promise<{
    messages: Array<{
      messageId: string;
      content: string;
      author: string;
      timestamp: number;
      attachments?: string[];
    }>;
    hasMore: boolean;
    nextCursor?: string;
  }>;

  exportHistory: (request: {
    topicId: string;
    format: 'json' | 'markdown' | 'html';
  }) => Promise<{
    data: string;
    filename: string;
  }>;
}

/**
 * Contacts client interface
 */
interface ContactsClient {
  list: () => Promise<{
    contacts: Array<{
      personIdHash: string;
      nickname: string;
      profileId: string;
    }>;
  }>;

  get: (request: { personIdHash: string }) => Promise<any>;
  create: (request: any) => Promise<any>;
  update: (request: any) => Promise<any>;
  delete: (request: { personIdHash: string }) => Promise<any>;
}

/**
 * Settings client interface
 */
interface SettingsClient {
  getSetting: <K extends string>(request: {
    category: K;
    key: string;
  }) => Promise<{ value: any }>;

  setSetting: <K extends string>(request: {
    category: K;
    key: string;
    value: any;
  }) => Promise<{ success: boolean; error?: string }>;

  getCategory: <K extends string>(request: {
    category: K;
  }) => Promise<{ settings: any }>;

  setCategory: <K extends string>(request: {
    category: K;
    settings: any;
  }) => Promise<{ success: boolean; error?: string }>;

  getAllSettings: () => Promise<{ settings: any }>;
  setAllSettings: (request: { settings: any }) => Promise<{ success: boolean }>;
  resetSettings: (request: { category?: string }) => Promise<{ success: boolean }>;
}

/**
 * Connection client interface
 */
interface ConnectionClient {
  pair: (request: any) => Promise<any>;
  unpair: (request: any) => Promise<any>;
  getConnections: () => Promise<{ connections: any[] }>;
  startDiscovery: () => Promise<any>;
  stopDiscovery: () => Promise<any>;
}

/**
 * LAMA client interface
 */
export interface LamaClient {
  chat: ChatClient;
  contacts: ContactsClient;
  settings: SettingsClient;
  connection: ConnectionClient;

  /**
   * Raw invoke method (for operations not yet wrapped)
   */
  invoke: <TRequest, TResponse>(
    operation: string,
    request: TRequest
  ) => Promise<TResponse>;
}

/**
 * useLamaClient hook
 *
 * Returns a type-safe client for invoking LAMA operations.
 *
 * @throws Error if used outside TransportProvider
 */
export function useLamaClient(): LamaClient {
  const adapter = useContext(TransportContext);

  if (!adapter) {
    throw new Error('useLamaClient must be used within TransportProvider');
  }

  return {
    chat: {
      sendMessage: async (request) => {
        return adapter.invoke('chat:sendMessage', request);
      },

      getHistory: async (request) => {
        return adapter.invoke('chat:getHistory', request);
      },

      exportHistory: async (request) => {
        return adapter.invoke('chat:exportHistory', request);
      }
    },

    contacts: {
      list: async () => {
        return adapter.invoke('contacts:list', {});
      },

      get: async (request) => {
        return adapter.invoke('contacts:get', request);
      },

      create: async (request) => {
        return adapter.invoke('contacts:create', request);
      },

      update: async (request) => {
        return adapter.invoke('contacts:update', request);
      },

      delete: async (request) => {
        return adapter.invoke('contacts:delete', request);
      }
    },

    settings: {
      getSetting: async (request) => {
        return adapter.invoke('settings:getSetting', request);
      },

      setSetting: async (request) => {
        return adapter.invoke('settings:setSetting', request);
      },

      getCategory: async (request) => {
        return adapter.invoke('settings:getCategory', request);
      },

      setCategory: async (request) => {
        return adapter.invoke('settings:setCategory', request);
      },

      getAllSettings: async () => {
        return adapter.invoke('settings:getAllSettings', {});
      },

      setAllSettings: async (request) => {
        return adapter.invoke('settings:setAllSettings', request);
      },

      resetSettings: async (request) => {
        return adapter.invoke('settings:resetSettings', request);
      }
    },

    connection: {
      pair: async (request) => {
        return adapter.invoke('connection:pair', request);
      },

      unpair: async (request) => {
        return adapter.invoke('connection:unpair', request);
      },

      getConnections: async () => {
        return adapter.invoke('connection:getConnections', {});
      },

      startDiscovery: async () => {
        return adapter.invoke('connection:startDiscovery', {});
      },

      stopDiscovery: async () => {
        return adapter.invoke('connection:stopDiscovery', {});
      }
    },

    invoke: async (operation, request) => {
      return adapter.invoke(operation, request);
    }
  };
}

/**
 * Hook for subscribing to events
 */
export function useLamaEvents(
  event: string,
  callback: (data: any) => void
): void {
  const adapter = useContext(TransportContext);

  useEffect(() => {
    if (!adapter || !adapter.subscribe) {
      return;
    }

    const unsubscribe = adapter.subscribe(event, callback);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [adapter, event, callback]);
}
