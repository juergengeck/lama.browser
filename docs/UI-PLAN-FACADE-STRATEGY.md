# LAMA UI Plan Facade Strategy

**KEY INSIGHT**: Plans from lama.core/chat.core/connection.core ARE the facade. No new abstraction needed!

## The Pattern We Already Have

### lama.core Plans (Platform-Agnostic)
Plans are already designed with dependency injection:

```typescript
// lama.core/plans/LLMConfigPlan.ts
export class LLMConfigPlan {
  constructor(nodeOneCore, aiAssistantModel, ollamaValidator, configManager) {
    // Platform dependencies injected
  }

  async getAllConfigs() { /* pure business logic */ }
  async updateSystemPrompt(params) { /* pure business logic */ }
}
```

### Platform Integration (Already Works)

**lama.browser**:
```typescript
// Model.ts line 238
this.llmConfigPlan = new LLMConfigPlan(
  this,                      // nodeOneCore
  this.aiAssistantPlan,      // aiAssistantModel
  browserOllamaValidator,    // platform adapter
  browserConfigManager       // platform adapter
);
```

**lama.cube** (Electron):
```typescript
// main/core/node-one-core.ts
this.llmConfigPlan = new LLMConfigPlan(
  this,                      // nodeOneCore
  this.aiAssistantPlan,      // aiAssistantModel
  electronOllamaValidator,   // platform adapter
  electronConfigManager      // platform adapter
);
```

### UI Components (Already Using Plans)

**lama.browser** (current):
```typescript
import { useModel } from '@/model/ModelContext'

export function LLMSettings() {
  const model = useModel()
  const configs = await model.llmConfigPlan.getAllConfigs()
  // Uses Plan directly - this IS the facade!
}
```

**lama.ui** (target - SAME code, different context):
```typescript
import { usePlans } from '@lama/ui/contexts/PlansContext'

export function LLMSettings() {
  const plans = usePlans()
  const configs = await plans.llmConfig.getAllConfigs()
  // Uses Plan directly - this IS the facade!
}
```

---

## The Real Migration Strategy

### What We Actually Have

The **Model class is just a Plan container**:

```typescript
// lama.browser/browser-ui/src/model/Model.ts
export default class Model {
  // ONE.core models
  public leuteModel: LeuteModel
  public channelManager: ChannelManager
  public topicModel: TopicModel
  public connections: ConnectionsModel

  // Plans (THE FACADE)
  public aiPlan: AIPlan
  public aiAssistantPlan: AIAssistantPlan
  public topicAnalysisPlan: TopicAnalysisPlan
  public proposalsPlan: ProposalsPlan
  public keywordDetailPlan: KeywordDetailPlan
  public wordCloudSettingsPlan: WordCloudSettingsPlan
  public llmConfigPlan: LLMConfigPlan
  public cryptoPlan: CryptoPlan
  public auditPlan: AuditPlan
  public chatPlan: ChatPlan
  public contactsPlan: ContactsPlan
  public exportPlan: ExportPlan
  public feedForwardPlan: FeedForwardPlan
  public connectionPlan: ConnectionPlan
}
```

### What We Need

**A Plans interface** (not a new facade, just the existing Plan types):

```typescript
// lama.ui/src/types/plans.ts
import type { AIPlan } from '@lama/core/plans/AIPlan'
import type { AIAssistantPlan } from '@lama/core/plans/AIAssistantPlan'
import type { TopicAnalysisPlan } from '@lama/core/plans/TopicAnalysisPlan'
import type { ProposalsPlan } from '@lama/core/plans/ProposalsPlan'
import type { KeywordDetailPlan } from '@lama/core/plans/KeywordDetailPlan'
import type { WordCloudSettingsPlan } from '@lama/core/plans/WordCloudSettingsPlan'
import type { LLMConfigPlan } from '@lama/core/plans/LLMConfigPlan'
import type { CryptoPlan } from '@lama/core/plans/CryptoPlan'
import type { AuditPlan } from '@lama/core/plans/AuditPlan'
import type { ChatPlan } from '@chat/core/plans/ChatPlan'
import type { ContactsPlan } from '@chat/core/plans/ContactsPlan'
import type { ExportPlan } from '@chat/core/plans/ExportPlan'
import type { FeedForwardPlan } from '@chat/core/plans/FeedForwardPlan'
import type { ConnectionPlan } from '@connection/core/plans/ConnectionPlan'

/**
 * Complete Plans interface for UI components.
 * This is NOT a new abstraction - these are the actual Plan classes from *.core packages.
 */
export interface LAMAPlans {
  // AI Plans
  ai: AIPlan
  aiAssistant: AIAssistantPlan
  topicAnalysis: TopicAnalysisPlan
  proposals: ProposalsPlan
  keywordDetail: KeywordDetailPlan
  wordCloudSettings: WordCloudSettingsPlan
  llmConfig: LLMConfigPlan
  crypto: CryptoPlan
  audit: AuditPlan

  // Chat Plans
  chat: ChatPlan
  contacts: ContactsPlan
  export: ExportPlan
  feedForward: FeedForwardPlan

  // Connection Plans
  connection: ConnectionPlan
}
```

