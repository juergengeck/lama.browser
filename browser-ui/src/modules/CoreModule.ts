import LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js';
import ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js';
import TopicModel from '@refinio/one.models/lib/models/Chat/TopicModel.js';
import ConnectionsModel from '@refinio/one.models/lib/models/ConnectionsModel.js';
import PropertyTreeStore from '@refinio/one.models/lib/models/SettingsModel.js';
import type { Module } from '@refinio/api';

/**
 * CoreModule - ONE.core foundation models
 *
 * Root module with NO dependencies. Provides:
 * - LeuteModel (people/contacts/profiles)
 * - ChannelManager (channel operations)
 * - TopicModel (chat/messaging)
 * - ConnectionsModel (P2P connections)
 * - Settings (encrypted storage)
 */
export class CoreModule implements Module {
  readonly name = 'CoreModule';

  // No dependencies - this is the root module
  static demands = [];

  static supplies = [
    { targetType: 'LeuteModel' },
    { targetType: 'ChannelManager' },
    { targetType: 'TopicModel' },
    { targetType: 'ConnectionsModel' },
    { targetType: 'Settings' }
  ];

  public leuteModel!: LeuteModel;
  public channelManager!: ChannelManager;
  public topicModel!: TopicModel;
  public connections!: ConnectionsModel;
  public settings!: PropertyTreeStore;

  constructor(private commServerUrl: string) {}

  async init(): Promise<void> {
    try {
      // Initialize ONE.core models
      this.leuteModel = new LeuteModel(this.commServerUrl, false);
      this.channelManager = new ChannelManager(this.leuteModel);
      this.topicModel = new TopicModel(this.channelManager, this.leuteModel);

      // Initialize ConnectionsModel with minimal config
      this.connections = new ConnectionsModel(this.leuteModel, {});

      // Settings model for encrypted storage
      this.settings = new PropertyTreeStore('lama.browser.settings');

      console.log('[CoreModule] Initialized');
    } catch (error) {
      console.error('[CoreModule] Initialization failed:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    try {
      // Shutdown in reverse order
      if (this.connections) await this.connections.shutdown?.();
      if (this.topicModel) await this.topicModel.shutdown?.();
      if (this.channelManager) await this.channelManager.shutdown?.();
      if (this.leuteModel) await this.leuteModel.shutdown?.();
      if (this.settings) await this.settings.shutdown?.();

      console.log('[CoreModule] Shutdown complete');
    } catch (error) {
      console.error('[CoreModule] Shutdown failed:', error);
      throw error;
    }
  }

  setDependency(_targetType: string, _instance: any): void {
    // CoreModule has no dependencies
  }

  emitSupplies(registry: any): void {
    registry.supply({ targetType: 'LeuteModel', instance: this.leuteModel });
    registry.supply({ targetType: 'ChannelManager', instance: this.channelManager });
    registry.supply({ targetType: 'TopicModel', instance: this.topicModel });
    registry.supply({ targetType: 'ConnectionsModel', instance: this.connections });
    registry.supply({ targetType: 'Settings', instance: this.settings });
  }
}
