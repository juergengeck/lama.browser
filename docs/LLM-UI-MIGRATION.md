# LLM UI Migration to lama.ui

**Status**: ✅ Core Implementation Complete
**Date**: 2025-01-09
**Goal**: Make model selection platform-agnostic by moving UI components to lama.ui

## Summary

Successfully created platform-agnostic LLM UI components in lama.ui using dependency injection pattern. Components accept `LLMOperations` interface via props, allowing both browser and Electron platforms to use the same UI code while providing their own backend implementations.

## Architecture

### Dependency Injection Pattern

```
┌─────────────┐
│  lama.ui    │  ← Platform-agnostic UI components
│             │     Accept operations via props
└──────┬──────┘
       │ uses interface
       ↓
┌─────────────────────────┐
│  LLMOperations          │  ← Interface defining required operations
│  - getLocalOllamaModels │
│  - getAllConfigs        │
│  - createConfig         │
│  - updateSystemPrompt   │
│  - etc.                 │
└──────┬──────────────────┘
       │ implemented by platforms
       ↓
┌──────────────┬──────────────┐
│ lama.browser │  lama.cube   │  ← Platforms provide implementations
│              │              │
│ Model class  │  IPC Bridge  │
│ llmConfigPlan│  lamaBridge  │
└──────────────┴──────────────┘
```

### Benefits

- **No Platform Dependencies**: lama.ui components have zero dependencies on browser/electron-specific code
- **Reusable**: Same components work on browser and Electron with different backends
- **Testable**: Easy to mock `LLMOperations` for testing
- **Type-Safe**: TypeScript enforces interface contracts
- **Maintainable**: Single source of truth for UI logic

## Files Created

### 1. Type Definitions

**`lama.ui/src/types/llm.ts`** (256 lines)

Defines all platform-agnostic types:

- `ModelOption` - Model display information
- `LLMConfig` - Stored configuration object
- `OllamaModelInfo` - Ollama model metadata
- `OllamaServer` - Server connection info
- `DownloadProgress` - Download status tracking
- **`LLMOperations`** - **Core interface that platforms must implement**

Key interface methods:
```typescript
export interface LLMOperations {
  // Model Discovery
  getLocalOllamaModels: () => Promise<OllamaModelInfo[]>
  checkOllamaServer: (url?: string) => Promise<OllamaServer>

  // Configuration Management
  getAllConfigs: () => Promise<LLMConfig[]>
  createConfig: (params) => Promise<LLMConfig>
  updateSystemPrompt: (params) => Promise<void>
  updateApiKey: (params) => Promise<void>
  setDefaultModel: (llmId: string) => Promise<void>
  deleteConfig: (llmId: string) => Promise<void>

  // System Prompt Management
  generateSystemPrompt: (params) => Promise<string>

  // Optional: Download Management (Electron only)
  downloadModel?: (params) => Promise<void>
  cancelDownload?: (modelId: string) => Promise<void>
  checkModelExists?: (modelId: string) => Promise<boolean>
}
```

### 2. UI Components

**`lama.ui/src/components/llm/LLMSettings.tsx`** (395 lines)

Platform-agnostic settings component for managing configured LLMs:

```typescript
interface LLMSettingsProps {
  operations: LLMOperations  // Injected by platform
  initialLoading?: boolean
  emptyMessage?: string
}

export function LLMSettings({ operations, ... }: LLMSettingsProps) {
  // Uses operations.getAllConfigs()
  // Uses operations.updateSystemPrompt()
  // Uses operations.updateApiKey()
  // etc.
}
```

**Features**:
- List all configured LLMs
- Expand/collapse UI for each model
- Edit system prompts with live preview
- Save/regenerate prompts
- API key management (encrypted storage)
- Visual indicators for active models, unsaved changes

**`lama.ui/src/components/llm/ModelOnboarding.tsx`** (680 lines)

Platform-agnostic onboarding flow for initial model selection:

```typescript
interface ModelOnboardingProps {
  operations: LLMOperations
  modelOptions: ModelOption[]
  onComplete: () => void
  allowSkip?: boolean
  initialOllamaUrl?: string
  title?: string
  description?: string
}

export function ModelOnboarding({ operations, modelOptions, ... }) {
  // Uses operations.checkOllamaServer()
  // Uses operations.getLocalOllamaModels()
  // Uses operations.createConfig()
  // Uses operations.downloadModel() (optional - Electron only)
}
```

