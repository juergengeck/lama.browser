/**
 * LLM Proxy Service - NOT USED IN BROWSER
 * Browser uses Model handlers instead (model.aiPlan, model.llmConfigPlan)
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class LLMProxy {
  constructor() {
    throw new Error('LLMProxy not supported in browser - use Model handlers instead (model.aiPlan)')
  }

  async chat(messages: ChatMessage[], modelId?: string, topicId?: string): Promise<string> {
    throw new Error('LLMProxy not supported in browser - use model.aiPlan.chat() instead')
  }

  async getModels() {
    throw new Error('LLMProxy not supported in browser - use model.aiPlan.getModels() instead')
  }

  async setDefaultModel(modelId: string) {
    throw new Error('LLMProxy not supported in browser - use model.aiPlan.setDefaultModel() instead')
  }

  async setApiKey(provider: string, apiKey: string) {
    throw new Error('LLMProxy not supported in browser - use model.llmConfigPlan instead')
  }

  async getTools() {
    throw new Error('LLMProxy not supported in browser - MCP tools not available in browser')
  }

  async initialize() {
    throw new Error('LLMProxy not supported in browser - Model initializes directly')
  }
}

// Don't instantiate - will throw error in browser
export const llmProxy = null as any as LLMProxy