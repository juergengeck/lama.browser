// packages/lama.browser/browser-ui/src/modules/ChatModule.test.ts
import { ChatModule } from './ChatModule';

describe('ChatModule', () => {
  it('should have correct demands', () => {
    expect(ChatModule.demands).toEqual([
      { targetType: 'LeuteModel', required: true },
      { targetType: 'ChannelManager', required: true },
      { targetType: 'TopicModel', required: true },
      { targetType: 'OneCore', required: true }
    ]);
  });

  it('should have correct supplies', () => {
    expect(ChatModule.supplies).toEqual([
      { targetType: 'ChatPlan' },
      { targetType: 'GroupPlan' },
      { targetType: 'ContactsPlan' },
      { targetType: 'ExportPlan' },
      { targetType: 'FeedForwardPlan' },
      { targetType: 'TopicGroupManager' }
    ]);
  });

  it('should throw if init called without dependencies', async () => {
    const module = new ChatModule();
    await expect(module.init()).rejects.toThrow('ChatModule missing required dependencies');
  });
});
