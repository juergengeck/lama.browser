// packages/lama.browser/browser-ui/src/modules/ConnectionModule.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionModule } from './ConnectionModule';

describe('ConnectionModule', () => {
  let module: ConnectionModule;
  let mockOneCore: any;
  let mockLeuteModel: any;
  let mockChannelManager: any;
  let mockTopicModel: any;
  let mockConnectionsModel: any;
  let mockTrustPlan: any;

  beforeEach(() => {
    // Create mock dependencies
    mockLeuteModel = {
      myMainIdentity: vi.fn().mockResolvedValue('mock-person-id'),
      others: vi.fn().mockResolvedValue([]),
      trust: {
        certify: vi.fn(),
        isAffirmedBy: vi.fn(),
        affirmedBy: vi.fn(),
        refreshCaches: vi.fn()
      }
    };

    mockChannelManager = {
      channels: vi.fn().mockResolvedValue([]),
      createChannel: vi.fn().mockResolvedValue({ id: 'test-channel', owner: 'mock-person-id' }),
      postToChannel: vi.fn()
    };

    mockTopicModel = {};
    mockConnectionsModel = {};
    mockTrustPlan = {};
    mockOneCore = {};

    module = new ConnectionModule(
      mockOneCore,
      'wss://test-comm-server.com',
      'https://test.lama.one'
    );

    // Set dependencies
    module.setDependency('LeuteModel', mockLeuteModel);
    module.setDependency('ChannelManager', mockChannelManager);
    module.setDependency('TopicModel', mockTopicModel);
    module.setDependency('ConnectionsModel', mockConnectionsModel);
    module.setDependency('TrustPlan', mockTrustPlan);
  });

  it('should create module instance', () => {
    expect(module).toBeDefined();
    expect(module.name).toBe('ConnectionModule');
  });

  it('should have correct demands', () => {
    expect(ConnectionModule.demands).toEqual([
      { targetType: 'LeuteModel', required: true },
      { targetType: 'ChannelManager', required: true },
      { targetType: 'TopicModel', required: true },
      { targetType: 'ConnectionsModel', required: true },
      { targetType: 'TrustPlan', required: true }
    ]);
  });

  it('should have correct supplies', () => {
    expect(ConnectionModule.supplies).toEqual([
      { targetType: 'ConnectionPlan' },
      { targetType: 'GroupChatPlan' }
    ]);
  });

  it('should initialize with all dependencies', async () => {
    await module.init();

    expect(module.connectionPlan).toBeDefined();
    expect(module.groupChatPlan).toBeDefined();
  });

  it('should throw error if dependencies are missing', async () => {
    const incompleteModule = new ConnectionModule(
      mockOneCore,
      'wss://test-comm-server.com',
      'https://test.lama.one'
    );

    await expect(incompleteModule.init()).rejects.toThrow(
      'ConnectionModule missing required dependencies'
    );
  });

  it('should emit event when contact is created', async () => {
    await module.init();

    const contactsChangedSpy = vi.fn();
    // OEvent is callable - just call it with a listener
    module.onContactsChanged(contactsChangedSpy);

    // Simulate pairing callback - access the internal callbacks
    const pairingCallbacks = (module.connectionPlan as any).pairingCallbacks;
    if (pairingCallbacks?.onContactCreated) {
      await pairingCallbacks.onContactCreated({ displayName: 'Test Contact' });
    }

    expect(contactsChangedSpy).toHaveBeenCalled();
  });

  it('should emit event when topic is created', async () => {
    await module.init();

    const topicsChangedSpy = vi.fn();
    // OEvent is callable - just call it with a listener
    module.onTopicsChanged(topicsChangedSpy);

    // Simulate pairing callback
    const pairingCallbacks = (module.connectionPlan as any).pairingCallbacks;
    if (pairingCallbacks?.onTopicCreated) {
      await pairingCallbacks.onTopicCreated({ channelId: 'test-channel' });
    }

    expect(topicsChangedSpy).toHaveBeenCalled();
  });

  it('should emit event when pairing is complete', async () => {
    await module.init();

    const connectionsChangedSpy = vi.fn();
    // OEvent is callable - just call it with a listener
    module.onConnectionsChanged(connectionsChangedSpy);

    // Simulate pairing callback
    const pairingCallbacks = (module.connectionPlan as any).pairingCallbacks;
    if (pairingCallbacks?.onPairingComplete) {
      await pairingCallbacks.onPairingComplete({ type: 'outgoing' });
    }

    expect(connectionsChangedSpy).toHaveBeenCalled();
  });

  it('should emit supplies through registry', async () => {
    await module.init();

    const mockRegistry = {
      supply: vi.fn()
    };

    module.emitSupplies(mockRegistry);

    expect(mockRegistry.supply).toHaveBeenCalledWith({
      targetType: 'ConnectionPlan',
      instance: module.connectionPlan
    });

    expect(mockRegistry.supply).toHaveBeenCalledWith({
      targetType: 'GroupChatPlan',
      instance: module.groupChatPlan
    });
  });

  it('should shutdown gracefully', async () => {
    await module.init();

    // Mock shutdown methods
    module.connectionPlan.shutdown = vi.fn();
    module.groupChatPlan.shutdown = vi.fn();

    await module.shutdown();

    expect(module.connectionPlan.shutdown).toHaveBeenCalled();
    expect(module.groupChatPlan.shutdown).toHaveBeenCalled();
  });

  it('should create channel in GroupChatPlan dependencies', async () => {
    await module.init();

    // Test the channelManager adapter used by GroupChatPlan
    const groupChatDeps = (module.groupChatPlan as any).deps;

    // Should create new channel if it doesn't exist
    const channel = await groupChatDeps.channelManager.getOrCreateChannel(
      'test-channel',
      'mock-person-id'
    );

    expect(channel).toBeDefined();
    expect(mockChannelManager.createChannel).toHaveBeenCalledWith('test-channel', 'mock-person-id');
  });

  it('should return existing channel if already exists', async () => {
    await module.init();

    // Mock existing channel
    mockChannelManager.channels.mockResolvedValue([
      { id: 'existing-channel', owner: 'mock-person-id' }
    ]);

    const groupChatDeps = (module.groupChatPlan as any).deps;

    const channel = await groupChatDeps.channelManager.getOrCreateChannel(
      'existing-channel',
      'mock-person-id'
    );

    expect(channel.id).toBe('existing-channel');
    expect(mockChannelManager.createChannel).not.toHaveBeenCalled();
  });
});
