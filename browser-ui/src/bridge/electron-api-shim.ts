/**
 * Browser ElectronAPI Shim
 *
 * Provides window.electronAPI interface for the pure browser platform.
 * Routes IPC-style calls to Model Plans directly.
 *
 * This allows services written for lama.cube (Electron) to work in lama.browser
 * without modification, enabling shared UI code across platforms.
 */

import { getModel } from '@/model/Model.js';

type Listener = (...args: any[]) => void;

/**
 * Map of IPC channel handlers that route to Model Plans
 */
const channelHandlers: Record<string, (model: any, ...args: any[]) => Promise<any>> = {
  // Word Cloud Settings
  'wordCloudSettings:getSettings': async (model) => {
    return await model.wordCloudSettingsPlan.getWordCloudSettings({});
  },
  'wordCloudSettings:updateSettings': async (model, updates) => {
    return await model.wordCloudSettingsPlan.updateWordCloudSettings({ updates });
  },
  'wordCloudSettings:resetSettings': async (model) => {
    return await model.wordCloudSettingsPlan.resetWordCloudSettings({});
  },

  // Topic Analysis
  'topicAnalysis:analyzeMessages': async (model, request) => {
    return await model.topicAnalysisPlan.analyzeMessages(request);
  },
  'topicAnalysis:getSubjects': async (model, request) => {
    return await model.topicAnalysisPlan.getSubjects(request);
  },
  'topicAnalysis:getSummary': async (model, request) => {
    return await model.topicAnalysisPlan.getSummary(request);
  },
  'topicAnalysis:updateSummary': async (model, request) => {
    return await model.topicAnalysisPlan.updateSummary(request);
  },
  'topicAnalysis:extractKeywords': async (model, request) => {
    return await model.topicAnalysisPlan.extractKeywords(request);
  },
  'topicAnalysis:mergeSubjects': async (model, request) => {
    return await model.topicAnalysisPlan.mergeSubjects(request);
  },

  // Subjects - Route to SubjectsPlan
  'subjects:create': async (_model, _request) => {
    // SubjectsPlan doesn't have create - subjects are auto-created during topic analysis
    console.warn('[electron-api-shim] subjects:create - subjects are auto-created by topic analysis');
    return { success: false, error: 'Subjects are auto-created by topic analysis' };
  },
  'subjects:attach': async (_model, _request) => {
    // SubjectsPlan doesn't support attach - subjects are linked during topic analysis
    console.warn('[electron-api-shim] subjects:attach - not supported in SubjectsPlan');
    return { success: false, error: 'Subject attachment handled by topic analysis' };
  },
  'subjects:getForContent': async (model, request) => {
    // Get subjects via topicAnalysis.getSubjects
    if (model.topicAnalysisPlan) {
      return await model.topicAnalysisPlan.getSubjects({ topicId: request.topicId || request.contentId });
    }
    return { success: false, error: 'TopicAnalysisPlan not available' };
  },
  'subjects:getAll': async (model) => {
    // Use SubjectsPlan if available
    if (model.subjectsPlan) {
      return await model.subjectsPlan.getAllSubjects();
    }
    return { success: false, error: 'SubjectsPlan not available' };
  },
  'subjects:search': async (model, request) => {
    // Get all subjects and filter by search term
    if (model.subjectsPlan) {
      const result = await model.subjectsPlan.getAllSubjects();
      if (result.success && result.subjects) {
        const searchTerm = request.query?.toLowerCase() || '';
        const filtered = result.subjects.filter((s: any) =>
          s.name?.toLowerCase().includes(searchTerm) ||
          s.keywords?.some((k: any) => k.toLowerCase().includes(searchTerm))
        );
        return { success: true, subjects: filtered };
      }
      return result;
    }
    return { success: false, error: 'SubjectsPlan not available' };
  },
  'subjects:getResonance': async (_model, _request) => {
    // Resonance scoring not implemented in SubjectsPlan yet
    console.warn('[electron-api-shim] subjects:getResonance - not yet implemented');
    return { success: false, error: 'Resonance scoring not yet implemented' };
  },
  'subjects:extract': async (model, request) => {
    // Route to topic analysis for extraction
    if (model.topicAnalysisPlan) {
      return await model.topicAnalysisPlan.extractKeywords(request);
    }
    return { success: false, error: 'TopicAnalysisPlan not available' };
  },

  // LLM Config
  'llmConfig:getAll': async (model) => {
    return await model.llmConfigPlan.getAllConfigs({});
  },
  'llmConfig:setConfig': async (model, config) => {
    return await model.llmConfigPlan.setConfig(config);
  },
  'llmConfig:getConfig': async (model, request) => {
    return await model.llmConfigPlan.getConfig(request || {});
  },
  'llmConfig:getAvailableModels': async (model) => {
    return await model.llmConfigPlan.getAvailableModels({});
  },

  // Chat
  'chat:sendMessage': async (model, request) => {
    return await model.chatPlan.sendMessage(request);
  },
  'chat:getMessages': async (model, request) => {
    return await model.chatPlan.getMessages(request);
  },
  'chat:getConversations': async (model, request) => {
    return await model.chatPlan.getConversations(request || {});
  },

  // Contacts
  'contacts:list': async (model) => {
    return await model.contactsPlan.getContacts();
  },
  'contacts:get': async (model, request) => {
    return await model.contactsPlan.getContact(request);
  },

  // Export
  'export:htmlWithMicrodata': async (model, request) => {
    return await model.exportPlan.exportHtmlWithMicrodata(request);
  },

  // Proposals
  'proposals:getForTopic': async (model, request) => {
    return await model.proposalsPlan.getForTopic(request);
  },
  'proposals:updateConfig': async (model, request) => {
    return await model.proposalsPlan.updateConfig(request);
  },
  'proposals:getConfig': async (model) => {
    return await model.proposalsPlan.getConfig({});
  },

  // Memory
  'memory:getStatus': async (model, request) => {
    return await model.memoryPlan.getStatus(request);
  },
  'memory:toggle': async (model, request) => {
    return await model.memoryPlan.toggle(request);
  },
  'memory:extract': async (model, request) => {
    return await model.memoryPlan.extract(request);
  },
  'memory:find': async (model, request) => {
    return await model.memoryPlan.find(request);
  },

  // Connection
  'connection:generatePairingCode': async (model, request) => {
    return await model.connectionPlan.generatePairingCode(request);
  },
  'connection:enterPairingCode': async (model, request) => {
    return await model.connectionPlan.enterPairingCode(request);
  },
  'connection:getConnections': async (model) => {
    return await model.connectionPlan.getConnections({});
  },

  // Audit
  'audit:log': async (model, request) => {
    return await model.auditPlan.log(request);
  },
  'audit:getEntries': async (model, request) => {
    return await model.auditPlan.getEntries(request || {});
  },

  // Browser-native storage (substitutes Electron's secure storage)
  'onecore:secureStore': async (_model, request) => {
    try {
      const { key, value } = request;
      if (value === null || value === undefined) {
        localStorage.removeItem(`lama:${key}`);
      } else {
        localStorage.setItem(`lama:${key}`, typeof value === 'string' ? value : JSON.stringify(value));
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Storage error' };
    }
  },
  'onecore:secureRetrieve': async (_model, request) => {
    try {
      const { key } = request;
      const value = localStorage.getItem(`lama:${key}`);
      return { success: true, value };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Retrieval error' };
    }
  },
  'onecore:clearStorage': async (_model) => {
    try {
      // Only clear lama: prefixed keys
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('lama:')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Clear error' };
    }
  },
  'onecore:setPersonName': async (model, request) => {
    // Update person name via leute model if available
    if (model.leuteModel?.me) {
      try {
        // TODO: Implement proper name update via LeuteModel
        console.log('[electron-api-shim] setPersonName:', request.name);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Name update error' };
      }
    }
    return { success: false, error: 'LeuteModel not available' };
  },

  // Data statistics (browser-specific)
  'iom:getDataStats': async (_model) => {
    try {
      // Return basic browser stats
      const stats = {
        objectCount: 0,
        blobCount: 0,
        channelCount: 0,
        storageUsed: 0
      };
      // Estimate storage from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('lama:')) {
          const value = localStorage.getItem(key);
          stats.storageUsed += (value?.length || 0);
        }
      }
      return { success: true, data: stats };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Stats error' };
    }
  },

  // LAMA-specific browser operations (stubs with meaningful responses)
  'lama:updateBrowserStorage': async (_model, _storageInfo) => {
    // Browser updates its own storage directly, no need for IPC
    return { success: true };
  },
  'lama:updateDataStats': async (_model, _stats) => {
    // Stats are computed locally in browser
    return { success: true };
  },
  'lama:getInstances': async (model) => {
    // Return current instance info
    return {
      success: true,
      instances: model ? [{
        name: 'browser',
        platform: 'browser',
        ownerId: model.ownerId || null
      }] : []
    };
  },
  'lama:getReplicationEvents': async (_model) => {
    // Browser doesn't track replication events the same way
    return { success: true, events: [] };
  },
};

