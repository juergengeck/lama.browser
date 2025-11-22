import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrustModule } from './TrustModule';
import type LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js';

describe('TrustModule', () => {
  it('should have correct metadata', () => {
    expect(TrustModule.demands).toEqual([
      { targetType: 'LeuteModel', required: true }
    ]);
    expect(TrustModule.supplies).toHaveLength(2);
    expect(TrustModule.supplies.map(s => s.targetType)).toEqual([
      'TrustModel',
      'TrustPlan'
    ]);
  });

  it('should initialize with LeuteModel dependency', async () => {
    const module = new TrustModule();

    // Create a mock LeuteModel
    const mockLeuteModel = {
      state: { currentState: 'Initialised' },
      onUpdated: { addListener: vi.fn() }
    } as unknown as LeuteModel;

    module.setDependency('LeuteModel', mockLeuteModel);
    await module.init();

    expect(module.trustModel).toBeDefined();
    expect(module.trustPlan).toBeDefined();
  });

  it('should fail without required dependencies', async () => {
    const module = new TrustModule();

    await expect(module.init()).rejects.toThrow('TrustModule missing required dependencies');
  });

  it('should emit supplies to registry', async () => {
    const module = new TrustModule();

    const mockLeuteModel = {
      state: { currentState: 'Initialised' },
      onUpdated: { addListener: vi.fn() }
    } as unknown as LeuteModel;

    module.setDependency('LeuteModel', mockLeuteModel);
    await module.init();

    const supplies: any[] = [];
    const registry = {
      supply: (supply: any) => {
        supplies.push(supply);
      }
    };

    module.emitSupplies(registry);

    expect(supplies).toHaveLength(2);
    expect(supplies[0].targetType).toBe('TrustModel');
    expect(supplies[0].instance).toBe(module.trustModel);
    expect(supplies[1].targetType).toBe('TrustPlan');
    expect(supplies[1].instance).toBe(module.trustPlan);
  });
});
