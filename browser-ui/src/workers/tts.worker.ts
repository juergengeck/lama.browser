/**
 * Web Worker for local TTS (Text-to-Speech) generation
 *
 * Uses @huggingface/transformers v4 for browser-based inference.
 * Supports Chatterbox and other TTS models.
 * Runs in a Web Worker to avoid blocking the UI thread.
 *
 * This worker is platform-agnostic and can be used by any browser platform.
 */

console.log('[TTSWorker] Starting initialization...');

let ChatterboxModel: any;
let ChatterboxProcessor: any;
let read_audio: any;
let env: any;
let initError: Error | null = null;

try {
  const transformers = await import('@huggingface/transformers');
  ChatterboxModel = transformers.ChatterboxModel;
  ChatterboxProcessor = transformers.ChatterboxProcessor;
  read_audio = transformers.read_audio;
  env = transformers.env;

  // Configure for browser environment
  env.allowLocalModels = false;
  env.useBrowserCache = true;

  console.log('[TTSWorker] Transformers loaded successfully');
} catch (error) {
  console.error('[TTSWorker] Failed to load transformers:', error);
  initError = error as Error;
}

// TTS Model registry (must match ModelRegistry.ts)
// NOTE: All models use onnx-community repos which have proper ONNX exports
const TTS_MODELS: Record<string, {
  huggingFaceRepo: string;
  sampleRate: number;
  requiresReferenceAudio: boolean;
  defaultVoiceUrl?: string;
}> = {
  'chatterbox': {
    huggingFaceRepo: 'onnx-community/chatterbox-ONNX',
    sampleRate: 24000,
    requiresReferenceAudio: true,
    defaultVoiceUrl: 'https://huggingface.co/onnx-community/chatterbox-ONNX/resolve/main/default_voice.wav'
  },
  // chatterbox-turbo uses the same onnx-community repo until ResembleAI publishes proper ONNX exports
  'chatterbox-turbo': {
    huggingFaceRepo: 'onnx-community/chatterbox-ONNX',
    sampleRate: 24000,
    requiresReferenceAudio: true,
    defaultVoiceUrl: 'https://huggingface.co/onnx-community/chatterbox-ONNX/resolve/main/default_voice.wav'
  },
  'chatterbox-multilingual': {
    huggingFaceRepo: 'onnx-community/chatterbox-multilingual-ONNX',
    sampleRate: 24000,
    requiresReferenceAudio: true,
    defaultVoiceUrl: 'https://huggingface.co/onnx-community/chatterbox-multilingual-ONNX/resolve/main/default_voice.wav'
  }
};

// Worker state
let model: any = null;
let processor: any = null;
let loadedModelId: string | null = null;
let deviceType: 'webgpu' | 'wasm' = 'wasm';
let cachedReferenceAudio: Float32Array | null = null;
let cachedReferenceUrl: string | null = null;

/**
 * Check if WebGPU is available
 */
