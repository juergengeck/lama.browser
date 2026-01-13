/**
 * BridgeModule - Sets up bridge event forwarding
 *
 * CRITICAL: This module MUST initialize BEFORE ConnectionModule
 * to prevent race condition where CHUM messages arrive before UI is subscribed.
 *
 * Uses demand/supply to ensure proper ordering:
 * - Demands TopicModel (from CoreModule)
 * - Supplies BridgeReady (ConnectionModule demands this)
 */

import type { Module } from '@refinio/api';
import type TopicModel from '@refinio/one.models/lib/models/Chat/TopicModel.js';
import { lamaBridge } from '../bridge/lama-bridge';

export class BridgeModule implements Module {
  readonly name = 'BridgeModule';

  static demands = [
    { targetType: 'TopicModel', required: true }
  ];

  static supplies = [
    { targetType: 'BridgeReady' }
  ];

  private deps: {
    topicModel?: TopicModel;
  } = {};

  async init(): Promise<void> {
    console.log('[BridgeModule] Setting up bridge event forwarding...');

    // Set up bridge forwarding BEFORE ConnectionModule starts CHUM
    lamaBridge.setupChannelUpdateForwarding();
    lamaBridge.setupNewTopicForwarding();

    console.log('[BridgeModule] ✅ Bridge event forwarding ready');
  }

  async shutdown(): Promise<void> {
    console.log('[BridgeModule] Shutdown');
  }

  setDependency(targetType: string, instance: any): void {
    const key = targetType.charAt(0).toLowerCase() + targetType.slice(1);
    this.deps[key as keyof typeof this.deps] = instance;
  }

  emitSupplies(registry: any): void {
    // Signal that bridge is ready - ConnectionModule demands this
    registry.supply('BridgeReady', true);
  }
}
