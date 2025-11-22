// packages/lama.browser/browser-ui/src/modules/AIModule.test.ts
import { describe, it, expect } from 'vitest';
import { AIModule } from './AIModule';

describe('AIModule', () => {
  it('should have correct metadata', () => {
    expect(AIModule.demands.map(d => d.targetType)).toContain('LeuteModel');
    expect(AIModule.demands.map(d => d.targetType)).toContain('ChannelManager');
    expect(AIModule.supplies.map(s => s.targetType)).toContain('AIPlan');
  });
});
