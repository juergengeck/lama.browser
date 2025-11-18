# Model Selection UI Components & Logic - Comprehensive Summary

## Executive Summary

The LAMA codebase has model selection functionality **scattered across multiple platforms** with **inconsistent implementations**. The browser platform uses **shared UI components from `lama.ui`**, while Electron has platform-specific implementations. There is **NO unified model selection UI currently in `lama.ui`** - it only provides base components (buttons, cards, inputs).

---

## 1. Current State: Where Model Selection Lives

### 1.1 Primary Implementation Locations

**Electron Platform (lama.cube)**
- **Location**: `/Users/gecko/src/lama/lama.cube/electron-ui/src/components/ModelOnboarding.tsx`
- **Type**: Platform-specific React component
- **Status**: Full implementation with download support
- **Dependencies**: Local (platform-specific)
- **Uses**: IPC via `lamaBridge.setDefaultModel()`

**Browser Platform (lama.browser)**
- **Location**: `/Users/gecko/src/lama/lama.browser/browser-ui/src/components/ModelOnboarding.tsx`
- **Type**: Platform-agnostic React component
- **Status**: Full implementation with API key input
- **Dependencies**: Uses `@lama/ui` shared components
- **Uses**: Direct Model instance via context

**Shared UI Components (lama.ui)**
- **Location**: `/Users/gecko/src/lama/lama.ui/src/components/`
- **Base Components Only**:
  - `ui/button.tsx` - Button component
  - `ui/card.tsx` - Card/CardHeader/CardContent/CardTitle/CardDescription
  - `ui/input.tsx` - Text input
  - `ui/checkbox.tsx` - Checkbox
  - `ui/dropdown-menu.tsx` - Dropdown menu
  - `ui/label.tsx` - Label
  - `ui/textarea.tsx` - Textarea
  - `ui/progress.tsx` - Progress bar
  - `ui/badge.tsx` - Badge component
  - `ui/alert-dialog.tsx` - Alert dialog
  - `ui/alert.tsx` - Alert
- **NO model selection components yet**

---

## 2. Model Selection Implementations

### 2.1 ModelOnboarding Component (Electron)

**File**: `/Users/gecko/src/lama/lama.cube/electron-ui/src/components/ModelOnboarding.tsx`

**Features**:
- Detects running Ollama server automatically
- Lists local Ollama models with checkboxes
- Multi-select local models capability
- Model download UI (HuggingFace integration)
- Model type indication (Ollama, local download)
- Progress tracking for downloads
- "Skip for now" option to proceed without model setup

**Key Functions**:
```typescript
- checkOllamaAvailability() - Detects if Ollama is running
- toggleModelSelection() - Checkbox state for multi-select
- handleLoadSelectedModels() - Load multiple Ollama models
- handleModelSelect() - Single model selection with download
- handleModelReady() - Set as default model via IPC
```

**IPC Communication**:
```typescript
await lamaBridge.setDefaultModel(modelId)
```

**State Management**:
- `selectedModels: Set<string>` - Multi-select for Ollama
- `selectedModel: string | null` - Single selection for downloads
- `isDownloading: boolean` - Download in progress
- `downloadProgress: number` - Download percentage
- `ollamaModels: OllamaModelInfo[]` - Available local models

---

### 2.2 ModelOnboarding Component (Browser)

**File**: `/Users/gecko/src/lama/lama.browser/browser-ui/src/components/ModelOnboarding.tsx`

**Features**:
- Same Ollama detection and multi-select as Electron
- API key input for cloud models (Anthropic, OpenAI, DeepSeek, Qwen)
- Privacy notices for local vs cloud models
- Cloud API model selection with provider links
- Local model download support
- Ollama server URL configuration (expandable)
- CORS configuration guidance

**Key Differences from Electron**:
- Includes 11 cloud API models pre-configured with links
- API key input with provider-specific guidance
- Collapsible Ollama server configuration section
- Privacy/data sharing warnings

**Cloud Models Included**:
```typescript
// Anthropic
- Claude Sonnet 4.5
- Claude Opus 4.1
- Claude Haiku 4.5

// OpenAI
- GPT-5
- GPT-4.1
- o3-mini
- GPT-4.1 Mini

// DeepSeek
- DeepSeek V3.2
- DeepSeek R1

// Qwen
- Qwen3 Max
- Qwen Plus
```