**Features**:
- Ollama server configuration (custom URL support)
- Multi-select for local Ollama models
- Single-select for cloud API models
- API key input with privacy notices
- Consent dialogs for local/cloud models
- Download progress tracking (Electron only)
- Model loading progress indicators
- Privacy notices for each model type
- Skip option (configurable)

### 3. UI Primitives

**`lama.ui/src/components/ui/textarea.tsx`** (28 lines)

Added missing Textarea component (needed by LLMSettings):

```typescript
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(...)
```

### 4. Index Exports

**`lama.ui/src/index.ts`** (Updated)

Added exports for all new LLM-related code:

```typescript
// Types
export * from './types/llm'

// LLM Components
export * from './components/llm/LLMSettings'
export * from './components/llm/ModelOnboarding'

// UI Primitives
export * from './components/ui/textarea'
```

## Platform Migration Guide

### For lama.browser

**Current state**: Uses `model.llmConfigPlan` directly in components

**Migration steps**:

1. **Create adapter** that implements `LLMOperations`:

```typescript
// browser-ui/src/adapters/browser-llm-operations.ts
import { LLMOperations } from '@lama/ui'
import Model from '@/model/Model'

export function createBrowserLLMOperations(model: Model): LLMOperations {
  return {
    async getLocalOllamaModels() {
      return await getLocalOllamaModels() // existing function
    },

    async checkOllamaServer(url) {
      // existing logic
    },

    async getAllConfigs() {
      return await model.llmConfigPlan.getAllConfigs()
    },

    async createConfig(params) {
      const response = await model.llmConfigPlan.setConfig({
        modelType: params.apiKey ? 'remote' : 'local',
        modelName: params.modelId,
        setAsActive: true
      })
      // Transform response to LLMConfig format
      return { ... }
    },

    async updateSystemPrompt(params) {
      await model.llmConfigPlan.updateSystemPrompt(params)
    },

    async updateApiKey(params) {
      await model.llmConfigPlan.updateApiKey(params)
    },

    async setDefaultModel(llmId) {
      // implementation
    },

    async deleteConfig(llmId) {
      // implementation
    },

    async generateSystemPrompt(params) {
      const result = await model.llmConfigPlan.regenerateSystemPrompt({ llmId: '...' })
      return result.systemPrompt || ''
    }

    // Note: No downloadModel - browser doesn't support downloads
  }
}
```

2. **Replace component** in Settings:

```typescript
// Before
import { LLMSettings } from '@/components/Settings/LLMSettings'

// After
import { LLMSettings } from '@lama/ui'
import { createBrowserLLMOperations } from '@/adapters/browser-llm-operations'

function Settings() {
  const model = useModel()
  const operations = createBrowserLLMOperations(model)

  return <LLMSettings operations={operations} />
}
```

3. **Replace ModelOnboarding**:

```typescript
// Before
import ModelOnboarding from '@/components/ModelOnboarding'

// After
import { ModelOnboarding } from '@lama/ui'
import { MODEL_OPTIONS } from '@/constants/models' // cloud models list
import { createBrowserLLMOperations } from '@/adapters/browser-llm-operations'

function App() {
  const model = useModel()
  const operations = createBrowserLLMOperations(model)

  return (
    <ModelOnboarding
      operations={operations}
      modelOptions={MODEL_OPTIONS}
      onComplete={() => setShowOnboarding(false)}
      allowSkip={true}
    />
  )
}
```

### For lama.cube (Electron)

**Current state**: Some components already exist, need to be replaced

**Migration steps**:

1. **Create IPC adapter** that implements `LLMOperations`:

