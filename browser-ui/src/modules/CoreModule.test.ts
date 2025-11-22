import { describe, it, expect, beforeEach } from 'vitest';
import { CoreModule } from './CoreModule';

describe('CoreModule', () => {
  it('should have correct metadata', () => {
    expect(CoreModule.demands).toEqual([]);
    expect(CoreModule.supplies).toHaveLength(5);
    expect(CoreModule.supplies.map(s => s.targetType)).toEqual([
      'LeuteModel',
      'ChannelManager',
      'TopicModel',
      'ConnectionsModel',
      'Settings'
    ]);
  });

  it('should initialize and provide ONE.core models', async () => {
    const module = new CoreModule('http://localhost:8000');
    await module.init();

    expect(module.leuteModel).toBeDefined();
    expect(module.channelManager).toBeDefined();
    expect(module.topicModel).toBeDefined();
    expect(module.connections).toBeDefined();
    expect(module.settings).toBeDefined();
  });

  it('should emit supplies to registry', async () => {
    const module = new CoreModule('http://localhost:8000');
    await module.init();

    const registry = {
      supply: (supply: any) => {
        expect(supply.targetType).toBeDefined();
        expect(supply.instance).toBeDefined();
      }
    };

    module.emitSupplies(registry);
  });
});
