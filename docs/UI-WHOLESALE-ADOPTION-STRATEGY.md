# LAMA UI Wholesale Adoption Strategy

**REVISED APPROACH**: Use lama.browser UI as-is, refactor in-place for platform compatibility.

## Core Principle

**lama.browser is the canonical UI**. Other platforms (lama.cube, lama.thin) adopt the entire lama.browser UI structure, providing platform-specific adapters where needed.

## Why Wholesale Adoption?

### ❌ Old Approach Problems:
- Piecemeal migration takes 6-8 weeks
- Risk of missing components
- Duplication during transition
- Two sources of truth during migration

### ✅ New Approach Benefits:
- **Faster**: Days instead of weeks
- **Complete**: All components move together
- **Consistent**: Single UI codebase
- **Evolutionary**: Refactor components as needed, not upfront

---

## Implementation Strategy

### Step 1: Create Platform Adapter Layer

Each platform provides adapters that match the interfaces lama.browser components expect.

**File Structure**:
```
lama.ui/
├── src/
│   ├── components/        # All lama.browser components (wholesale copy)
│   ├── types/            # All lama.browser types
│   ├── hooks/            # All lama.browser hooks
│   ├── lib/              # All lama.browser utilities
│   └── index.ts          # Export everything
├── adapters/             # Platform-specific implementations
│   ├── browser.ts        # Browser platform (original)
│   ├── electron.ts       # Electron platform (lama.cube)
│   └── mobile.ts         # React Native platform (lama.thin)
```

### Step 2: Identify Adapter Requirements

Scan lama.browser components for platform-specific dependencies:

**Browser Storage** (IndexedDB):
- `Settings/StorageQuota.tsx`
- `Settings/DataCleanup.tsx`
- `StorageWarning.tsx`

**Model/Plan Access**:
- Most components use `useModel()` hook
- Hook returns `Model` instance with all Plans

**Session Storage**:
- `sessionStorage` service for ephemeral state

**Actions**:
1. Extract interface from `Model` class → `UIOperations` interface
2. Create adapter that provides `UIOperations` for each platform
3. Replace `useModel()` with `usePlatform()` that returns adapter

### Step 3: Wholesale Copy to lama.ui

```bash
# Copy entire lama.browser/browser-ui/src to lama.ui/src
cp -r lama.browser/browser-ui/src/components lama.ui/src/
cp -r lama.browser/browser-ui/src/hooks lama.ui/src/
cp -r lama.browser/browser-ui/src/lib lama.ui/src/
cp -r lama.browser/browser-ui/src/types lama.ui/src/
```

### Step 4: Platform Adapters

**Browser Adapter** (lama.ui/adapters/browser.ts):
```typescript
import { Model } from '@/model/Model'
import type { UIOperations } from '@lama/ui/types'

export class BrowserPlatformAdapter implements UIOperations {
  constructor(private model: Model) {}

  // Delegate to model's Plans
  get llmConfigPlan() { return this.model.llmConfigPlan }
  get chatPlan() { return this.model.chatPlan }
  get contactsPlan() { return this.model.contactsPlan }
  // ... all other Plans

  // Platform-specific operations
  async getStorageQuota() {
    if (!navigator.storage?.estimate) {
      throw new Error('Storage API not available')
    }
    return await navigator.storage.estimate()
  }

  async clearStorage() {
    // Browser-specific IndexedDB cleanup
  }
}
```

**Electron Adapter** (lama.ui/adapters/electron.ts):
```typescript
import type { UIOperations } from '@lama/ui/types'

export class ElectronPlatformAdapter implements UIOperations {
  // All operations go through IPC
  get llmConfigPlan() {
    return {
      getAllConfigs: () => window.electronAPI.invoke('llmConfig:getAll'),
      updateSystemPrompt: (params) => window.electronAPI.invoke('llmConfig:updatePrompt', params),
      // ... wrap all IPC calls
    }
  }

  async getStorageQuota() {
    // Electron uses filesystem, not IndexedDB
    return window.electronAPI.invoke('storage:getQuota')
  }

  async clearStorage() {
    return window.electronAPI.invoke('storage:clear')
  }
}
```

