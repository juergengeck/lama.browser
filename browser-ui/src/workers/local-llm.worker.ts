/**
 * Web Worker for local LLM text generation
 *
 * Uses @huggingface/transformers for browser-based inference.
 * Runs in a Web Worker to avoid blocking the UI thread.
 *
 * Tool calling support via @mcp/core/local-browser
 *
 * WebGPU status should be sent from main thread via 'webgpu-status' message
 * before loading models. If not received, falls back to local detection.
 */

import { pipeline, env, TextStreamer } from '@huggingface/transformers';
import type { TextGenerationPipeline } from '@huggingface/transformers';
import type { GraniteToolDefinition, ToolCall } from '@mcp/core';

// Configure for browser environment
env.allowLocalModels = false; // Always download from HuggingFace
env.useBrowserCache = true;   // Use IndexedDB for caching

// Model registry (subset of @local/core for worker isolation)
const TEXT_GEN_MODELS: Record<string, { huggingFaceRepo: string; contextLength: number; familyName: string }> = {
  'granite-4.0-350m': {
    huggingFaceRepo: 'onnx-community/granite-4.0-350m-ONNX-web',
    contextLength: 32768,
    familyName: 'Granite'
  },
  'granite-3.3-2b-instruct': {
    huggingFaceRepo: 'onnx-community/granite-3.3-2b-instruct-ONNX',
    contextLength: 4096,
    familyName: 'Granite'
  },
  'phi-3.5-mini-instruct': {
    huggingFaceRepo: 'onnx-community/Phi-3.5-mini-instruct-onnx-web',
    contextLength: 4096,
    familyName: 'Phi'
  }
};

// Worker state
let generator: TextGenerationPipeline | null = null;
let loadedModelId: string | null = null;
let deviceType: 'webgpu' | 'wasm' = 'webgpu'; // Default to WebGPU, fall back if unavailable
let webgpuStatusReceived = false;

/**
 * Check if WebGPU is available (fallback if status not received from main thread)
 */
async function checkWebGPU(): Promise<boolean> {
  // If we already received status from main thread, trust that
  if (webgpuStatusReceived) {
    return deviceType === 'webgpu';
  }

  // Fallback: check locally (slower path)
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

/**
 * Handle WebGPU status from main thread
 */
function handleWebGPUStatus(message: { available?: boolean; device?: 'webgpu' | 'wasm' }): void {
  webgpuStatusReceived = true;
  deviceType = message.device || (message.available ? 'webgpu' : 'wasm');
  console.log(`[LocalLLMWorker] WebGPU status received from main thread: ${deviceType}`);
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool_response';
  content: string;
}

// ToolDefinition and ToolCall types imported from @mcp/core

interface WorkerMessage {
  type: 'load' | 'chat' | 'unload' | 'status' | 'webgpu-status';
  id: string;
  modelId?: string;
  messages?: ChatMessage[];
  tools?: GraniteToolDefinition[];
  options?: {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  };
  // For webgpu-status message
  available?: boolean;
  device?: 'webgpu' | 'wasm';
}

interface WorkerResponse {
  type: 'loaded' | 'response' | 'stream' | 'unloaded' | 'status' | 'error' | 'progress' | 'tool_call';
  id: string;
  data?: any;
  error?: string;
}

/**
 * Granite 4.0 Jinja chat template with tool support
 * Based on official Granite 4.0 prompt engineering guide
 * Tools are listed in system prompt between <tools> and </tools> tags
 */
const GRANITE_CHAT_TEMPLATE_WITH_TOOLS = `{% if tools %}<|start_of_role|>system<|end_of_role|>You are a helpful assistant with access to the following tools. You may call one or more tools to assist with the user query. Don't make assumptions about what values to plug into functions. Here are the available tools:
<tools>
{% for tool in tools %}
{{ tool | tojson }}
{% endfor %}
</tools>
For each function call, return a JSON object with function name and arguments within <tool_call></tool_call> tags:
<tool_call>
{"name": "<function-name>", "arguments": <args-json-object>}
</tool_call><|end_of_text|>{% endif %}{% for message in messages %}{% if message['role'] == 'system' %}<|start_of_role|>system<|end_of_role|>{{ message['content'] }}<|end_of_text|>{% elif message['role'] == 'user' %}<|start_of_role|>user<|end_of_role|}{{ message['content'] }}<|end_of_text|>{% elif message['role'] == 'assistant' %}<|start_of_role|>assistant<|end_of_role|>{{ message['content'] }}<|end_of_text|>{% elif message['role'] == 'tool_response' %}<|start_of_role|>user<|end_of_role|><tool_response>
{{ message['content'] }}
</tool_response><|end_of_text|>{% endif %}{% endfor %}{% if add_generation_prompt %}<|start_of_role|>assistant<|end_of_role|>{% endif %}`;

/**
 * Granite 4.0 Jinja chat template (no tools)
 */
const GRANITE_CHAT_TEMPLATE = `{% for message in messages %}{% if message['role'] == 'system' %}<|start_of_role|>system<|end_of_role|>{{ message['content'] }}<|end_of_text|>{% elif message['role'] == 'user' %}<|start_of_role|>user<|end_of_role|>{{ message['content'] }}<|end_of_text|>{% elif message['role'] == 'assistant' %}<|start_of_role|>assistant<|end_of_role|>{{ message['content'] }}<|end_of_text|>{% endif %}{% endfor %}{% if add_generation_prompt %}<|start_of_role|>assistant<|end_of_role|>{% endif %}`;

/**
 * Apply chat template using tokenizer (handles proper token conversion)
 */
function applyGraniteTemplate(tokenizer: any, messages: ChatMessage[], tools?: GraniteToolDefinition[]): string {
  try {
    // Choose template based on whether tools are provided
    const template = tools && tools.length > 0 ? GRANITE_CHAT_TEMPLATE_WITH_TOOLS : GRANITE_CHAT_TEMPLATE;

    // Use tokenizer's apply_chat_template with our custom template
    const prompt = tokenizer.apply_chat_template(messages, {
      chat_template: template,
      add_generation_prompt: true,
      tokenize: false, // Return string, not tokens
      tools: tools, // Pass tools for template rendering
    });
    return prompt;
  } catch (error) {
    // Fallback to manual template if apply_chat_template fails
    console.warn('[LocalLLMWorker] apply_chat_template failed, using manual template:', error);
    let prompt = '';

    // Add tool system prompt if tools provided
    if (tools && tools.length > 0) {
      prompt += `<|start_of_role|>system<|end_of_role|>You are a helpful assistant with access to the following tools. You may call one or more tools to assist with the user query. Don't make assumptions about what values to plug into functions. Here are the available tools:
<tools>
${tools.map(t => JSON.stringify(t)).join('\n')}
</tools>
For each function call, return a JSON object with function name and arguments within <tool_call></tool_call> tags:
<tool_call>
{"name": "<function-name>", "arguments": <args-json-object>}
</tool_call><|end_of_text|>`;
    }

    for (const msg of messages) {
      if (msg.role === 'tool_response') {
        prompt += `<|start_of_role|>user<|end_of_role|><tool_response>\n${msg.content}\n</tool_response><|end_of_text|>`;
      } else {
        prompt += `<|start_of_role|>${msg.role}<|end_of_role|>${msg.content}<|end_of_text|>`;
      }
    }
    prompt += '<|start_of_role|>assistant<|end_of_role|>';
    return prompt;
  }
}

/**
 * Parse tool calls from model output
 * Returns array of tool calls if found, null otherwise
 */
function parseToolCalls(response: string): ToolCall[] | null {
  const toolCallRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
  const toolCalls: ToolCall[] = [];

  let match;
  while ((match = toolCallRegex.exec(response)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.name && parsed.arguments !== undefined) {
        toolCalls.push({
          name: parsed.name,
          arguments: parsed.arguments
        });
      }
    } catch (e) {
      console.warn('[LocalLLMWorker] Failed to parse tool call:', match[1], e);
    }
  }

  return toolCalls.length > 0 ? toolCalls : null;
}

