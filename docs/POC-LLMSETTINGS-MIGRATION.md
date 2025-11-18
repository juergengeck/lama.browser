# POC: LLMSettings Migration to Plans Context

This document shows the proof-of-concept migration of LLMSettings from platform-specific (using `useModel()`) to platform-agnostic (using `usePlans()`).

## Current State

### lama.browser/browser-ui/src/components/Settings/LLMSettings.tsx (Platform-Specific)

```typescript
import { useModel } from '@/model/ModelContext'

export function LLMSettings() {
  const model = useModel()  // ← Platform-specific!

  const loadLLMConfigs = async () => {
    const configs = await model.llmConfigPlan.getAllConfigs()  // ← Direct Model access
    setLlmConfigs(configs || [])
  }

  const handleSavePrompt = async (llmId: string) => {
    await model.llmConfigPlan.updateSystemPrompt({ llmId, systemPrompt })  // ← Direct Model access
  }

  // ... more methods using model.llmConfigPlan
}
```

**Problems**:
- ✗ Depends on `useModel()` hook (browser-specific)
- ✗ Direct access to `model.llmConfigPlan`
- ✗ Can't be used in lama.cube or lama.thin

## Target State

### lama.ui/src/components/llm/LLMSettings.tsx (Platform-Agnostic)

```typescript
import { usePlans } from '../../contexts/PlansContext'

export function LLMSettings() {
  const { llmConfig } = usePlans()  // ← Platform-agnostic!

  const loadLLMConfigs = async () => {
    const configs = await llmConfig.getAllConfigs()  // ← Uses Plan interface
    setLlmConfigs(configs || [])
  }

  const handleSavePrompt = async (llmId: string) => {
    await llmConfig.updateSystemPrompt({ llmId, systemPrompt })  // ← Uses Plan interface
  }

  // ... more methods using llmConfig
}
```

**Benefits**:
- ✓ Uses `usePlans()` hook (platform-agnostic)
- ✓ Access via destructured `llmConfig`
- ✓ Works in lama.browser, lama.cube, lama.thin

## Migration Steps

### Step 1: Update lama.browser to provide Plans via context

**File**: `lama.browser/browser-ui/src/App.tsx`

```typescript
// Add imports
import { PlansProvider, type LAMAPlans } from '@lama/ui'
import { useModel } from '@/model/ModelContext'

function App() {
  const model = useModel()

  // Map Model to LAMAPlans interface
  const plans: LAMAPlans = {
    ai: model.aiPlan,
    aiAssistant: model.aiAssistantPlan,
    topicAnalysis: model.topicAnalysisPlan,
    proposals: model.proposalsPlan,
    keywordDetail: model.keywordDetailPlan,
    wordCloudSettings: model.wordCloudSettingsPlan,
    llmConfig: model.llmConfigPlan,  // ← This Plan is what LLMSettings needs
    crypto: model.cryptoPlan,
    audit: model.auditPlan,
    chat: model.chatPlan,
    contacts: model.contactsPlan,
    export: model.exportPlan,
    feedForward: model.feedForwardPlan,
    connection: model.connectionPlan
  }

  return (
    <PlansProvider plans={plans}>
      {/* Existing app content */}
      <SettingsView />
    </PlansProvider>
  )
}
```

### Step 2: Update LLMSettings to use Plans context

**File**: `lama.browser/browser-ui/src/components/Settings/LLMSettings.tsx`

**Before**:
```typescript
import { useModel } from '@/model/ModelContext'

export function LLMSettings() {
  const model = useModel()
  // ... uses model.llmConfigPlan
}
```

**After**:
```typescript
import { usePlans } from '@lama/ui'  // ← Changed import

export function LLMSettings() {
  const { llmConfig } = usePlans()  // ← Changed hook + destructure
  // ... uses llmConfig (instead of model.llmConfigPlan)
}
```