---

## The Simplified Migration

### Step 1: Create PlansContext (1 day)

**lama.ui/src/contexts/PlansContext.tsx**:
```typescript
import { createContext, useContext } from 'react'
import type { LAMAPlans } from '../types/plans'

const PlansContext = createContext<LAMAPlans | null>(null)

export function PlansProvider({ plans, children }: {
  plans: LAMAPlans
  children: React.ReactNode
}) {
  return (
    <PlansContext.Provider value={plans}>
      {children}
    </PlansContext.Provider>
  )
}

export function usePlans(): LAMAPlans {
  const plans = useContext(PlansContext)
  if (!plans) {
    throw new Error('usePlans must be used within PlansProvider')
  }
  return plans
}
```

### Step 2: Platform Integration (1 day)

**lama.browser** - Map Model to LAMAPlans:
```typescript
// browser-ui/src/App.tsx
import { PlansProvider } from '@lama/ui'
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
    llmConfig: model.llmConfigPlan,
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
      {/* All lama.ui components work here */}
    </PlansProvider>
  )
}
```

**lama.cube** - Plans exposed via IPC wrapper:
```typescript
// electron-ui/src/App.tsx
import { PlansProvider } from '@lama/ui'

function App() {
  // Create IPC-wrapped plans that match Plan interfaces
  const plans: LAMAPlans = {
    llmConfig: {
      getAllConfigs: () => window.electronAPI.invoke('llmConfig:getAll'),
      updateSystemPrompt: (params) => window.electronAPI.invoke('llmConfig:updatePrompt', params),
      // ... wrap all Plan methods with IPC calls
    },
    chat: {
      sendMessage: (params) => window.electronAPI.invoke('chat:sendMessage', params),
      // ... wrap all Plan methods
    },
    // ... etc for all plans
  }

  return (
    <PlansProvider plans={plans}>
      {/* Same lama.ui components work here */}
    </PlansProvider>
  )
}
```

### Step 3: Update Components (5 days)

**Before**:
```typescript
import { useModel } from '@/model/ModelContext'

export function LLMSettings() {
  const model = useModel()
  const configs = await model.llmConfigPlan.getAllConfigs()
}
```

**After**:
```typescript
import { usePlans } from '@lama/ui/contexts/PlansContext'

export function LLMSettings() {
  const { llmConfig } = usePlans()
  const configs = await llmConfig.getAllConfigs()
}
```

**That's it!** Just change the hook and destructure.

---

## Why This Works

### 1. Plans Are Already The Facade
- Plans from lama.core/chat.core are platform-agnostic business logic
- They use dependency injection (adapters passed to constructor)
- They expose clean interfaces (async methods returning data)

### 2. No New Abstraction Layer
- We're not creating wrappers around Plans
- We're not duplicating Plan interfaces
- We're just organizing Plan access via React Context

### 3. Platform Adapters Already Exist
- **lama.browser**: browserOllamaValidator, browserConfigManager
- **lama.cube**: electronOllamaValidator, electronConfigManager
- These are passed to Plan constructors, not to UI components

### 4. Type Safety Is Built-In
- Plans have TypeScript interfaces already
- `LAMAPlans` interface just groups them
- TypeScript compiler enforces compatibility

---

## What About Platform-Specific Features?

Some features only exist on certain platforms (e.g., browser storage quota).

### Solution: Optional Plans

```typescript
export interface LAMAPlans {
  // Core Plans (all platforms)
  llmConfig: LLMConfigPlan
  chat: ChatPlan
  // ... etc

  // Optional Plans (platform-specific)
  storage?: StoragePlan       // Browser only
  subscription?: SubscriptionPlan  // Browser only
  filesystem?: FilesystemPlan // Electron only
}
```

