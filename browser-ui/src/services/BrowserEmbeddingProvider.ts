/**
 * Browser Embedding Provider using transformers.js
 *
 * Loads the nomic-embed-text-v1.5 model locally in the browser
 * for generating embeddings without requiring Ollama.
 */

import type { EmbeddingProvider } from '@refinio/meaning.core';

// Standard embedding model - 768 dimensions
const MODEL_ID = 'nomic-ai/nomic-embed-text-v1.5';

export type BrowserEmbeddingStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface BrowserEmbeddingState {
  status: BrowserEmbeddingStatus;
  progress: number; // 0-100
  error: string | null;
}

/**
 * Browser-local embedding provider using transformers.js
 *
 * Automatically downloads and caches the nomic-embed-text model.
 * Model files are cached in IndexedDB for subsequent loads.
 */
export class BrowserEmbeddingProvider implements EmbeddingProvider {
  private pipeline: any = null;
  private loadPromise: Promise<void> | null = null;
  private state: BrowserEmbeddingState = {
    status: 'idle',
    progress: 0,
    error: null
  };
  private stateListeners: Set<(state: BrowserEmbeddingState) => void> = new Set();

  /**
   * Subscribe to state changes
   */
  onStateChange(listener: (state: BrowserEmbeddingState) => void): () => void {
    this.stateListeners.add(listener);
    // Immediately call with current state
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  private updateState(partial: Partial<BrowserEmbeddingState>) {
    this.state = { ...this.state, ...partial };
    this.stateListeners.forEach(listener => listener(this.state));
  }

  /**
   * Get current state
   */
  getState(): BrowserEmbeddingState {
    return { ...this.state };
  }

  /**
   * Check if provider is ready to generate embeddings
   */
  isReady(): boolean {
    return this.state.status === 'ready' && this.pipeline !== null;
  }

  /**
   * Load the embedding model in the background
   * Safe to call multiple times - only loads once
   */
  async load(): Promise<void> {
    if (this.state.status === 'ready') return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.doLoad();
    try {
      await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  private async doLoad(): Promise<void> {
    try {
      this.updateState({ status: 'loading', progress: 0, error: null });
      console.log('[BrowserEmbeddingProvider] Loading nomic-embed-text model...');

      // Dynamic import of transformers.js
      const { pipeline, env } = await import('@huggingface/transformers');

      // Configure for browser usage
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      // Create the feature extraction pipeline with progress callback
      this.pipeline = await pipeline('feature-extraction', MODEL_ID, {
        progress_callback: (progress: any) => {
          if (progress.status === 'progress' && progress.progress !== undefined) {
            const percent = Math.round(progress.progress);
            this.updateState({ progress: percent });
            console.log(`[BrowserEmbeddingProvider] Loading: ${percent}%`);
          }
        },
        dtype: 'fp32', // Use full precision for quality
      });

      this.updateState({ status: 'ready', progress: 100 });
      console.log('[BrowserEmbeddingProvider] Model loaded successfully');

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[BrowserEmbeddingProvider] Failed to load model:', message);
      this.updateState({ status: 'error', error: message });
      throw error;
    }
  }

  /**
   * Generate embedding for a single text (768-dim vector)
   */
  async embed(text: string): Promise<number[]> {
    if (!this.isReady()) {
      // Auto-load if not ready
      await this.load();
    }

    if (!this.pipeline) {
      throw new Error('[BrowserEmbeddingProvider] Model not loaded');
    }

    try {
      // nomic-embed-text uses specific prefixes for different tasks
      // For search queries: "search_query: "
      // For documents: "search_document: "
      // We use search_document for general embedding
      const prefixedText = `search_document: ${text}`;

      const output = await this.pipeline(prefixedText, {
        pooling: 'mean',
        normalize: true
      });

      // Convert tensor to array
      const embedding = Array.from(output.data as Float32Array);
      return embedding;

    } catch (error) {
      console.error('[BrowserEmbeddingProvider] Embedding failed:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    // For now, process sequentially to avoid memory issues
    const results: number[][] = [];
    for (const text of texts) {
      const embedding = await this.embed(text);
      results.push(embedding);
    }
    return results;
  }

  /**
   * Unload the model to free memory
   */
  async unload(): Promise<void> {
    if (this.pipeline) {
      // transformers.js pipelines don't have explicit unload
      // Just clear reference and let GC handle it
      this.pipeline = null;
    }
    this.updateState({ status: 'idle', progress: 0, error: null });
    console.log('[BrowserEmbeddingProvider] Model unloaded');
  }
}

// Singleton instance for app-wide use
let globalProvider: BrowserEmbeddingProvider | null = null;

/**
 * Get or create the global browser embedding provider
 */
export function getBrowserEmbeddingProvider(): BrowserEmbeddingProvider {
  if (!globalProvider) {
    globalProvider = new BrowserEmbeddingProvider();
  }
  return globalProvider;
}

/**
 * Start loading the embedding model in the background
 * Call this early in app initialization
 */
export function preloadBrowserEmbeddings(): void {
  const provider = getBrowserEmbeddingProvider();
  provider.load().catch(error => {
    console.warn('[BrowserEmbeddingProvider] Background preload failed:', error);
  });
}
