// packages/lama.browser/browser-ui/src/modules/MemoryModule.ts
import type { Module } from '@refinio/api';
import type ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js';
import type TopicModel from '@refinio/one.models/lib/models/Chat/TopicModel.js';
import type TopicAnalysisModel from '@lama/core/one-ai/models/TopicAnalysisModel';
import type { SubjectsPlan } from '@lama/core/plans/SubjectsPlan';

// ONE.core storage imports
import { storeVersionedObject, getObjectByIdHash } from '@refinio/one.core/lib/storage-versioned-objects.js';

// Memory.core imports
import { MemoryPlan, ChatMemoryPlan, ChatMemoryService } from '@memory/core';

/**
 * MemoryModule - Memory management functionality
 *
 * Provides:
 * - MemoryPlan for global memory operations
 * - ChatMemoryPlan for chat-scoped memory
 * - ChatMemoryService for extraction and association
 */
export class MemoryModule implements Module {
  readonly name = 'MemoryModule';

  static demands = [
    { targetType: 'ChannelManager', required: true },
    { targetType: 'TopicModel', required: true },
    { targetType: 'TopicAnalysisModel', required: true },
    { targetType: 'SubjectsPlan', required: true },
    { targetType: 'OneCore', required: true }
  ];

  static supplies = [
    { targetType: 'MemoryPlan' },
    { targetType: 'ChatMemoryPlan' },
    { targetType: 'ChatMemoryService' }
  ];

  private deps: {
    channelManager?: ChannelManager;
    topicModel?: TopicModel;
    topicAnalysisModel?: TopicAnalysisModel;
    subjectsPlan?: SubjectsPlan;
    oneCore?: any;
  } = {};

  // Memory plans and services
  public memoryPlan!: MemoryPlan;
  public chatMemoryPlan!: ChatMemoryPlan;
  public chatMemoryService!: ChatMemoryService;

  async init(): Promise<void> {
    if (!this.hasRequiredDeps()) {
      throw new Error('MemoryModule missing required dependencies');
    }

    console.log('[MemoryModule] Initializing memory module...');

    const { channelManager, topicModel, topicAnalysisModel, subjectsPlan, oneCore } = this.deps;

    // Create ChatMemoryService with all dependencies
    this.chatMemoryService = new ChatMemoryService({
      nodeOneCore: oneCore,
      topicAnalyzer: topicAnalysisModel,
      memoryPlan: undefined, // Will be set after MemoryPlan is created
      storeVersionedObject,
      getObjectByIdHash
    });

    // Create MemoryPlan with SubjectsPlan and TopicAnalysisModel
    this.memoryPlan = new MemoryPlan(
      subjectsPlan,
      topicAnalysisModel,
      channelManager
    );

    // Wire up ChatMemoryService with MemoryPlan
    (this.chatMemoryService as any).deps.memoryPlan = this.memoryPlan;

    // Create ChatMemoryPlan with ChatMemoryService
    this.chatMemoryPlan = new ChatMemoryPlan({
      chatMemoryService: this.chatMemoryService
    });

    // Build memory index for fast keyword lookups
    console.log('[MemoryModule] Building memory index...');
    await this.memoryPlan.buildIndex();
    console.log('[MemoryModule] Memory index built');

    console.log('[MemoryModule] Initialized');
  }

  async shutdown(): Promise<void> {
    console.log('[MemoryModule] Shutting down...');
    // No cleanup needed - memory plans are stateless
    console.log('[MemoryModule] Shutdown complete');
  }

  setDependency(targetType: string, instance: any): void {
    const key = targetType.charAt(0).toLowerCase() + targetType.slice(1);
    this.deps[key as keyof typeof this.deps] = instance;
  }

  emitSupplies(registry: any): void {
    registry.supply({ targetType: 'MemoryPlan', instance: this.memoryPlan });
    registry.supply({ targetType: 'ChatMemoryPlan', instance: this.chatMemoryPlan });
    registry.supply({ targetType: 'ChatMemoryService', instance: this.chatMemoryService });
  }

  private hasRequiredDeps(): boolean {
    return !!(
      this.deps.channelManager &&
      this.deps.topicModel &&
      this.deps.topicAnalysisModel &&
      this.deps.subjectsPlan &&
      this.deps.oneCore
    );
  }
}