/**
 * Send response to main thread
 */
function respond(response: WorkerResponse): void {
  self.postMessage(response);
}

/**
 * Load a model into memory
 */
async function loadModel(id: string, modelId: string): Promise<void> {
  const modelInfo = TEXT_GEN_MODELS[modelId];
  if (!modelInfo) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  // Unload existing model if different
  if (generator && loadedModelId !== modelId) {
    generator = null;
    loadedModelId = null;
  }

  if (generator && loadedModelId === modelId) {
    respond({ type: 'loaded', id, data: { modelId, device: deviceType } });
    return;
  }

  // Check for WebGPU support
  const hasWebGPU = await checkWebGPU();
  deviceType = hasWebGPU ? 'webgpu' : 'wasm';

  console.log(`[LocalLLMWorker] Loading model: ${modelId} (device: ${deviceType})`);

  // Track progress across multiple files
  const fileProgress = new Map<string, number>();
  const updateProgress = (progress: any) => {
    if (progress.status === 'progress' && progress.file) {
      fileProgress.set(progress.file, progress.progress || 0);
      // Calculate average progress across all files
      const values = Array.from(fileProgress.values());
      const avgProgress = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
      respond({ type: 'progress', id, data: { percent: avgProgress, file: progress.file, device: deviceType } });
    } else if (progress.status === 'done') {
      // Mark file as complete
      if (progress.file) fileProgress.set(progress.file, 100);
    }
  };

  try {
    // Use fp16 for WebGPU, q4 (4-bit quantized) for WASM
    const dtype = deviceType === 'webgpu' ? 'fp16' : 'q4';
    generator = await pipeline('text-generation', modelInfo.huggingFaceRepo, {
      device: deviceType,
      dtype,
      progress_callback: updateProgress
    }) as TextGenerationPipeline;
  } catch (error) {
    // Fallback to WASM if WebGPU fails
    if (deviceType === 'webgpu') {
      console.warn(`[LocalLLMWorker] WebGPU failed, falling back to WASM:`, error);
      deviceType = 'wasm';

      // Reset progress tracking for WASM fallback
      fileProgress.clear();
      generator = await pipeline('text-generation', modelInfo.huggingFaceRepo, {
        device: 'wasm',
        dtype: 'q4', // 4-bit quantized for WASM
        progress_callback: updateProgress
      }) as TextGenerationPipeline;
    } else {
      throw error;
    }
  }

  loadedModelId = modelId;
  console.log(`[LocalLLMWorker] Model loaded: ${modelId} (device: ${deviceType})`);
  respond({ type: 'loaded', id, data: { modelId, device: deviceType } });
}

