# Anthropic CORS Support in lama.browser

## Overview

As of August 2024, Anthropic enables direct browser-to-API communication using CORS (Cross-Origin Resource Sharing). This allows the browser platform to call Claude models without a proxy server.

## How It Works

Anthropic's API supports CORS when requests include the header:
```
anthropic-dangerous-direct-browser-access: true
```

This header name serves as a security warning - API keys exposed in browser code can be stolen by anyone with dev tools access.

## Implementation

### HTTP-based (Platform-Agnostic)

The core implementation is in `lama.core/services/anthropic-http.ts`:

```typescript
import { chatWithAnthropicHTTP, testAnthropicApiKey } from '@lama/core/services/anthropic-http.js';

// Chat with Claude
const response = await chatWithAnthropicHTTP({
  apiKey: userProvidedApiKey,
  model: 'claude-sonnet-4-5-20250929',
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
  system: 'You are a helpful assistant.',
  onStream: (chunk) => console.log(chunk) // Optional streaming
});

// Test API key
const isValid = await testAnthropicApiKey(apiKey);
```

### SDK-based (Browser-Specific)

For better type safety and features, use the browser service in `browser-ui/src/services/anthropic.ts`:

```typescript
import { browserAnthropicService } from '@/services/anthropic';

// Initialize with user's API key
browserAnthropicService.initialize(userApiKey);

// Chat with Claude
const response = await browserAnthropicService.chat({
  model: 'claude-sonnet-4-5-20250929',
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
  system: 'You are a helpful assistant.',
  onStream: (chunk) => console.log(chunk) // Optional
});

// Test API key before initializing
const isValid = await browserAnthropicService.testApiKey(apiKey);
```

## Security - BYOK Pattern

**CRITICAL**: This implementation uses the "Bring Your Own Key" (BYOK) pattern:

1. **Never hardcode API keys** - API keys must be provided by users
2. **Client-side storage** - Keys are stored in browser localStorage/IndexedDB (encrypted with ONE.core)
3. **User responsibility** - Users manage their own Anthropic accounts and billing
4. **Theft risk** - Anyone with dev tools can extract API keys from browser memory

### Best Practices

1. **Prompt for keys**: Ask users to enter their Anthropic API key in settings
2. **Secure storage**: Use ONE.core's encrypted storage (via `userSettingsManager.setApiKey('anthropic', key)`)
3. **Clear warnings**: Inform users that they're responsible for API key security
4. **HTTPS only**: Never run on non-HTTPS sites (API calls will fail)

## Integration with LLMManager

The LLMManager automatically uses the HTTP implementation with CORS headers:

```typescript
// In lama.core/services/llm-manager.ts (line 998)
async chatWithClaude(model: any, messages: any, options: any = {}): Promise<any> {
  // Uses chatWithAnthropicHTTP with CORS header
  return await chatWithAnthropicHTTP({
    apiKey: options.apiKey, // Platform layer injects this
    model: baseModelId,
    messages: anthropicMessages,
    system: systemMessage,
    temperature: model.parameters.temperature,
    max_tokens: model.parameters.maxTokens,
    tools, // MCP tools if available
    onStream: options.onStream,
    signal: options.signal
  });
}
```

## UI Integration

The browser UI already supports Anthropic models in LLM Settings:

1. **Model Options** (`browser-ui/src/constants/model-options.ts`):
   - Claude Sonnet 4.5 (Recommended)
   - Claude Opus 4.1
   - Claude Haiku 4.5
   - Claude 3.5 Haiku

2. **Settings UI** (`browser-ui/src/components/Settings/LLMSettings.tsx`):
   - API key input for Anthropic
   - Model selection dropdown
   - Test connection button
   - Links to Anthropic console

## Testing

### Manual Test

1. Open lama.browser in a browser
2. Go to Settings → LLM Settings
3. Click "Add Cloud Provider" → Select "Anthropic"
4. Enter your Anthropic API key from https://console.anthropic.com
5. Select a Claude model (e.g., "Claude Sonnet 4.5")
6. Save configuration
7. Start a new conversation with the Claude model

### Programmatic Test

```typescript
// Test API key validation
import { testAnthropicApiKey } from '@lama/core/services/anthropic-http.js';

const apiKey = 'sk-ant-api...';
const isValid = await testAnthropicApiKey(apiKey);
console.log('API key valid:', isValid);

// Test chat
import { chatWithAnthropicHTTP } from '@lama/core/services/anthropic-http.js';

const response = await chatWithAnthropicHTTP({
  apiKey,
  model: 'claude-3-haiku-20240307', // Fastest/cheapest for testing
  messages: [{ role: 'user', content: 'Say "CORS works!"' }],
  max_tokens: 50
});
console.log('Response:', response);
```

## References

- **Anthropic CORS Announcement**: https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/
- **Anthropic SDK Docs**: https://github.com/anthropics/anthropic-sdk-typescript
- **API Key Management**: https://console.anthropic.com
- **BYOK Pattern**: Open source projects where creators don't subsidize API costs

## Status

- ✅ CORS header added to `anthropic-http.ts`
- ✅ Browser service with SDK created (`browser-ui/src/services/anthropic.ts`)
- ✅ LLMManager integration complete
- ✅ UI supports Anthropic models
- ⏳ Ready for testing (pending user API keys)

## Troubleshooting

### "CORS policy blocked" error
- **Cause**: Missing `anthropic-dangerous-direct-browser-access` header
- **Fix**: Verify you're using the updated `anthropic-http.ts` (should include the header)

### "API key not provided" error
- **Cause**: API key not stored or not retrieved
- **Fix**:
  1. Check Settings → LLM Settings → Anthropic API key is entered
  2. Verify `userSettingsManager.getApiKey('anthropic')` returns the key
  3. Check browser console for key retrieval errors

### "Model not found" error
- **Cause**: Invalid model ID or model not available
- **Fix**: Use current model IDs (e.g., `claude-sonnet-4-5-20250929` not `claude-3-5-sonnet`)

### API key stolen
- **Response**: User must revoke the compromised key at https://console.anthropic.com
- **Prevention**: Educate users about dev tools risk, recommend using low-limit keys for testing