**Mobile Adapter** (lama.ui/adapters/mobile.ts):
```typescript
import type { UIOperations } from '@lama/ui/types'
import { NativeModules } from 'react-native'

export class MobilePlatformAdapter implements UIOperations {
  // Mobile uses React Native bridge
  get llmConfigPlan() {
    return {
      getAllConfigs: () => NativeModules.LAMA.getLLMConfigs(),
      // ... wrap all native calls
    }
  }

  async getStorageQuota() {
    // React Native AsyncStorage
    return NativeModules.LAMA.getStorageInfo()
  }
}
```

### Step 5: Platform Provider Pattern

**lama.ui/src/contexts/PlatformContext.tsx**:
```typescript
import { createContext, useContext } from 'react'
import type { UIOperations } from '../types'

const PlatformContext = createContext<UIOperations | null>(null)

export function PlatformProvider({ adapter, children }: {
  adapter: UIOperations
  children: React.ReactNode
}) {
  return (
    <PlatformContext.Provider value={adapter}>
      {children}
    </PlatformContext.Provider>
  )
}

export function usePlatform() {
  const platform = useContext(PlatformContext)
  if (!platform) {
    throw new Error('usePlatform must be used within PlatformProvider')
  }
  return platform
}
```

### Step 6: Update Components to Use Adapter

**Before** (lama.browser specific):
```typescript
import { useModel } from '@/model/ModelContext'

export function LLMSettings() {
  const model = useModel()
  const configs = await model.llmConfigPlan.getAllConfigs()
  // ...
}
```

**After** (platform-agnostic):
```typescript
import { usePlatform } from '@lama/ui/contexts/PlatformContext'

export function LLMSettings() {
  const platform = usePlatform()
  const configs = await platform.llmConfigPlan.getAllConfigs()
  // ...
}
```

### Step 7: Platform Integration

**lama.browser**:
```typescript
import { BrowserPlatformAdapter } from '@lama/ui/adapters/browser'
import { PlatformProvider } from '@lama/ui'
import { App } from '@lama/ui' // Wholesale import

function Root() {
  const model = useModel()
  const adapter = new BrowserPlatformAdapter(model)

  return (
    <PlatformProvider adapter={adapter}>
      <App />
    </PlatformProvider>
  )
}
```

**lama.cube**:
```typescript
import { ElectronPlatformAdapter } from '@lama/ui/adapters/electron'
import { PlatformProvider } from '@lama/ui'
import { App } from '@lama/ui' // Same UI!

function Root() {
  const adapter = new ElectronPlatformAdapter()

  return (
    <PlatformProvider adapter={adapter}>
      <App />
    </PlatformProvider>
  )
}
```

**lama.thin**:
```typescript
import { MobilePlatformAdapter } from '@lama/ui/adapters/mobile'
import { PlatformProvider } from '@lama/ui'
import { App } from '@lama/ui' // Same UI!

function Root() {
  const adapter = new MobilePlatformAdapter()

  return (
    <PlatformProvider adapter={adapter}>
      <App />
    </PlatformProvider>
  )
}
```

---

## Refactoring Strategy

### Phase 1: Wholesale Copy (Day 1)
- Copy all lama.browser/browser-ui/src → lama.ui/src
- Export everything from lama.ui/index.ts
- **Goal**: Working copy in lama.ui

### Phase 2: Extract Platform Interface (Days 2-3)
- Analyze all `useModel()` usage
- Design `UIOperations` interface covering all operations
- Create `usePlatform()` hook
- **Goal**: Interface defined

### Phase 3: Create Adapters (Days 4-5)
- Implement `BrowserPlatformAdapter` (wraps existing Model)
- Implement `ElectronPlatformAdapter` (wraps IPC)
- **Goal**: Both platforms can provide adapters

### Phase 4: Update Components (Days 6-10)
- Replace `useModel()` with `usePlatform()` in components
- Test incrementally (component by component)
- Keep components working in lama.browser during transition
- **Goal**: Components are platform-agnostic

### Phase 5: Integrate lama.cube (Days 11-15)
- Update lama.cube to use `@lama/ui`
- Provide `ElectronPlatformAdapter`
- Replace old lama.cube UI with lama.ui
- **Goal**: lama.cube uses same UI as lama.browser

### Phase 6: Build lama.thin (Future)
- Implement `MobilePlatformAdapter`
- Adapt React components to React Native where needed
- **Goal**: Mobile app with same UI

---

## Platform-Specific Handling

### Storage Components

Some components are inherently platform-specific (e.g., `StorageQuota` uses browser APIs).

**Strategy**: Conditional rendering based on adapter capabilities

