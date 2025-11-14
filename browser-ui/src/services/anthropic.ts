/**
 * Browser Anthropic Service
 *
 * Uses Anthropic SDK with dangerouslyAllowBrowser for direct browser-to-API communication.
 * Implements BYOK (Bring Your Own Key) pattern for security.
 *
 * SECURITY WARNING: API keys are stored client-side. Only use with user-provided keys.
 * See: https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/
 */

import Anthropic from '@anthropic-ai/sdk';

export interface AnthropicMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AnthropicChatOptions {
  model: string;
  messages: AnthropicMessage[];
  system?: string;
  max_tokens?: number;
  temperature?: number;
  tools?: any[];
  onStream?: (chunk: string) => void;
  signal?: AbortSignal;
}

export class BrowserAnthropicService {
  private client: Anthropic | null = null;
  private apiKey: string | null = null;

  /**
   * Initialize with API key (required before use)
   */
  initialize(apiKey: string): void {
    this.apiKey = apiKey;
    this.client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true, // Enable browser CORS support
      maxRetries: 2,
      timeout: 60000
    });
    console.log('[BrowserAnthropicService] Initialized with API key');
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return !!this.client;
  }

  /**
   * Chat with Claude using Anthropic SDK
   */
  async chat(options: AnthropicChatOptions): Promise<string> {
    if (!this.client) {
      throw new Error('Anthropic service not initialized - call initialize(apiKey) first');
    }

    const {
      model,
      messages,
      system,
      max_tokens = 4096,
      temperature = 0.7,
      tools,
      onStream
    } = options;

    // Convert messages (filter out system role - handled separately)
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

    // Extract system message if present
    const systemMessage = messages.find(m => m.role === 'system')?.content || system;

    try {
      if (onStream) {
        // Streaming response
        const createParams: any = {
          model,
          max_tokens,
          temperature,
          messages: anthropicMessages,
          stream: true
        };

        if (systemMessage) {
          createParams.system = systemMessage;
        }

        if (tools && tools.length > 0) {
          createParams.tools = tools;
          console.log(`[BrowserAnthropicService] Streaming with ${tools.length} tools`);
        }

        const stream = await this.client.messages.create(createParams) as any;

        let fullResponse = '';
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const chunk = event.delta.text;
            fullResponse += chunk;
            onStream(chunk);
          }
        }

        return fullResponse;
      } else {
        // Non-streaming response
        const createParams: any = {
          model,
          max_tokens,
          temperature,
          messages: anthropicMessages
        };

        if (systemMessage) {
          createParams.system = systemMessage;
        }

        if (tools && tools.length > 0) {
          createParams.tools = tools;
          console.log(`[BrowserAnthropicService] Non-streaming with ${tools.length} tools`);
        }

        const response = await this.client.messages.create(createParams);

        // Extract text from response
        const textContent = response.content
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join('\n');

        return textContent;
      }
    } catch (error) {
      console.error('[BrowserAnthropicService] Chat failed:', error);
      throw error;
    }
  }

  /**
   * Test an API key by making a minimal request
   */
  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const testClient = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true
      });

      const response = await testClient.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      });

      return !!response;
    } catch (error) {
      console.error('[BrowserAnthropicService] API key test failed:', error);
      return false;
    }
  }

  /**
   * Clear service (e.g., on logout)
   */
  clear(): void {
    this.client = null;
    this.apiKey = null;
    console.log('[BrowserAnthropicService] Cleared');
  }
}

// Export singleton instance
export const browserAnthropicService = new BrowserAnthropicService();
