/**
 * Model options for lama.browser
 *
 * This defines the list of available models shown in ModelOnboarding.
 * Includes both cloud API models (with API keys) and local on-device models
 * that run via transformers.js/ONNX in a Web Worker.
 */

import type { ModelOption } from '@lama/ui'

export const MODEL_OPTIONS: ModelOption[] = [
  // ======================
  // Local On-Device Models (Privacy Focused)
  // ======================
  {
    id: 'granite-4.0-350m',
    name: 'Granite 4.0 Nano',
    size: '~700MB',
    description: 'Fast, lightweight model for on-device inference. Runs entirely in your browser.',
    requiresDownload: true,
    apiKey: false,
    provider: 'local'
  },
  {
    id: 'granite-3.3-2b-instruct',
    name: 'Granite 3.3 2B',
    size: '~2GB',
    description: 'Balanced performance and quality. Runs entirely in your browser.',
    requiresDownload: true,
    apiKey: false,
    provider: 'local'
  },
  {
    id: 'phi-3.5-mini-instruct',
    name: 'Phi 3.5 Mini',
    size: '~2.5GB',
    description: 'Microsoft\'s compact model. Runs entirely in your browser.',
    requiresDownload: true,
    apiKey: false,
    provider: 'local'
  },

  // ======================
  // Cloud API Models
  // ======================

  // Anthropic Models (2025)
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    size: 'Cloud',
    description: 'Most capable model. Best for complex reasoning, coding, and agentic tasks.',
    requiresDownload: false,
    apiKey: true,
    provider: 'anthropic'
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    size: 'Cloud',
    description: 'Best coding model. Strongest for complex agents and computer use.',
    requiresDownload: false,
    apiKey: true,
    provider: 'anthropic'
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    size: 'Cloud',
    description: 'Fast and affordable. Similar coding to Sonnet 4 at 1/3 cost.',
    requiresDownload: false,
    apiKey: true,
    provider: 'anthropic'
  },

  // OpenAI Models (2025)
  {
    id: 'gpt-5',
    name: 'GPT-5',
    size: 'Cloud',
    description: 'OpenAI\'s most powerful reasoning model. Best for complex tasks.',
    requiresDownload: false,
    apiKey: true,
    provider: 'openai'
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    size: 'Cloud',
    description: 'Latest GPT-4 series. Excellent coding and 1M token context.',
    requiresDownload: false,
    apiKey: true,
    provider: 'openai'
  },
  {
    id: 'o3-mini',
    name: 'o3-mini',
    size: 'Cloud',
    description: 'Latest reasoning model. Enhanced reasoning at lower cost.',
    requiresDownload: false,
    apiKey: true,
    provider: 'openai'
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    size: 'Cloud',
    description: 'Fast and affordable. Outperforms GPT-4o mini.',
    requiresDownload: false,
    apiKey: true,
    provider: 'openai'
  },

  // Google Gemini Models (2025)
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    size: 'Cloud',
    description: 'Most capable Gemini. 1M token context, strong reasoning and coding.',
    requiresDownload: false,
    apiKey: true,
    provider: 'google'
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    size: 'Cloud',
    description: 'Fast and efficient. Great balance of speed and capability.',
    requiresDownload: false,
    apiKey: true,
    provider: 'google'
  },

  // DeepSeek Models (2025)
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3.2',
    size: 'Cloud',
    description: 'Latest DeepSeek model. 50% cheaper with sparse attention.',
    requiresDownload: false,
    apiKey: true,
    provider: 'deepseek'
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1',
    size: 'Cloud',
    description: 'Advanced reasoning. Excellent for math and complex problems.',
    requiresDownload: false,
    apiKey: true,
    provider: 'deepseek'
  },

  // Qwen Models (2025)
  {
    id: 'qwen-max',
    name: 'Qwen3 Max',
    size: 'Cloud',
    description: 'Latest Qwen flagship. Most capable multilingual model.',
    requiresDownload: false,
    apiKey: true,
    provider: 'qwen'
  },
  {
    id: 'qwen-plus',
    name: 'Qwen Plus',
    size: 'Cloud',
    description: 'Fast and affordable. Good for general tasks.',
    requiresDownload: false,
    apiKey: true,
    provider: 'qwen'
  }
]