**IPC Communication** (via Model instance, NOT Electron bridge):
```typescript
await model.llmConfigPlan.setConfig({
  modelType: apiKeyValue ? 'remote' : 'local',
  modelName: modelId,
  setAsActive: true
})

// Optional: Save API key
await model.llmConfigPlan.updateApiKey({
  llmId: response.configHash,
  apiKey: apiKeyValue
})

// Create default chats
await model.aiAssistantPlan.setDefaultModel(modelId)
```

**State Management**:
- `selectedModels: Set<string>` - Multi-select Ollama models
- `selectedModel: string | null` - Single selection
- `showApiKeyInput: boolean` - API key form visibility
- `selectedApiModel: ModelOption | null` - Current API model
- `apiKey: string` - API key input value
- `ollamaServerUrl: string` - Custom Ollama server URL
- `showOllamaConfig: boolean` - Config section visibility

---

### 2.3 LLMSettings Component (Browser Settings)

**File**: `/Users/gecko/src/lama/lama.browser/browser-ui/src/components/Settings/LLMSettings.tsx`

**Purpose**: Manage configured LLM models after onboarding

**Features**:
- List all configured LLM objects
- Expand/collapse each LLM for editing
- System prompt editing and saving
- System prompt regeneration
- API key management (encrypted)
- Status indicators (Active, Unsaved)
- Provider badges
- Timestamps (created/modified)

**Key Functions**:
```typescript
- loadLLMConfigs() - Fetch all configured LLMs
- toggleExpand() - Expand/collapse sections
- handlePromptEdit() - Edit system prompt
- handleSavePrompt() - Save to ONE.core
- handleRegeneratePrompt() - Reset to default
- handleApiKeyEdit() - Edit API key
- handleSaveApiKey() - Save encrypted API key
- needsApiKey() - Check if provider needs key
```

**Data Flow**:
```typescript
// Load LLM configs
const configs = await model.llmConfigPlan.getAllConfigs()

// Update system prompt
await model.llmConfigPlan.updateSystemPrompt({
  llmId,
  systemPrompt: newPrompt
})

// Regenerate default prompt
const result = await model.llmConfigPlan.regenerateSystemPrompt({ llmId })

// Save API key
await model.llmConfigPlan.updateApiKey({
  llmId,
  apiKey
})
```

**UI Structure**:
- Card per LLM with header and expandable content
- Model name, provider badge, active status
- API key input (password field, encrypted)
- System prompt textarea (monospace font)
- Buttons: Regenerate, Save Changes, Save API Key
- Timestamps and unsaved indicators

---

## 3. Underlying Business Logic

### 3.1 LLMConfigPlan (lama.core)

**Location**: Not directly shown but inferred from usage

**IPC Handlers** (lama.cube):
- `handleTestOllamaConnection()` - Test connectivity to Ollama
- `handleSetOllamaConfig()` - Save Ollama configuration
- `handleGetOllamaConfig()` - Retrieve active Ollama config
- `handleGetAvailableModels()` - Fetch models from Ollama
- `handleDeleteOllamaConfig()` - Soft-delete configuration

**Core Methods Used**:
```typescript
// Browser: Direct Model instance
model.llmConfigPlan.setConfig({})
model.llmConfigPlan.updateApiKey({})
model.llmConfigPlan.getAllConfigs()
model.llmConfigPlan.updateSystemPrompt({})
model.llmConfigPlan.regenerateSystemPrompt({})

// Electron: Via IPC Bridge
lamaBridge.setDefaultModel(modelId)
```

---

### 3.2 LLMManager (lama.core/services)

**Location**: `/Users/gecko/src/lama/lama.core/services/llm-manager.ts`

**Key Responsibilities**:
- Register models from multiple providers (Ollama, Claude, LM Studio)
- Manage model discovery and initialization
- Handle chat operations with provider-specific logic
- MCP (Model Context Protocol) server management
- System prompt building and enhancement
- API key injection from UserSettingsManager

**Model Discovery**:
```typescript
// Ollama models
async discoverOllamaModels()
  → getLocalOllamaModels()
  → parseOllamaModel()
  → register as `ollama:modelname`

// Claude models
async discoverClaudeModels(providedApiKey?)
  → Fetch from Anthropic API
  → register as `claude:claude-3-5-sonnet-20241022`

// LM Studio models
async registerModels()
  → lmstudio.isLMStudioRunning()
  → lmstudio.getAvailableModels()
  → register as `lmstudio:modelid`
```