```typescript
export function SettingsView() {
  const platform = usePlatform()

  return (
    <div>
      {/* Shared settings */}
      <LLMSettings llmConfig={platform.llmConfigPlan} />
      <MCPSettings mcpConfig={platform.mcpPlan} />

      {/* Platform-specific settings */}
      {platform.capabilities.hasStorageQuota && (
        <StorageQuota getQuota={platform.getStorageQuota} />
      )}

      {platform.capabilities.hasSubscriptions && (
        <SubscriptionSettings subscription={platform.subscriptionPlan} />
      )}
    </div>
  )
}
```

### Routing/Navigation

Platform-specific routing stays in platform folders:

**lama.browser**:
```typescript
// browser-ui/src/App.tsx
import { SettingsView, ChatLayout } from '@lama/ui'

function App() {
  const [currentView, setCurrentView] = useState('chat')

  return (
    <>
      {currentView === 'chat' && <ChatLayout />}
      {currentView === 'settings' && <SettingsView />}
    </>
  )
}
```

**lama.cube**:
```typescript
// electron-ui/src/App.tsx
import { SettingsView, ChatLayout } from '@lama/ui'

function App() {
  // Same components, different routing logic if needed
  return (
    <>
      {currentView === 'chat' && <ChatLayout />}
      {currentView === 'settings' && <SettingsView />}
    </>
  )
}
```

---

## Advantages of This Approach

### 1. **Speed**
- Wholesale copy: 1 day
- Adapter creation: 4-5 days
- Component updates: 5 days
- **Total: ~2 weeks** vs 6-8 weeks for piecemeal migration

### 2. **Completeness**
- No risk of missing components
- All components migrated at once
- No partial states

### 3. **Consistency**
- Single UI codebase
- Changes benefit all platforms immediately
- No divergence between platforms

### 4. **Evolutionary Refactoring**
- Refactor components as needed, not upfront
- Keep working UI while improving architecture
- Incremental improvements

### 5. **Type Safety**
- TypeScript enforces adapter compatibility
- Compiler catches missing operations
- No runtime surprises

---

## Migration Checklist

### Pre-Migration
- [X] Audit lama.browser components (completed)
- [ ] Design `UIOperations` interface
- [ ] Document adapter requirements
- [ ] Create `lama.ui` package structure

### Migration
- [ ] Copy lama.browser/browser-ui/src → lama.ui/src
- [ ] Create `usePlatform()` hook
- [ ] Implement `BrowserPlatformAdapter`
- [ ] Update components to use `usePlatform()`
- [ ] Test in lama.browser (should work identically)

### Platform Integration
- [ ] Implement `ElectronPlatformAdapter`
- [ ] Update lama.cube to use `@lama/ui`
- [ ] Test all features in lama.cube
- [ ] Verify UI consistency between platforms

### Cleanup
- [ ] Remove old lama.cube UI components
- [ ] Remove old lama.browser components (now in lama.ui)
- [ ] Update documentation
- [ ] Create component catalog

---

## Success Criteria

✅ **lama.browser** uses lama.ui with BrowserPlatformAdapter
✅ **lama.cube** uses lama.ui with ElectronPlatformAdapter
✅ **Both platforms** have identical UI and behavior
✅ **Components** are platform-agnostic (no platform imports)
✅ **Adapters** isolate platform-specific code
✅ **Type safety** enforced via `UIOperations` interface

---

## Next Steps

1. **Design UIOperations interface** - Complete inventory of all operations needed
2. **Create lama.ui package structure** - Set up folder hierarchy
3. **Wholesale copy** - Copy all lama.browser UI to lama.ui
4. **Implement BrowserPlatformAdapter** - Wrap existing Model
5. **Update one component as proof-of-concept** - Validate approach
6. **Roll out to all components** - Systematic refactoring
7. **Integrate lama.cube** - Replace old UI with lama.ui

---

## Timeline

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Design UIOperations interface | Interface definition |
| 2 | Wholesale copy to lama.ui | Working copy |
| 3 | Create BrowserPlatformAdapter | Adapter implementation |
| 4-5 | Update 10 components (POC) | Proof of concept working |
| 6-10 | Update all components | All components platform-agnostic |
| 11-12 | Implement ElectronPlatformAdapter | Electron adapter |
| 13-15 | Integrate lama.cube | lama.cube using lama.ui |

**Total: ~3 weeks** for complete platform consolidation
