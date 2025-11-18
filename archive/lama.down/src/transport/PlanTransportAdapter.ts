/**
 * PlanTransportAdapter - Real transport using platform-agnostic plans
 *
 * This adapter runs the actual business logic plans directly in React Native
 * using one.core.expo (React Native compatible ONE.core).
 */

import type { TransportAdapter } from './TransportAdapter';
import { SettingsPlan } from '@settings/core';
import { ExpoSettingsStorage } from '@storage/ExpoSettingsStorage';

/**
 * Plan Transport Adapter
 *
 * Uses real platform-agnostic plans from *.core packages.
 * Runs ONE.core directly in React Native via one.core.expo.
 */
export class PlanTransportAdapter implements TransportAdapter {
  private nodeOneCore: any = null;
  private chatPlan: any = null;
  private contactsPlan: any = null;
  private settingsPlan: SettingsPlan | null = null;
  private leuteModel: any = null;
  private channelManager: any = null;
  private eventListeners = new Map<string, Set<(data: any) => void>>();

  async initialize(): Promise<void> {
    console.log('[PlanTransportAdapter] Initializing ONE.core...');

    try {
      // Dynamic imports to avoid bundling issues
      const { ChatPlan } = await import('@chat/core/plans/ChatPlan.js');
      const { ContactsPlan } = await import('@chat/core/plans/ContactsPlan.js');

      // NOTE: ONE.core is already initialized by OneProvider via MultiUser.loginOrRegister
      // We just need to get the instance
      const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance');
      const personId = getInstanceOwnerIdHash();

      if (!personId) {
        throw new Error('ONE.core not initialized - no instance owner found');
      }

      console.log('[PlanTransportAdapter] ONE.core already initialized');

      // Initialize LeuteModel
      console.log('[PlanTransportAdapter] Initializing LeuteModel...');
      const LeuteModel = (await import('@refinio/one.models/lib/models/Leute/LeuteModel')).default;
      this.leuteModel = new LeuteModel(personId);
      await this.leuteModel.init();
      console.log('[PlanTransportAdapter] ✅ LeuteModel initialized');

      // Initialize ChannelManager
      console.log('[PlanTransportAdapter] Initializing ChannelManager...');
      const ChannelManager = (await import('@refinio/one.models/lib/models/ChannelManager/ChannelManager')).default;
      this.channelManager = new ChannelManager(this.leuteModel);
      await this.channelManager.init();
      console.log('[PlanTransportAdapter] ✅ ChannelManager initialized');

      // Create plan instances with dependencies
      this.chatPlan = new ChatPlan(this.leuteModel, this.channelManager);
      this.contactsPlan = new ContactsPlan(this.leuteModel);

      // Initialize settings plan
      const storage = new ExpoSettingsStorage();
      this.settingsPlan = new SettingsPlan(storage);
      await this.settingsPlan.init();

      console.log('[PlanTransportAdapter] ✅ All plans initialized');
    } catch (error) {
      console.error('[PlanTransportAdapter] Initialization failed:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    console.log('[PlanTransportAdapter] Shutting down');
    this.eventListeners.clear();

    if (this.nodeOneCore && this.nodeOneCore.shutdown) {
      await this.nodeOneCore.shutdown();
    }
  }

  /**
   * Invoke a plan operation
   */
  async invoke<TRequest = any, TResponse = any>(
    operation: string,
    request: TRequest
  ): Promise<TResponse> {
    console.log(`[PlanTransportAdapter] Invoking: ${operation}`, request);

    if (!this.nodeOneCore) {
      throw new Error('PlanTransportAdapter not initialized. Call initialize() first.');
    }

    // Route to appropriate plan
    const [domain, method] = operation.split(':');

    try {
      switch (domain) {
        case 'chat':
          return await this.invokeChatPlan(method, request);

        case 'contacts':
          return await this.invokeContactsPlan(method, request);

        case 'settings':
          return await this.invokeSettingsPlan(method, request);

        case 'connection':
          return await this.invokeConnectionPlan(method, request);

        default:
          throw new Error(`Unknown operation domain: ${domain}`);
      }
    } catch (error) {
      console.error(`[PlanTransportAdapter] Operation failed: ${operation}`, error);
      throw error;
    }
  }

  /**
   * Invoke chat plan operations
   */
  private async invokeChatPlan(method: string, request: any): Promise<any> {
    switch (method) {
      case 'sendMessage':
        return await this.chatPlan.sendMessage(request);

      case 'getHistory':
        return await this.chatPlan.getHistory(request);

      case 'exportHistory':
        return await this.chatPlan.exportHistory(request);

      default:
        throw new Error(`Unknown chat operation: ${method}`);
    }
  }

  /**
   * Invoke contacts plan operations
   */
  private async invokeContactsPlan(method: string, request: any): Promise<any> {
    switch (method) {
      case 'list':
        return await this.contactsPlan.list(request);

      case 'get':
        return await this.contactsPlan.get(request);

      case 'create':
        return await this.contactsPlan.create(request);

      case 'update':
        return await this.contactsPlan.update(request);

      case 'delete':
        return await this.contactsPlan.delete(request);

      default:
        throw new Error(`Unknown contacts operation: ${method}`);
    }
  }

  /**
   * Invoke settings plan operations
   */
  private async invokeSettingsPlan(method: string, request: any): Promise<any> {
    if (!this.settingsPlan) {
      throw new Error('Settings plan not initialized');
    }

    switch (method) {
      case 'getSetting':
        return await this.settingsPlan.getSetting(request);

      case 'setSetting':
        return await this.settingsPlan.setSetting(request);

      case 'getCategory':
        return await this.settingsPlan.getCategory(request);

      case 'setCategory':
        return await this.settingsPlan.setCategory(request);

      case 'getAllSettings':
        return await this.settingsPlan.getAllSettings(request);

      case 'setAllSettings':
        return await this.settingsPlan.setAllSettings(request);

      case 'resetSettings':
        return await this.settingsPlan.resetSettings(request);

      default:
        throw new Error(`Unknown settings operation: ${method}`);
    }
  }

  /**
   * Invoke connection plan operations
   */
  private async invokeConnectionPlan(method: string, request: any): Promise<any> {
    // TODO: Implement connection operations (pairing, device discovery, etc.)
    switch (method) {
      case 'pair':
        // Pair with another device/person
        throw new Error('Connection pairing not yet implemented');

      case 'unpair':
        // Unpair from a device/person
        throw new Error('Connection unpairing not yet implemented');

      case 'getConnections':
        // Get list of active connections
        return { connections: [] }; // Placeholder

      case 'startDiscovery':
        // Start device discovery
        throw new Error('Device discovery not yet implemented');

      case 'stopDiscovery':
        // Stop device discovery
        throw new Error('Device discovery not yet implemented');

      default:
        throw new Error(`Unknown connection operation: ${method}`);
    }
  }

  /**
   * Subscribe to events
   */
  subscribe(event: string, callback: (data: any) => void): () => void {
    console.log(`[PlanTransportAdapter] Subscribing to: ${event}`);

    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    // Wire up to ONE.core events if initialized
    if (this.nodeOneCore) {
      this.setupEventListener(event);
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.eventListeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.eventListeners.delete(event);
        }
      }
    };
  }

