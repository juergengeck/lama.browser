/**
 * Model options for lama.browser
 *
 * This defines the list of available models shown in ModelOnboarding.
 * Browser platform only supports cloud API models (with API keys).
 * No downloadable models since browser can't run local LLMs.
 */

import type { ModelOption } from '@lama/ui'

export const MODEL_OPTIONS: ModelOption[] = [
  // Anthropic Models (2025)
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
    id: 'claude-opus-4-1',
    name: 'Claude Opus 4.1',
    size: 'Cloud',
    description: 'Highest capability. Best for agentic tasks and advanced reasoning.',
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