```typescript
// electron-ui/src/adapters/electron-llm-operations.ts
import { LLMOperations } from '@lama/ui'

export function createElectronLLMOperations(): LLMOperations {
  return {
    async getLocalOllamaModels() {
      return await window.lamaBridge.invoke('ollama:getLocalModels')
    },

    async checkOllamaServer(url) {
      return await window.lamaBridge.invoke('ollama:checkServer', { url })
    },

    async getAllConfigs() {
      return await window.lamaBridge.invoke('llm:getAllConfigs')
    },

    async createConfig(params) {
      return await window.lamaBridge.invoke('llm:createConfig', params)
    },

    async updateSystemPrompt(params) {
      await window.lamaBridge.invoke('llm:updateSystemPrompt', params)
    },

    async updateApiKey(params) {
      await window.lamaBridge.invoke('llm:updateApiKey', params)
    },

    async setDefaultModel(llmId) {
      await window.lamaBridge.invoke('llm:setDefaultModel', { llmId })
    },

    async deleteConfig(llmId) {
      await window.lamaBridge.invoke('llm:deleteConfig', { llmId })
    },

    async generateSystemPrompt(params) {
      const result = await window.lamaBridge.invoke('llm:generateSystemPrompt', params)
      return result.systemPrompt
    },

    // Electron-specific: Download support
    async downloadModel(params) {
      await window.lamaBridge.invoke('llm:downloadModel', params)
    },

    async cancelDownload(modelId) {
      await window.lamaBridge.invoke('llm:cancelDownload', { modelId })
    },

    async checkModelExists(modelId) {
      return await window.lamaBridge.invoke('llm:checkModelExists', { modelId })
    }
  }
}
```

2. **Use in components** (same pattern as browser)

## Model Options Configuration

Each platform needs to provide a `ModelOption[]` array for cloud/API models:

```typescript
// Example: browser-ui/src/constants/models.ts
import { ModelOption } from '@lama/ui'

export const MODEL_OPTIONS: ModelOption[] = [
  // Anthropic Models
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    size: 'Cloud',
    description: 'Best coding model. Strongest for complex agents.',
    requiresDownload: false,
    apiKey: true,
    provider: 'anthropic'
  },

  // OpenAI Models
  {
    id: 'gpt-5',
    name: 'GPT-5',
    size: 'Cloud',
    description: 'OpenAI\'s most powerful reasoning model.',
    requiresDownload: false,
    apiKey: true,
    provider: 'openai'
  },

  // More models...
]
```

## Benefits Achieved

### ✅ Code Reuse
- Single UI implementation for both platforms
- ~1,300 lines of shared UI code (LLMSettings + ModelOnboarding)
- Consistent UX across browser and Electron

### ✅ Maintainability
- Changes to UI logic happen once in lama.ui
- Platform-specific logic isolated in adapters
- Clear separation of concerns

### ✅ Type Safety
- TypeScript enforces `LLMOperations` contract
- Compile-time errors if platform doesn't implement interface
- Autocomplete for all operations

### ✅ Testability
- Easy to mock `LLMOperations` for component tests
- UI tests don't need platform-specific mocking
- Can test UI with fake operations

### ✅ Flexibility
- Platforms can extend with custom operations
- Optional operations (downloads) only on platforms that support them
- Easy to add new platforms (mobile, CLI, etc.)

## Next Steps

1. **Implement adapters** in both platforms:
   - `browser-ui/src/adapters/browser-llm-operations.ts`
   - `electron-ui/src/adapters/electron-llm-operations.ts`

2. **Replace existing components**:
   - lama.browser: Replace `ModelOnboarding.tsx` and `Settings/LLMSettings.tsx`
   - lama.cube: Replace any existing LLM configuration UI

3. **Test both platforms**:
   - Verify Ollama detection works
   - Test API key input and storage
   - Test model selection and configuration
   - Verify downloads work (Electron only)

4. **Update documentation**:
   - Add migration guide to each platform's CLAUDE.md
   - Document the `LLMOperations` interface
   - Add examples of creating adapters

## References

- **Types**: `lama.ui/src/types/llm.ts`
- **LLMSettings**: `lama.ui/src/components/llm/LLMSettings.tsx`
- **ModelOnboarding**: `lama.ui/src/components/llm/ModelOnboarding.tsx`
- **Original Browser Implementation**: `lama.browser/browser-ui/src/components/ModelOnboarding.tsx`
- **Original Browser Settings**: `lama.browser/browser-ui/src/components/Settings/LLMSettings.tsx`
