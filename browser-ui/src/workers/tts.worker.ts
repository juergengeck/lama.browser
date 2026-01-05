/**
 * Web Worker for local TTS (Text-to-Speech) generation
 *
 * Uses kokoro-js with WebGPU for fast browser-based inference.
 * Runs in a Web Worker to avoid blocking the UI thread.
 *
 * WebGPU status should be sent from main thread via 'webgpu-status' message
 * before loading models. If not received, falls back to local detection.
 */

// Shim: kokoro-js/transformers.js uses `window` which doesn't exist in Workers
(globalThis as any).window = self;

import { KokoroTTS } from 'kokoro-js';

// TTS Model config
const TTS_MODEL = {
  id: 'kokoro',
  huggingFaceRepo: 'onnx-community/Kokoro-82M-v1.0-ONNX',
  sampleRate: 24000,
  defaultVoice: 'af_sky'
};

// Worker state
let tts: any = null;
let isLoaded = false;
let deviceType: 'webgpu' | 'wasm' = 'webgpu'; // Default to WebGPU, fall back if unavailable
let webgpuStatusReceived = false;
let isGenerating = false;
let generationQueue: Array<{ id: string; text: string; resolve: () => void }> = [];

interface WorkerMessage {
  type: 'load' | 'synthesize' | 'unload' | 'status' | 'webgpu-status';
  id: string;
  modelId?: string;
  text?: string;
  options?: Record<string, unknown>;
  // For webgpu-status message
  available?: boolean;
  device?: 'webgpu' | 'wasm';
}

interface WorkerResponse {
  type: 'loaded' | 'audio' | 'unloaded' | 'status' | 'error' | 'progress';
  id: string;
  data?: any;
  error?: string;
}

function respond(response: WorkerResponse): void {
  self.postMessage(response);
}

/**
 * Check if WebGPU is available (fallback if status not received from main thread)
 */
async function checkWebGPU(): Promise<boolean> {
  // If we already received status from main thread, trust that
  if (webgpuStatusReceived) {
    return deviceType === 'webgpu';
  }

  // Fallback: check locally (slower path)
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

/**
 * Handle WebGPU status from main thread
 */
function handleWebGPUStatus(message: WorkerMessage): void {
  webgpuStatusReceived = true;
  deviceType = message.device || (message.available ? 'webgpu' : 'wasm');
  console.log(`[TTSWorker] WebGPU status received from main thread: ${deviceType}`);
}

/**
 * Sanitize text for TTS synthesis
 */
function sanitizeTextForTTS(text: string): string {
  let sanitized = text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2032\u2033\u2034\u2035\u2036\u2037]/g, "'")
    .replace(/[\u00AB\u00BB]/g, '"')
    .replace(/[\u2039\u203A]/g, "'");

  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu;
  sanitized = sanitized.replace(emojiRegex, '');
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  return sanitized.length > 0 ? sanitized : 'Hello.';
}

