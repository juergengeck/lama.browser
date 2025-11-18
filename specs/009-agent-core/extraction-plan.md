# agent.core Code Extraction Plan

**Purpose**: Document exactly what code will be extracted from lama.core, where it will go in agent.core, and what modifications are needed. This is a clean-room implementation using **only LAMA's existing code** - zero Anthropic SDK code.

**Legal Compliance**: All extracted code is original LAMA implementation. No code from Anthropic SDK or other third-party agent frameworks will be used.

---

## Extraction Summary

| Source File | Lines | Component | Destination | Status |
|-------------|-------|-----------|-------------|--------|
| lama.core/services/ollama.ts | 120-429 | Streaming logic | agent.core/streaming/StreamingAdapter.ts | Pending |
| lama.core/services/claude.ts | TBD | Streaming logic | agent.core/streaming/StreamingAdapter.ts | Pending |
| lama.core/services/llm-manager.ts | 702-874 | Tool calling (ReACT) | agent.core/tools/ToolExecutor.ts | Pending |
| lama.core/services/llm-manager.ts | 702-874 | JSON extraction | agent.core/utils/JSONExtractor.ts | Pending |
| lama.core/models/ai/AIPromptBuilder.ts | Full file | Context management | agent.core/conversation/ConversationManager.ts | Pending |
| lama.core/services/llm-manager.ts | 1-289 | Provider interface | agent.core/providers/LLMProvider.ts | Pending |
| lama.core/services/llm-platform.ts | Full file | Platform abstraction | agent.core/platform/PlatformInterface.ts | Pending |

---

## Extraction 1: Streaming Architecture

### Source: lama.core/services/ollama.ts (lines 120-429)

**What we're extracting**:
- ReadableStream handling with getReader()
- JSON-line parsing with buffer management
- Separation of thinking vs content streams
- Request cancellation with AbortController
- Error handling for stream interruptions

**Original Implementation** (Our Code):
```typescript
// From ollama.ts chat() method
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;
    const data = JSON.parse(line);

    // Separate thinking from content
    if (data.thinking && options.onThinkingStream) {
      options.onThinkingStream(data.thinking);
    }
    if (data.message?.content && options.onStream) {
      options.onStream(data.message.content);
    }
  }
}
```

**Destination**: agent.core/streaming/StreamingAdapter.ts

**Modifications**:
1. Extract into `StreamingAdapter` class with provider-agnostic interface
2. Add support for different streaming formats (Ollama, Claude, OpenAI)
3. Generalize thinking/content separation
4. Preserve all error handling and cancellation logic

**New Interface** (Our Design):
```typescript
export interface StreamingCallbacks {
  onThinking?: (text: string) => void;
  onContent?: (text: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export class StreamingAdapter {
  async processStream(
    stream: ReadableStream<Uint8Array>,
    callbacks: StreamingCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    // Our existing streaming logic from ollama.ts
  }
}
```

---

## Extraction 2: Tool Calling (ReACT Pattern)

### Source: lama.core/services/llm-manager.ts (lines 702-874)

**What we're extracting**:
- Brace-counting JSON parser for extracting tool calls from LLM responses
- Recursive refinement pattern when JSON is malformed
- Tool execution loop with result injection
- Loop prevention with `disableTools: true` guard
- Error handling for tool execution failures

**Original Implementation** (Our Code):
```typescript
// From llm-manager.ts - brace-counting JSON extractor
private extractToolCall(text: string): { name: string; params: any } | null {
  let braceCount = 0;
  let startIndex = -1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (braceCount === 0) startIndex = i;
      braceCount++;
    } else if (text[i] === '}') {
      braceCount--;
      if (braceCount === 0 && startIndex !== -1) {
        const jsonStr = text.substring(startIndex, i + 1);
        try {
          return JSON.parse(jsonStr);
        } catch (e) {
          // Continue searching
        }
      }
    }
  }
  return null;
}

// Recursive refinement loop
async executeWithTools(messages, tools, options) {
  const response = await this.chat(messages, { ...options, tools });
  const toolCall = this.extractToolCall(response.content);

  if (toolCall) {
    const result = await this.executeTool(toolCall.name, toolCall.params);

    // Inject result and recurse WITHOUT tools to prevent loops
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: `Tool result: ${JSON.stringify(result)}` });

    return await this.chat(messages, { ...options, disableTools: true });
  }

  return response;
}
```