**Component usage**:
```typescript
export function SettingsView() {
  const plans = usePlans()

  return (
    <>
      {/* Shared settings */}
      <LLMSettings llmConfig={plans.llmConfig} />

      {/* Platform-specific settings */}
      {plans.storage && <StorageQuota storage={plans.storage} />}
      {plans.subscription && <SubscriptionSettings subscription={plans.subscription} />}
    </>
  )
}
```

---

## Migration Timeline (Revised)

### Week 1: Setup
**Day 1**: Create PlansContext and LAMAPlans interface
**Day 2**: Integrate PlansProvider in lama.browser (map Model to LAMAPlans)
**Day 3**: Update 10 components to use `usePlans()` (POC)
**Day 4-5**: Test POC components, refine approach

### Week 2: Component Migration
**Day 6-10**: Update all remaining components to use `usePlans()`
- Systematic refactoring (1-2 hours per component)
- Test each component after update
- Keep lama.browser working throughout

### Week 3: Platform Integration
**Day 11-12**: Create IPC-wrapped Plans for lama.cube
**Day 13**: Integrate PlansProvider in lama.cube
**Day 14-15**: Test all features in lama.cube, fix issues

**Total: 3 weeks** (same as wholesale approach, but simpler)

---

## Comparison: New Facade vs Plans Facade

| Aspect | New UIOperations Interface | Using Existing Plans |
|--------|---------------------------|---------------------|
| **Abstraction** | New interface + wrappers | Use what exists |
| **Duplication** | Plans + UIOperations | Just Plans |
| **Type Safety** | Manual interface sync | Built-in (TypeScript) |
| **Maintenance** | Two places to update | One place (Plans) |
| **Complexity** | Higher (extra layer) | Lower (direct usage) |
| **Migration Time** | 3-4 weeks | 2-3 weeks |
| **Performance** | Wrapper overhead | Direct calls |

---

## Implementation Example

### Component Before (lama.browser specific):
```typescript
// lama.browser/browser-ui/src/components/Settings/LLMSettings.tsx
import { useModel } from '@/model/ModelContext'

export function LLMSettings() {
  const model = useModel()
  const [configs, setConfigs] = useState([])

  useEffect(() => {
    model.llmConfigPlan.getAllConfigs().then(setConfigs)
  }, [])

  const handleSave = async (llmId, prompt) => {
    await model.llmConfigPlan.updateSystemPrompt({ llmId, systemPrompt: prompt })
  }

  return (/* UI */)
}
```

### Component After (platform-agnostic in lama.ui):
```typescript
// lama.ui/src/components/Settings/LLMSettings.tsx
import { usePlans } from '../../contexts/PlansContext'

export function LLMSettings() {
  const { llmConfig } = usePlans()  // ← Only change!
  const [configs, setConfigs] = useState([])

  useEffect(() => {
    llmConfig.getAllConfigs().then(setConfigs)
  }, [])

  const handleSave = async (llmId, prompt) => {
    await llmConfig.updateSystemPrompt({ llmId, systemPrompt: prompt })
  }

  return (/* UI */)
}
```

**Change**: Replace `useModel()` with `usePlans()`, destructure the Plan you need.

---

## Success Criteria

✅ **No new abstractions** - Use existing Plans as facade
✅ **Type-safe** - TypeScript enforces Plan interface compatibility
✅ **Simple migration** - Just change hook usage in components
✅ **Platform-agnostic** - Components don't know about platform differences
✅ **Fast** - 2-3 weeks total migration time
✅ **Maintainable** - Single source of truth (Plan interfaces)

---

## Next Steps

1. **Create `LAMAPlans` interface** - Group all Plan types
2. **Create `PlansContext` and `usePlans()` hook** - React context provider
3. **Update one component as POC** - Validate the approach
4. **Roll out to all components** - Systematic migration
5. **Create IPC wrappers for lama.cube** - Platform integration
6. **Test in both platforms** - Verify identical behavior

---

## Questions Resolved

**Q: What's the facade for the abstraction?**
**A**: Plans from lama.core/chat.core/connection.core ARE the facade. No new layer needed.

**Q: Can we use/extend our Plan interface?**
**A**: Yes! Plans already have clean interfaces. We just group them via `LAMAPlans` and provide via React Context.

**Q: What about platform-specific features?**
**A**: Use optional Plans in the interface (e.g., `storage?: StoragePlan`). Components check if Plan exists before using.