**Detailed changes**:
```diff
- import { useModel } from '@/model/ModelContext'
+ import { usePlans } from '@lama/ui'

  export function LLMSettings() {
-   const model = useModel()
+   const { llmConfig } = usePlans()

    const loadLLMConfigs = async () => {
-     const configs = await model.llmConfigPlan.getAllConfigs()
+     const configs = await llmConfig.getAllConfigs()
      setLlmConfigs(configs || [])
    }

    const handleSavePrompt = async (llmId: string) => {
-     await model.llmConfigPlan.updateSystemPrompt({ llmId, systemPrompt })
+     await llmConfig.updateSystemPrompt({ llmId, systemPrompt })
    }

    const handleRegeneratePrompt = async (llmId: string) => {
-     const result = await model.llmConfigPlan.regenerateSystemPrompt({ llmId })
+     const result = await llmConfig.regenerateSystemPrompt({ llmId })
    }

    const handleSaveApiKey = async (llmId: string) => {
-     await model.llmConfigPlan.updateApiKey({ llmId, apiKey })
+     await llmConfig.updateApiKey({ llmId, apiKey })
    }
  }
```

### Step 3: Test in lama.browser

1. Build lama.ui:
```bash
cd lama.ui
npm run build
```

2. Start lama.browser:
```bash
cd ../lama.browser/browser-ui
npm run dev
```

3. Navigate to Settings → LLM Configuration
4. Verify:
   - [ ] LLM configs load correctly
   - [ ] System prompt editing works
   - [ ] API key saving works
   - [ ] Regenerate prompt works
   - [ ] No console errors

### Step 4: Prepare for lama.cube integration

Once verified in lama.browser, lama.cube can use the SAME component:

**File**: `lama.cube/electron-ui/src/App.tsx`

```typescript
import { PlansProvider, LLMSettings, type LAMAPlans } from '@lama/ui'

function App() {
  // Create IPC-wrapped Plans that match Plan interfaces
  const plans: LAMAPlans = {
    llmConfig: {
      getAllConfigs: () => window.electronAPI.invoke('llmConfig:getAllConfigs'),
      updateSystemPrompt: (params) => window.electronAPI.invoke('llmConfig:updateSystemPrompt', params),
      regenerateSystemPrompt: (params) => window.electronAPI.invoke('llmConfig:regenerateSystemPrompt', params),
      updateApiKey: (params) => window.electronAPI.invoke('llmConfig:updateApiKey', params),
      testConnection: (params) => window.electronAPI.invoke('llmConfig:testConnection', params),
      getAvailableModels: (params) => window.electronAPI.invoke('llmConfig:getAvailableModels', params),
      setConfig: (params) => window.electronAPI.invoke('llmConfig:setConfig', params),
    },
    // ... other plans (wrap with IPC)
  }

  return (
    <PlansProvider plans={plans}>
      <LLMSettings />  {/* ← Same component works! */}
    </PlansProvider>
  )
}
```

## Success Criteria

✅ **LLMSettings uses `usePlans()` instead of `useModel()`**
✅ **All functionality works in lama.browser (no regressions)**
✅ **Component is now in lama.ui (shared package)**
✅ **lama.browser imports from `@lama/ui`**
✅ **Ready for lama.cube integration (same component)**

## Next Components to Migrate

After LLMSettings POC is validated, migrate these in order:

1. **MCPSettings** - MCP server configuration
2. **KeywordLineSettings** - Keyword line configuration
3. **KeywordSettingsPage** - Keyword management
4. **ContactsView** - Contact list (uses `contacts` Plan)
5. **ChatView** - Chat interface (uses `chat` Plan)
6. **ProposalCard** - Already in lama.ui, just needs Plans context
7. **TopicSummary** - Already in lama.ui, just needs Plans context

Each migration follows the same pattern:
1. Replace `useModel()` with `usePlans()`
2. Destructure the needed Plans
3. Replace `model.xxxPlan` with just `xxx`

## Timeline

- **Day 1**: Complete LLMSettings POC (this document)
- **Day 2**: Test and validate in lama.browser
- **Day 3-5**: Migrate 5 more components using same pattern
- **Day 6-7**: Test all migrated components
- **Week 2**: Integrate lama.cube (create IPC wrappers)
- **Week 3**: Test lama.cube, verify feature parity

## Notes

- The lama.ui version already exists and uses the right pattern (props-based)
- The lama.browser version uses `useModel()`
- We're migrating lama.browser to use the lama.ui version
- This creates a single source of truth for all platforms