**Model Format**:
```typescript
{
  id: 'ollama:llama3.2:latest',
  name: 'Llama 3.2 (8B)',
  provider: 'ollama',
  description: 'Description...',
  capabilities: ['chat', 'completion'],
  contextLength: 8192,
  parameters: {
    modelName: 'llama3.2:latest',
    temperature: 0.7,
    maxTokens: 1024
  }
}
```

---

### 3.3 Platform Abstraction

**File**: `/Users/gecko/src/lama/lama.core/services/llm-platform.ts`

**Purpose**: Decouple platform-specific operations from platform-agnostic core

**Interface**:
```typescript
export interface LLMPlatform {
  emitProgress(topicId: string, progress: number): void
  emitError(topicId: string, error: Error): void
  emitMessageUpdate(topicId, messageId, content, status): void
  startMCPServer?(modelId, config): Promise<void>
  stopMCPServer?(modelId): Promise<void>
  readModelFile?(path): Promise<Buffer>
  emitAnalysisUpdate?(topicId, analysisType): void
  emitThinkingStatus?(topicId, status): void
  emitThinkingUpdate?(topicId, messageId, thinkingContent): void
}
```

**Implementations**:
- **Browser**: `/Users/gecko/src/lama/lama.browser/adapters/browser-llm-platform.ts`
  - Uses postMessage/events for communication
  - No MCP server support (browser limitation)
  - No model file reading
  
- **Electron**: (Implicit - handled via IPC and event emission)

---

## 4. Type System & Interfaces

### 4.1 Model Selection Types

**Browser (ModelOnboarding)**:
```typescript
interface ModelOption {
  id: string
  name: string
  size: string
  description: string
  requiresDownload: boolean
  apiKey?: boolean
  provider?: string
}
```

**Ollama Models**:
```typescript
interface OllamaModelInfo {
  id: string              // e.g., 'ollama:llama3.2:latest'
  name: string            // e.g., 'llama3.2'
  displayName: string     // e.g., 'Llama 3.2 (8B)'
  size: string            // e.g., '4.7 GB'
  parameterSize: string   // e.g., '8B'
  description: string
  capabilities: string[]  // ['chat', 'code', etc.]
  sizeBytes: number       // For sorting
}
```

**LLM Settings**:
```typescript
interface LLMConfig {
  id: string                    // Hash ID
  modelId: string               // 'ollama:llama3', 'claude:claude-3-5-sonnet'
  modelName: string             // Display name
  provider: string              // 'ollama', 'anthropic', etc.
  systemPrompt?: string         // Custom or default
  active: boolean               // Currently selected
  created: number               // Timestamp
  modified: number              // Timestamp
  encryptedApiKey?: string      // Exists flag only
}
```

---

## 5. Current Architecture Analysis

### 5.1 Platform-Specific Implementation (Current)

```
lama.ui/
├── ui/ (Base components only)
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   └── ... (other primitives)
└── (NO model selection components)

lama.cube/electron-ui/
└── components/
    └── ModelOnboarding.tsx ← Platform-specific (IPC via lamaBridge)

lama.browser/browser-ui/
├── components/
│   ├── ModelOnboarding.tsx ← Uses lama.ui + Model instance
│   └── Settings/LLMSettings.tsx ← Uses lama.ui + Model instance
└── services/
    └── (Ollama API calls via fetch)
```

### 5.2 Dependency Flow

**Electron (Thick Desktop)**:
```
ModelOnboarding.tsx
  ↓ (IPC)
lamaBridge.setDefaultModel()
  ↓ (IPC)
lama.cube/main/ipc/plans/llm-config.ts
  ↓
lama.core/plans/LLMConfigPlan.ts
  ↓
lama.core/services/LLMManager.ts
```

**Browser (Web)**:
```
ModelOnboarding.tsx
  ↓ (Direct instance)
Model.llmConfigPlan
  ↓
lama.core/plans/LLMConfigPlan.ts
  ↓
lama.core/services/LLMManager.ts
```

---

## 6. Migration Approach & Recommendations

### 6.1 What Should Move to lama.ui

**High Priority** - Shared model selection:
1. **ModelSelector** component
   - Multi-select with checkboxes for local models
   - Single select for API models
   - Model cards with provider/size/description
   - Status indicators (Active, Loading, etc.)

2. **ModelOnboarding** component (generic)
   - Ollama detection section
   - Cloud API section
   - Local download section
   - API key input
   - Privacy notices

3. **LLMSettings** component (view/edit configs)
   - List configured LLMs
   - Expand/collapse details
   - System prompt editor
   - API key manager