  /**
   * Set up ONE.core event listener for a specific event type
   */
  private async setupEventListener(event: string): Promise<void> {
    try {
      // Import objectEvents dynamically
      const { objectEvents } = await import('@refinio/one.models/lib/misc/ObjectEventDispatcher');

      // Map event names to ONE.core events
      switch (event) {
        case 'messageCreated':
        case 'messageUpdated':
          // Listen to object storage events for Message types
          objectEvents.onNewVersion.listen((hash: any, obj: any) => {
            if (obj.$type$ === 'Message') {
              this.emit('messageCreated', { hash, message: obj });
            }
          });
          break;

        case 'topicUpdated':
          objectEvents.onNewVersion.listen((hash: any, obj: any) => {
            if (obj.$type$ === 'Topic') {
              this.emit('topicUpdated', { hash, topic: obj });
            }
          });
          break;

        case 'contactAdded':
        case 'contactUpdated':
          objectEvents.onNewVersion.listen((hash: any, obj: any) => {
            if (obj.$type$ === 'Person' || obj.$type$ === 'Profile') {
              this.emit('contactUpdated', { hash, contact: obj });
            }
          });
          break;

        default:
          console.warn(`[PlanTransportAdapter] Unknown event type: ${event}`);
      }
    } catch (error) {
      console.error(`[PlanTransportAdapter] Failed to setup event listener:`, error);
    }
  }

  /**
   * Emit an event to all subscribers
   * (Called internally when ONE.core events fire)
   */
  private emit(event: string, data: any): void {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[PlanTransportAdapter] Event callback error:`, error);
        }
      });
    }
  }
}