// Event listeners for IPC-style events
const eventListeners = new Map<string, Set<Listener>>();

/**
 * Browser implementation of window.electronAPI
 */
const browserElectronAPI = {
  platform: 'browser',
  isElectron: false,

  log: (message: string) => {
    console.log('[browser-api]', message);
  },

  invoke: async (channel: string, ...args: any[]): Promise<any> => {
    const model = getModel();

    if (!model) {
      console.error(`[electron-api-shim] Model not available for channel: ${channel}`);
      return { success: false, error: 'Model not initialized' };
    }

    const handler = channelHandlers[channel];
    if (handler) {
      try {
        return await handler(model, ...args);
      } catch (error) {
        console.error(`[electron-api-shim] Error in channel ${channel}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    console.warn(`[electron-api-shim] Unhandled channel: ${channel}`);
    return { success: false, error: `Channel not implemented: ${channel}` };
  },

  on: (channel: string, callback: Listener): (() => void) => {
    if (!eventListeners.has(channel)) {
      eventListeners.set(channel, new Set());
    }
    eventListeners.get(channel)!.add(callback);

    // Return unsubscribe function
    return () => {
      eventListeners.get(channel)?.delete(callback);
    };
  },

  off: (channel: string, callback: Listener): void => {
    eventListeners.get(channel)?.delete(callback);
  },

  // Browser-specific stubs for Electron-only features
  createUdpSocket: async () => {
    console.warn('[electron-api-shim] createUdpSocket not available in browser');
    return { id: 'browser-stub' };
  },

  clearAppData: async () => {
    console.warn('[electron-api-shim] clearAppData not implemented in browser');
    return { success: false, error: 'Not available in browser' };
  },

  createInvitation: async () => {
    console.warn('[electron-api-shim] createInvitation - routing to connection plan');
    const model = getModel();
    if (model?.connectionPlan) {
      return await model.connectionPlan.generatePairingCode({ displayName: 'Browser User' });
    }
    return { success: false, error: 'Model not initialized' };
  },

  getConnectionsInfo: async () => {
    const model = getModel();
    if (model?.connectionPlan) {
      return await model.connectionPlan.getConnections({});
    }
    return { success: false, error: 'Model not initialized' };
  },

  getConnectionsStatus: async () => {
    const model = getModel();
    if (model?.connectionPlan) {
      return await model.connectionPlan.getConnections({});
    }
    return { success: false, error: 'Model not initialized' };
  },

  getDevices: async () => {
    console.warn('[electron-api-shim] getDevices not implemented');
    return { success: false, devices: [] };
  },

  getConnectedDevices: async () => {
    console.warn('[electron-api-shim] getConnectedDevices not implemented');
    return { success: false, devices: [] };
  },

  registerDevice: async () => {
    console.warn('[electron-api-shim] registerDevice not implemented');
    return { success: false, error: 'Not available in browser' };
  },

  removeDevice: async () => {
    console.warn('[electron-api-shim] removeDevice not implemented');
    return { success: false, error: 'Not available in browser' };
  },

  getInstanceInfo: async () => {
    const model = getModel();
    return {
      success: true,
      platform: 'browser',
      ownerId: model?.ownerId || null,
      initialized: model?.initialized || false
    };
  },
};

/**
 * Emit an event to all listeners (for internal use)
 */
export function emitEvent(channel: string, ...args: any[]): void {
  const listeners = eventListeners.get(channel);
  if (listeners) {
    listeners.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`[electron-api-shim] Error in event listener for ${channel}:`, error);
      }
    });
  }
}

/**
 * Initialize the browser electronAPI shim
 * Call this before any services try to use window.electronAPI
 */
export function initializeElectronAPIShim(): void {
  if (typeof window !== 'undefined') {
    // Only set up if not already present (avoid overwriting real Electron API)
    if (!window.electronAPI) {
      (window as any).electronAPI = browserElectronAPI;
      console.log('[electron-api-shim] Browser electronAPI shim initialized');
    } else {
      console.log('[electron-api-shim] electronAPI already present (Electron environment)');
    }
  }
}

// Auto-initialize when module is imported
initializeElectronAPIShim();