async function checkWebGPU(): Promise<boolean> {
  if (!navigator.gpu) {
    return false;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

interface WorkerMessage {
  type: 'load' | 'synthesize' | 'unload' | 'status' | 'preload-voice';
  id: string;
  modelId?: string;
  text?: string;
  options?: {
    exaggeration?: number;
    referenceAudioUrl?: string;
    referenceAudioData?: Float32Array;
  };
}

interface WorkerResponse {
  type: 'loaded' | 'audio' | 'unloaded' | 'status' | 'error' | 'progress' | 'voice-loaded';
  id: string;
  data?: any;
  error?: string;
}

/**
 * Send response to main thread
 */
function respond(response: WorkerResponse): void {
  self.postMessage(response);
}

/**
 * Load reference audio from URL or use cached
 */
async function loadReferenceAudio(url: string, sampleRate: number): Promise<Float32Array> {
  if (cachedReferenceUrl === url && cachedReferenceAudio) {
    return cachedReferenceAudio;
  }

  console.log(`[TTSWorker] Loading reference audio: ${url}`);
  const audio = await read_audio(url, sampleRate);
  cachedReferenceAudio = audio;
  cachedReferenceUrl = url;
  return audio;
}

/**
 * Load a TTS model into memory
 */
async function loadModel(id: string, modelId: string): Promise<void> {
  const modelInfo = TTS_MODELS[modelId];
  if (!modelInfo) {
    throw new Error(`Unknown TTS model: ${modelId}. Available: ${Object.keys(TTS_MODELS).join(', ')}`);
  }

  // Unload existing model if different
  if (model && loadedModelId !== modelId) {
    model = null;
    processor = null;
    loadedModelId = null;
    cachedReferenceAudio = null;
    cachedReferenceUrl = null;
  }

  if (model && loadedModelId === modelId) {
    respond({ type: 'loaded', id, data: { modelId, device: deviceType, sampleRate: modelInfo.sampleRate } });
    return;
  }

  // Check for WebGPU support
  const hasWebGPU = await checkWebGPU();
  deviceType = hasWebGPU ? 'webgpu' : 'wasm';

  console.log(`[TTSWorker] Loading model: ${modelId} (device: ${deviceType})`);

  try {
    // Load model and processor in parallel using Chatterbox-specific classes
    // (AutoModel/AutoProcessor don't properly resolve ChatterboxFeatureExtractor in vite bundles)
    const [loadedModel, loadedProcessor] = await Promise.all([
      ChatterboxModel.from_pretrained(modelInfo.huggingFaceRepo, {
        device: deviceType,
        progress_callback: (progress: any) => {
          if (progress.status === 'progress' && typeof progress.progress === 'number') {
            respond({ type: 'progress', id, data: { percent: progress.progress, device: deviceType, stage: 'model' } });
          }
        }
      }),
      ChatterboxProcessor.from_pretrained(modelInfo.huggingFaceRepo)
    ]);

    model = loadedModel;
    processor = loadedProcessor;
  } catch (error) {
    // Fallback to WASM if WebGPU fails
    if (deviceType === 'webgpu') {
      console.warn(`[TTSWorker] WebGPU failed, falling back to WASM:`, error);
      deviceType = 'wasm';

      const [loadedModel, loadedProcessor] = await Promise.all([
        ChatterboxModel.from_pretrained(modelInfo.huggingFaceRepo, {
          device: 'wasm',
          progress_callback: (progress: any) => {
            if (progress.status === 'progress' && typeof progress.progress === 'number') {
              respond({ type: 'progress', id, data: { percent: progress.progress, device: deviceType, stage: 'model' } });
            }
          }
        }),
        ChatterboxProcessor.from_pretrained(modelInfo.huggingFaceRepo)
      ]);

      model = loadedModel;
      processor = loadedProcessor;
    } else {
      throw error;
    }
  }

  // Pre-load default voice if available
  if (modelInfo.defaultVoiceUrl) {
    try {
      await loadReferenceAudio(modelInfo.defaultVoiceUrl, modelInfo.sampleRate);
      console.log(`[TTSWorker] Default voice pre-loaded`);
    } catch (e) {
      console.warn(`[TTSWorker] Failed to pre-load default voice:`, e);
    }
  }

  loadedModelId = modelId;
  console.log(`[TTSWorker] Model loaded: ${modelId} (device: ${deviceType})`);
  respond({ type: 'loaded', id, data: { modelId, device: deviceType, sampleRate: modelInfo.sampleRate } });
}

/**
 * Pre-load a custom voice for faster synthesis
 */
async function preloadVoice(id: string, audioUrl: string): Promise<void> {
  if (!loadedModelId) {
    throw new Error('Model not loaded');
  }

  const modelInfo = TTS_MODELS[loadedModelId];
  await loadReferenceAudio(audioUrl, modelInfo.sampleRate);
  respond({ type: 'voice-loaded', id, data: { url: audioUrl } });
}

/**
 * Synthesize speech from text
 */
async function synthesize(
  id: string,
  text: string,
  options: {
    exaggeration?: number;
    referenceAudioUrl?: string;
    referenceAudioData?: Float32Array;
  } = {}
): Promise<void> {
  if (!model || !processor || !loadedModelId) {
    throw new Error('Model not loaded');
  }

  const modelInfo = TTS_MODELS[loadedModelId];

  // Get reference audio
  let referenceAudio: Float32Array;

  if (options.referenceAudioData) {
    referenceAudio = options.referenceAudioData;
  } else if (options.referenceAudioUrl) {
    referenceAudio = await loadReferenceAudio(options.referenceAudioUrl, modelInfo.sampleRate);
  } else if (modelInfo.defaultVoiceUrl) {
    referenceAudio = await loadReferenceAudio(modelInfo.defaultVoiceUrl, modelInfo.sampleRate);
  } else {
    throw new Error('Reference audio required for voice cloning');
  }

  console.log(`[TTSWorker] Synthesizing: "${text.substring(0, 50)}..."`);

  // Process inputs
  const inputs = await processor(text, referenceAudio);

  // Generate waveform
  const waveform = await model.generate({
    ...inputs,
    exaggeration: options.exaggeration ?? 0.5
  });

  // Convert to Float32Array
  const audioData = waveform.data instanceof Float32Array
    ? waveform.data
    : new Float32Array(waveform.data);

  console.log(`[TTSWorker] Generated ${audioData.length} samples at ${modelInfo.sampleRate}Hz`);

  respond({
    type: 'audio',
    id,
    data: {
      audio: audioData,
      sampleRate: modelInfo.sampleRate,
      modelId: loadedModelId
    }
  });
}

/**
 * Unload model from memory
 */
function unloadModel(id: string): void {
  model = null;
  processor = null;
  loadedModelId = null;
  cachedReferenceAudio = null;
  cachedReferenceUrl = null;
  console.log('[TTSWorker] Model unloaded');
  respond({ type: 'unloaded', id });
}

/**
 * Get current status
 */
function getStatus(id: string): void {
  respond({
    type: 'status',
    id,
    data: {
      loaded: model !== null,
      modelId: loadedModelId,
      device: deviceType,
      hasVoice: cachedReferenceAudio !== null,
      availableModels: Object.keys(TTS_MODELS)
    }
  });
}

// Message handler
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, id, modelId, text, options } = event.data;

  // Check for initialization error
  if (initError) {
    respond({ type: 'error', id, error: `Worker initialization failed: ${initError.message}` });
    return;
  }

  try {
    switch (type) {
      case 'load':
        if (!modelId) throw new Error('modelId required for load');
        await loadModel(id, modelId);
        break;

      case 'synthesize':
        if (!text) throw new Error('text required for synthesize');
        await synthesize(id, text, options);
        break;

      case 'preload-voice':
        if (!options?.referenceAudioUrl) throw new Error('referenceAudioUrl required');
        await preloadVoice(id, options.referenceAudioUrl);
        break;

      case 'unload':
        unloadModel(id);
        break;

      case 'status':
        getStatus(id);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    respond({
      type: 'error',
      id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Ready signal
console.log('[TTSWorker] Worker initialized');