/**
 * Generate chat response
 */
async function chat(
  id: string,
  messages: ChatMessage[],
  tools?: GraniteToolDefinition[],
  options: { temperature?: number; maxTokens?: number; stream?: boolean } = {}
): Promise<void> {
  if (!generator || !loadedModelId) {
    throw new Error('Model not loaded');
  }

  // Apply Granite chat template using tokenizer (with tools if provided)
  const prompt = applyGraniteTemplate(generator.tokenizer, messages, tools);
  console.log('[LocalLLMWorker] Prompt:', prompt);
  if (tools && tools.length > 0) {
    console.log('[LocalLLMWorker] Tools provided:', tools.map(t => t.function.name).join(', '));
  }

  if (options.stream) {
    // Streaming mode
    let fullResponse = '';

    const streamer = new TextStreamer(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: false, // Keep special tokens for tool call parsing
      callback_function: (token: string) => {
        fullResponse += token;
        respond({ type: 'stream', id, data: { chunk: token, partial: fullResponse } });
      }
    });

    await generator(prompt, {
      max_new_tokens: options.maxTokens ?? 512,
      do_sample: false,
      streamer,
    });

    // Check for tool calls in the response
    const toolCalls = parseToolCalls(fullResponse);
    if (toolCalls && tools && tools.length > 0) {
      console.log('[LocalLLMWorker] Tool calls detected:', toolCalls);
      respond({ type: 'tool_call', id, data: { toolCalls, modelId: loadedModelId } });
      return;
    }

    // Clean up any trailing special tokens
    const cleanResponse = cleanGraniteResponse(fullResponse);
    console.log('[LocalLLMWorker] Stream response:', cleanResponse.substring(0, 100));
    respond({ type: 'response', id, data: { response: cleanResponse, modelId: loadedModelId } });
  } else {
    // Non-streaming mode
    const result = await generator(prompt, {
      max_new_tokens: options.maxTokens ?? 512,
      do_sample: false,
    });

    console.log('[LocalLLMWorker] Raw result:', JSON.stringify(result).substring(0, 500));

    // Extract generated text
    const output = result as any;
    let response: string;

    if (Array.isArray(output) && output[0]?.generated_text) {
      const generatedText = output[0].generated_text;
      // The generated_text has special tokens stripped, so we need to find
      // the assistant response by looking for the last "assistant" marker
      // Format in generated_text: "system<content>user<content>assistant<response>"
      const assistantIdx = generatedText.lastIndexOf('assistant');
      if (assistantIdx !== -1) {
        response = generatedText.slice(assistantIdx + 'assistant'.length);
      } else {
        // Fallback: try to extract from prompt length (may not work if tokens stripped)
        response = generatedText.slice(prompt.length);
      }
    } else {
      response = String(output);
    }

    // Check for tool calls in the response
    const toolCalls = parseToolCalls(response);
    if (toolCalls && tools && tools.length > 0) {
      console.log('[LocalLLMWorker] Tool calls detected:', toolCalls);
      respond({ type: 'tool_call', id, data: { toolCalls, modelId: loadedModelId } });
      return;
    }

    // Clean up any trailing special tokens
    const cleanResponse = cleanGraniteResponse(response);
    console.log('[LocalLLMWorker] Response:', cleanResponse.substring(0, 100));

    respond({ type: 'response', id, data: { response: cleanResponse, modelId: loadedModelId } });
  }
}

/**
 * Clean up Granite response by removing special tokens
 */
function cleanGraniteResponse(response: string): string {
  // Remove everything from the first special token onwards
  let clean = response;

  // Common stop points
  const stopTokens = ['<|end_of_text|>', '<|start_of_role|>', '<|end_of_role|>'];
  for (const token of stopTokens) {
    const idx = clean.indexOf(token);
    if (idx !== -1) {
      clean = clean.substring(0, idx);
    }
  }

  return clean.trim();
}

/**
 * Unload model from memory
 */
function unloadModel(id: string): void {
  generator = null;
  loadedModelId = null;
  console.log('[LocalLLMWorker] Model unloaded');
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
      loaded: generator !== null,
      modelId: loadedModelId,
      device: deviceType
    }
  });
}

// Message handler
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, id, modelId, messages, tools, options } = event.data;

  try {
    switch (type) {
      case 'webgpu-status':
        // Handle WebGPU status from main thread (no response needed)
        handleWebGPUStatus(event.data);
        return;

      case 'load':
        if (!modelId) throw new Error('modelId required for load');
        await loadModel(id, modelId);
        break;

      case 'chat':
        if (!messages) throw new Error('messages required for chat');
        await chat(id, messages, tools, options);
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
console.log('[LocalLLMWorker] Worker initialized');