**Destination**:
- agent.core/utils/JSONExtractor.ts (brace-counting parser)
- agent.core/tools/ToolExecutor.ts (ReACT loop)

**Modifications**:
1. Extract JSON parser into standalone utility
2. Make recursion limit configurable (currently implicit)
3. Add iteration count tracking for debugging
4. Preserve fail-fast error handling

**New Interface** (Our Design):
```typescript
// JSONExtractor.ts
export class JSONExtractor {
  static extractJSON(text: string): any | null {
    // Our brace-counting algorithm from llm-manager.ts
  }
}

// ToolExecutor.ts
export class ToolExecutor {
  async executeReACTLoop(
    initialMessages: Message[],
    tools: ToolDefinition[],
    llmProvider: LLMProvider,
    options: { maxIterations?: number }
  ): Promise<ExecutionResult> {
    // Our recursive refinement pattern from llm-manager.ts
  }
}
```

---

## Extraction 3: Context Management

### Source: lama.core/models/ai/AIPromptBuilder.ts

**What we're extracting**:
- TTL cache for conversation history (5-second default)
- Message array management and formatting
- Context window size calculations
- Conversation history query logic
- System prompt composition

**Original Implementation** (Our Code):
```typescript
// From AIPromptBuilder.ts
private messageCache = new Map<string, { messages: Message[]; timestamp: number }>();
private readonly CACHE_TTL = 5000; // 5 seconds

async getConversationHistory(topicId: string): Promise<Message[]> {
  const cached = this.messageCache.get(topicId);
  if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
    return cached.messages;
  }

  const messages = await this.queryMessagesFromOneCore(topicId);
  this.messageCache.set(topicId, { messages, timestamp: Date.now() });
  return messages;
}

private calculateContextWindow(messages: Message[]): number {
  // Token counting logic
  return messages.reduce((sum, msg) => sum + this.estimateTokens(msg.content), 0);
}
```

**Destination**: agent.core/conversation/ConversationManager.ts

**Modifications**:
1. Remove LAMA-specific prompt formatting
2. Generalize for any conversation ID (not just topicId)
3. Make TTL configurable
4. Extract ONE.core querying into separate adapter
5. Add conversation serialization support

**New Interface** (Our Design):
```typescript
export class ConversationManager {
  constructor(
    private storage: ConversationStorage, // ONE.core adapter
    private cacheTTL: number = 5000
  ) {}

  async getHistory(conversationId: string): Promise<Message[]> {
    // Our TTL cache logic from AIPromptBuilder.ts
  }

  async save(conversationId: string, messages: Message[]): Promise<void> {
    // Store to ONE.core via adapter
  }

  async compact(messages: Message[], maxTokens: number): Promise<Message[]> {
    // Our context window logic from AIPromptBuilder.ts
  }
}
```

---

## Extraction 4: Provider Abstraction

### Source: lama.core/services/llm-manager.ts (lines 1-289)

**What we're extracting**:
- Provider routing logic (model prefix detection)
- Model discovery and listing
- Unified options interface
- Provider initialization patterns

**Original Implementation** (Our Code):
```typescript
// From llm-manager.ts
async chat(messages: Message[], options: LLMOptions): Promise<Response> {
  const provider = this.getProviderForModel(options.model);
  return await provider.chat(messages, options);
}

private getProviderForModel(modelId: string): LLMProvider {
  if (modelId.startsWith('ollama:')) {
    return this.ollamaProvider;
  }
  if (modelId.startsWith('claude:')) {
    return this.claudeProvider;
  }
  throw new Error(`Unknown provider for model: ${modelId}`);
}

async listModels(): Promise<ModelInfo[]> {
  const ollama = await this.ollamaProvider.listModels();
  const claude = await this.claudeProvider.listModels();
  return [...ollama, ...claude];
}
```

**Destination**: agent.core/providers/LLMProvider.ts (interface)

**Modifications**:
1. Formalize as TypeScript interface
2. Add provider registration system (instead of hardcoded if/else)
3. Extract provider implementations to separate files
4. Add provider capability detection