4. **Supporting Components**:
   - `ModelCard.tsx` - Individual model display
   - `OllamaServerConfig.tsx` - Ollama URL configuration
   - `ApiKeyInput.tsx` - Secure API key field
   - `SystemPromptEditor.tsx` - Prompt textarea with actions

### 6.2 What Should Stay Platform-Specific

**Low Priority** - Platform details:
1. Download manager (Electron specific)
2. File system operations (Electron specific)
3. IPC bridge communication (Electron specific)
4. Native module integration (React Native specific)

### 6.3 Integration Points

**Browser → lama.ui dependency**:
- Replace `@/components/ModelOnboarding.tsx`
- Use: `import { ModelOnboarding } from '@lama/ui`
- Pass: `Model` instance via props

**Electron → lama.ui dependency**:
- Extract IPC logic to separate hooks
- Replace component imports from local to `@lama/ui`
- Keep local: Download manager, file system helpers

---

## 7. Current Feature Gaps

### 7.1 Missing in Shared Layer

- [ ] No unified ModelSelector in lama.ui
- [ ] No ModelOnboarding exported from lama.ui
- [ ] No LLMSettings in lama.ui
- [ ] No platform-agnostic download manager
- [ ] No model discovery status component
- [ ] No API key validation UI

### 7.2 Inconsistencies Between Platforms

| Feature | Electron | Browser |
|---------|----------|---------|
| Cloud models list | No | Yes (11 models) |
| API key input | No | Yes |
| Ollama config UI | No | Yes (expandable) |
| Server URL config | No | Yes |
| Multi-select Ollama | Yes | Yes |
| Download UI | Yes (HuggingFace) | No (reference only) |
| Privacy notices | Implicit | Explicit |

---

## 8. File Locations Summary

### Model Selection UI
```
lama.cube/electron-ui/src/components/ModelOnboarding.tsx (1,174 lines)
lama.browser/browser-ui/src/components/ModelOnboarding.tsx (923 lines)
lama.browser/browser-ui/src/components/Settings/LLMSettings.tsx (403 lines)
```

### Base Components (lama.ui)
```
lama.ui/src/components/ui/button.tsx
lama.ui/src/components/ui/card.tsx
lama.ui/src/components/ui/input.tsx
lama.ui/src/components/ui/checkbox.tsx
lama.ui/src/components/ui/textarea.tsx
lama.ui/src/components/ui/badge.tsx
lama.ui/src/components/ui/alert.tsx
lama.ui/src/components/ui/dropdown-menu.tsx
lama.ui/src/components/ui/label.tsx
lama.ui/src/components/ui/progress.tsx
```

### Core Services
```
lama.core/services/llm-manager.ts (1,176 lines)
lama.core/services/llm-platform.ts (107 lines)
lama.browser/adapters/browser-llm-platform.ts (102 lines)
lama.browser/adapters/browser-llm-config.ts (131 lines)
```

### IPC Handlers (Electron)
```
lama.cube/dist/main/ipc/plans/llm-config.d.ts (type definitions)
lama.cube/main/ipc/plans/llm-config.ts (actual handlers)
```

---

## 9. Suggested Refactoring Path

### Phase 1: Extract Shared Components
1. Create `lama.ui/src/components/ModelOnboarding/`
2. Extract generic ModelOnboarding component
3. Extract ModelCard, ApiKeyInput, SystemPromptEditor
4. Extract LLMSettings component
5. Keep platform adapters in their respective locations

### Phase 2: Implement Platform-Specific Adapters
1. Create hooks for IPC communication (Electron)
2. Create hooks for direct Model instance (Browser)
3. Wrap shared components with adapter logic
4. Keep download/file system in platform layers

### Phase 3: Consolidate to Single Source
1. Browser: Import from `@lama/ui`
2. Electron: Import from `@lama/ui`
3. Remove platform-specific duplicates
4. Use context/props for platform differences

---

## Summary Table: Component Distribution

| Component | lama.cube | lama.browser | lama.ui | Status |
|-----------|-----------|--------------|---------|--------|
| ModelOnboarding | ✓ | ✓ | ✗ | Duplicate |
| LLMSettings | ✗ | ✓ | ✗ | Browser-only |
| ModelCard | ✗ | ✗ | ✗ | Missing |
| ApiKeyInput | ✗ | ✗ | ✗ | Missing |
| SystemPromptEditor | ✗ | ✗ | ✗ | Missing |
| Base UI Components | ✗ | ✗ | ✓ | Implemented |