async function loadModel(id: string, modelId: string): Promise<void> {
  console.log(`[TTSWorker] Loading Kokoro TTS...`);

  if (modelId !== 'kokoro') {
    throw new Error(`Unknown TTS model: ${modelId}. Only 'kokoro' is supported.`);
  }

  if (tts && isLoaded) {
    respond({ type: 'loaded', id, data: { modelId, device: deviceType, sampleRate: TTS_MODEL.sampleRate } });
    return;
  }

  const t0 = performance.now();
  const hasWebGPU = await checkWebGPU();
  deviceType = hasWebGPU ? 'webgpu' : 'wasm';

  console.log(`[TTSWorker] Using device: ${deviceType}`);

  try {
    tts = await KokoroTTS.from_pretrained(TTS_MODEL.huggingFaceRepo, {
      dtype: 'fp32',
      device: deviceType,
      progress_callback: (progress: any) => {
        if (progress.status === 'progress') {
          respond({ type: 'progress', id, data: { percent: progress.progress || 0, device: deviceType, stage: 'model' } });
        }
      }
    });

    isLoaded = true;
    console.log(`[TTSWorker] Kokoro ready (${deviceType}) in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    respond({ type: 'loaded', id, data: { modelId, device: deviceType, sampleRate: TTS_MODEL.sampleRate } });
  } catch (error) {
    if (deviceType === 'webgpu') {
      console.warn(`[TTSWorker] WebGPU failed, falling back to WASM...`);
      deviceType = 'wasm';

      tts = await KokoroTTS.from_pretrained(TTS_MODEL.huggingFaceRepo, {
        dtype: 'fp32',
        device: 'wasm',
        progress_callback: (progress: any) => {
          if (progress.status === 'progress') {
            respond({ type: 'progress', id, data: { percent: progress.progress || 0, device: deviceType, stage: 'model' } });
          }
        }
      });

      isLoaded = true;
      console.log(`[TTSWorker] Kokoro ready (wasm fallback) in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
      respond({ type: 'loaded', id, data: { modelId, device: deviceType, sampleRate: TTS_MODEL.sampleRate } });
    } else {
      throw error;
    }
  }
}

async function processQueue(): Promise<void> {
  if (isGenerating || generationQueue.length === 0) return;

  const item = generationQueue.shift()!;
  isGenerating = true;

  try {
    await doSynthesize(item.id, item.text);
  } finally {
    isGenerating = false;
    item.resolve();
    processQueue();
  }
}

async function doSynthesize(id: string, text: string): Promise<void> {
  if (!tts || !isLoaded) {
    throw new Error('Model not loaded');
  }

  const sanitized = sanitizeTextForTTS(text);
  console.log(`[TTSWorker] Synthesizing: "${sanitized.substring(0, 40)}..."`);

  const audio = await tts.generate(sanitized, { voice: TTS_MODEL.defaultVoice });
  const audioData = audio.toFloat32Array ? audio.toFloat32Array() : new Float32Array(audio.data || audio);

  console.log(`[TTSWorker] Generated ${(audioData.length / TTS_MODEL.sampleRate).toFixed(1)}s audio`);

  respond({
    type: 'audio',
    id,
    data: { audio: audioData, sampleRate: TTS_MODEL.sampleRate, modelId: TTS_MODEL.id }
  });
}

async function synthesize(id: string, text: string): Promise<void> {
  if (!tts || !isLoaded) throw new Error('Model not loaded');

  if (isGenerating) {
    console.log(`[TTSWorker] Queueing request: ${id}`);
    return new Promise<void>((resolve) => {
      generationQueue.push({ id, text, resolve });
    });
  }

  isGenerating = true;
  try {
    await doSynthesize(id, text);
  } finally {
    isGenerating = false;
    processQueue();
  }
}

function unloadModel(id: string): void {
  for (const item of generationQueue) {
    respond({ type: 'error', id: item.id, error: 'Model unloaded' });
    item.resolve();
  }
  generationQueue = [];
  tts = null;
  isLoaded = false;
  isGenerating = false;
  console.log('[TTSWorker] Model unloaded');
  respond({ type: 'unloaded', id });
}

function getStatus(id: string): void {
  respond({
    type: 'status',
    id,
    data: { loaded: isLoaded, modelId: isLoaded ? TTS_MODEL.id : null, device: deviceType, availableModels: ['kokoro'] }
  });
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, id, modelId, text } = event.data;

  try {
    switch (type) {
      case 'webgpu-status':
        // Handle WebGPU status from main thread (no response needed)
        handleWebGPUStatus(event.data);
        return;
      case 'load':
        if (!modelId) throw new Error('modelId required');
        await loadModel(id, modelId);
        break;
      case 'synthesize':
        if (!text) throw new Error('text required');
        await synthesize(id, text);
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
    respond({ type: 'error', id, error: error instanceof Error ? error.message : String(error) });
  }
};

console.log('[TTSWorker] Worker initialized');