**New Interface** (Our Design):
```typescript
export interface LLMProvider {
  readonly name: string;

  chat(messages: Message[], options: ChatOptions): Promise<ChatResponse>;
  listModels(): Promise<ModelInfo[]>;
  supportsStreaming(): boolean;
  supportsTools(): boolean;
}

export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>();

  register(prefix: string, provider: LLMProvider): void {
    this.providers.set(prefix, provider);
  }

  getProvider(modelId: string): LLMProvider {
    // Our prefix detection logic from llm-manager.ts
  }
}
```

---

## Extraction 5: Platform Abstraction

### Source: lama.core/services/llm-platform.ts

**What we're extracting**:
- Optional method pattern for Electron/Browser independence
- Event emission interface
- Platform capability detection

**Original Implementation** (Our Code):
```typescript
// From llm-platform.ts
export interface LLMPlatformInterface {
  emitEvent?(event: string, data: any): void;
  showNotification?(message: string): void;
  // Optional methods - platforms implement what they support
}

export class LLMPlatform {
  constructor(private platform?: LLMPlatformInterface) {}

  notifyUser(message: string): void {
    if (this.platform?.showNotification) {
      this.platform.showNotification(message);
    }
    // No fallback - platform decides behavior
  }
}
```

**Destination**: agent.core/platform/PlatformInterface.ts

**Modifications**:
1. Rename to AgentPlatformInterface for clarity
2. Add agent-specific methods (progress reporting, debugging)
3. Preserve optional method pattern

**New Interface** (Our Design):
```typescript
export interface AgentPlatformInterface {
  emitProgress?(step: ReasoningStep): void;
  emitToolCall?(call: ToolInvocation): void;
  emitError?(error: AgentError): void;
  // All optional - platform implements what it needs
}
```

---

## Non-Extraction: New Components

These are **new implementations** following LAMA patterns (not extracted):

### agent.core/plans/AgentPlan.ts
- **Pattern Source**: ChatPlan, ContactsPlan (dependency injection, fail-fast)
- **Implementation**: New orchestration logic for multi-step reasoning
- **Key Principle**: Follow existing plan patterns exactly

### agent.core/tools/ToolRegistry.ts
- **Pattern Source**: Existing service registration in lama.core
- **Implementation**: New registry for tool management
- **Key Principle**: Simple Map-based lookup, no magic

### agent.core/types/agent-types.ts
- **Pattern Source**: Existing LAMA type definitions
- **Implementation**: New types for agent-specific concepts
- **Key Principle**: Branded types where appropriate (SHA256Hash pattern)

---

## Validation Strategy

For each extraction, we will:

1. **Unit Test Original**: Ensure tests pass in lama.core before extraction
2. **Extract Code**: Copy code to agent.core with documented modifications
3. **Unit Test Extracted**: Write new tests in agent.core verifying identical behavior
4. **Integration Test**: Test extracted component in original lama.core context
5. **Compare Behavior**: Assert extracted version produces identical results

---

## Timeline

- **Week 1**: Extractions 1-2 (Streaming + Tool Calling)
- **Week 2**: Extraction 3 (Context Management)
- **Week 3**: Extractions 4-5 (Providers + Platform)
- **Week 4**: New components (AgentPlan, ToolRegistry)
- **Week 5**: Integration and testing

---

## Legal Compliance Checklist

- ✅ All source code is from LAMA repository (our original implementation)
- ✅ Zero code copied from Anthropic SDK or documentation
- ✅ Zero code copied from other third-party agent frameworks
- ✅ Only LAMA patterns and industry-standard algorithms (ReACT, streaming)
- ✅ All new type definitions are our original design
- ✅ All interface names are LAMA-specific (not SDK-inspired naming)

---

## File References

### Source Files (lama.core)
- `/Users/gecko/src/lama/lama.core/services/ollama.ts`
- `/Users/gecko/src/lama/lama.core/services/claude.ts`
- `/Users/gecko/src/lama/lama.core/services/llm-manager.ts`
- `/Users/gecko/src/lama/lama.core/models/ai/AIPromptBuilder.ts`
- `/Users/gecko/src/lama/lama.core/services/llm-platform.ts`

### Destination Files (agent.core)
- Will be created in Phase 1 of implementation
- See spec.md Technical Design section for full structure

---

## Next Steps

1. Review this extraction plan for legal compliance
2. Get approval to proceed with Phase 1 (Streaming + Tool Calling)
3. Create agent.core package structure
4. Begin extractions with validation testing
