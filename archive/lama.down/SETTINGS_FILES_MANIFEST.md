# Settings Integration Files Manifest for lama.app

## Summary
This document maps exactly which files to copy from `lama` and which files to create new for `lama.app`.

---

## Files to Copy from `lama` (NO CHANGES NEEDED)

### 1. Settings Manager and Types
```
Source (lama):
  /Users/gecko/src/lama/lama/src/settings/SettingsManager.ts
  /Users/gecko/src/lama/lama/src/settings/types.ts
  /Users/gecko/src/lama/lama/src/settings/index.ts

Destination (lama.app):
  src/settings/SettingsManager.ts
  src/settings/types.ts
  src/settings/index.ts

Why: 100% compatible, no changes needed
Status: PRODUCTION READY
Size: ~320 lines total
```

### 2. Device Types
```
Source (lama):
  /Users/gecko/src/lama/lama/src/types/device.ts

Destination (lama.app):
  src/types/device.ts

Why: Defines DeviceSettingsGroup interface used throughout
Status: PRODUCTION READY
Size: ~96 lines
```

---

## Files to Create New for lama.app

### 1. Expo SettingsProvider (CRITICAL)
```
Destination:
  src/providers/SettingsProvider.tsx

Purpose:
  - React Context wrapper for settings
  - Integrates with Expo SettingsStore
  - Manages state for all settings categories
  - Provides useSettings() hook

Based on:
  /Users/gecko/src/lama/lama/src/providers/app/SettingsProvider.tsx
  
But adapted for:
  - Use Expo SettingsStore instead of AppModel.propertyTree
  - Remove PropertyTree dependency
  - Load settings early during app init (not in effect)
  - Integrate with PlanTransportAdapter

Estimated Size: ~350 lines
Complexity: MEDIUM - follow existing pattern, adapt storage layer
```

### 2. useSettings Hook Export
```
Destination:
  src/hooks/useSettings.ts

Purpose:
  - Export useSettings() hook from SettingsProvider
  - Type-safe settings access for components
  - Thin wrapper around context

Template:
  ```typescript
  export { useSettings } from '@providers/SettingsProvider';
  ```

Size: ~5 lines
Complexity: TRIVIAL
```

### 3. SettingsPlan (Optional - Phase 2)
```
Destination:
  packages/settings.core/src/plans/SettingsPlan.ts

Purpose:
  - Plan-based settings access (aligned with unified plan system)
  - Wrap SettingsManager for PlanTransportAdapter
  - Enable client.settings.* API

Based on:
  ChatPlan pattern from chat.core
  
Exposes:
  - getSetting<T>(key: string)
  - setSetting<T>(key: string, value: T)
  - getDeviceSettings()
  - updateDeviceSettings(partial)
  - getNetworkSettings()
  - updateNetworkSettings(partial)

Size: ~100 lines
Complexity: LOW - straightforward wrapper
Status: OPTIONAL - can add later
```

---

## File Dependency Tree

```
lama.app structure:
│
├── app/
│   └── _layout.tsx  (wrap with SettingsProvider)
│
├── src/
│   ├── settings/
│   │   ├── SettingsManager.ts    ← copy from lama
│   │   ├── types.ts              ← copy from lama
│   │   └── index.ts              ← copy from lama
│   │
│   ├── types/
│   │   └── device.ts             ← copy from lama
│   │
│   ├── providers/
│   │   └── SettingsProvider.tsx   ← CREATE NEW
│   │       └── uses: SettingsManager, SettingsStore from one.core.expo
│   │
│   └── hooks/
│       └── useSettings.ts         ← CREATE NEW (exports from Provider)
│
├── src/transport/
│   └── PlanTransportAdapter.ts    ← ADD settings route
│
└── packages/
    └── settings.core/            ← CREATE NEW (Phase 2)
        └── src/plans/
            └── SettingsPlan.ts
```

---

## Detailed File Specifications

### SettingsManager.ts (COPY)
**Source**: `/Users/gecko/src/lama/lama/src/settings/SettingsManager.ts`

**Key methods to understand**:
```typescript
// Constructor takes optional SettingStoreApi
constructor(storageKey = 'app_settings', propertyTree?: SettingStoreApi)

// Async load/save from storage
async load(): Promise<void>
async save(): Promise<void>

// Generic get/set
get<T>(key: string): T | undefined
set<T>(key: string, value: T): void

// Device settings (critical)
static getDefaultDeviceSettings(): DeviceSettingsGroup
getDeviceSettings(): DeviceSettingsGroup
updateDeviceSettings(settings: Partial<DeviceSettingsGroup>): void

// Network settings
static getDefaultNetworkSettings(): NetworkSettingsGroup
getNetworkSettings(): NetworkSettingsGroup
updateNetworkSettings(settings: Partial<NetworkSettingsGroup>): void

// Events
readonly onChange: OEvent<(key: string, value: unknown) => void>
```

**For lama.app**:
- Pass SettingsStore from one.core.expo as propertyTree param
- Load settings in early useEffect (don't wait for AppModel)
- Listen to onChange events if needed for reactive updates

---

### types.ts (COPY)
**Source**: `/Users/gecko/src/lama/lama/src/settings/types.ts`

**Exports**:
```typescript
// Type definitions for settings keys
type SettingsKey = 'device' | 'network' | 'security' | 'ui';

// Device settings group interface
interface DeviceSettingsGroup {
  $type$: 'Settings.device';
  devices: Record<string, ESP32DeviceSettings>;
  discoveryEnabled: boolean;
  discoveryPort: number;
  discoveryBroadcastInterval?: number;
  autoConnect: boolean;
  addOnlyConnectedDevices: boolean;
  defaultDataPresentation: ESP32DataPresentation;
}

// Network settings group interface
interface NetworkSettingsGroup {
  $type$: 'Settings.network';
  eddaDomain: string;
  commServerUrl?: string;
  autoConnect?: boolean;
  [key: string]: unknown;
}

// Generic group
interface SettingsGroup {
  $type$: string;
  [key: string]: unknown;
}

// Storage abstraction (unused in app)
interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}
```

---

### device.ts (COPY)
**Source**: `/Users/gecko/src/lama/lama/src/types/device.ts`

**Key interfaces**:
```typescript
// ESP32 device settings
interface ESP32DeviceSettings {
  id: string;
  name: string;
  enabled: boolean;
  autoConnect: boolean;
  quicConfig: DeviceQuicConfig;
  dataPresentation: ESP32DataPresentation;
  lastConnected?: number;
  personId?: SHA256IdHash<Person>;
}

// Main device settings group
interface DeviceSettingsGroup {
  $type$: 'Settings.device';
  devices: Record<string, ESP32DeviceSettings>;
  discoveryEnabled: boolean;
  discoveryPort: number;
  discoveryBroadcastInterval?: number;
  autoConnect: boolean;
  addOnlyConnectedDevices: boolean;
  defaultDataPresentation: ESP32DataPresentation;
}

// Data presentation format
interface ESP32DataPresentation {
  $type$: 'ESP32DataPresentation';
  format: 'json' | 'binary' | 'text';
}

// Device config
interface DeviceConfig {
  $type$: 'DeviceConfig';
  id: string;
  name: string;
  discoveryEnabled: boolean;
  discoveryPort: number;
  autoConnect: boolean;
  addOnlyConnectedDevices: boolean;
  defaultDataPresentation: ESP32DataPresentation;
  lastUpdated: number;
}

export const defaultDeviceConfig: DeviceConfig = { /* ... */ }
```

---

### SettingsProvider.tsx (CREATE NEW)

**Purpose**: React Context provider for settings

**Key components**:

1. **Context type**:
```typescript
interface SettingsContextType {
  language: string;
  setLanguage(lang: string): Promise<void>;
  darkMode: boolean;
  setDarkMode(enabled: boolean): Promise<void>;
  
  providerConfigs: Record<string, LLMSettings>;
  summaryConfig: AISummaryConfig;
  updateProvider(providerId: string, config: Partial<LLMSettings>): Promise<void>;
  updateSummary(config: Partial<AISummaryConfig>): Promise<void>;
  
  deviceConfig: DeviceConfig;
  deviceSettings: DeviceSettingsGroup;
  updateDeviceConfig(config: Partial<DeviceConfig>): Promise<void>;
  updateDeviceSettings(settings: Partial<DeviceSettingsGroup>): Promise<void>;
  
  isLoading: boolean;
  error: string | null;
  importSettings(settings: any): Promise<void>;
  exportSettings(): Promise<string>;
}
```

2. **Hook**:
```typescript
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
```

3. **Provider component**:
```typescript
export function SettingsProvider({ children }: SettingsProviderProps) {
  // 1. Create SettingsManager with Expo SettingsStore
  const settingsManager = useMemo(
    () => new SettingsManager('app_settings', SettingsStore),
    []
  );
  
  // 2. State for all settings
  const [deviceSettings, setDeviceSettings] = useState<DeviceSettingsGroup>(
    SettingsManager.getDefaultDeviceSettings()
  );
  const [language, setLanguageState] = useState('en');
  // ... more state
  
  // 3. Load on mount
  useEffect(() => {
    settingsManager.load().then(() => {
      const loaded = settingsManager.getDeviceSettings();
      setDeviceSettings(loaded);
      // ... load other settings
    });
  }, [settingsManager]);
  
  // 4. Callbacks for updates
  const updateDeviceSettings = useCallback(async (settings: Partial<DeviceSettingsGroup>) => {
    setDeviceSettings(prev => ({ ...prev, ...settings }));
    await settingsManager.save();
  }, [settingsManager]);
  
  // ... more callbacks
  
  // 5. Return provider
  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}
```

---

## Import References

### When copying files, these imports will need to be verified:

**In SettingsManager.ts**:
```typescript
import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js';
// ✓ Already available in lama.app packages/one.models
import type { DeviceSettingsGroup } from '@src/types/device';
// ✓ Will be created in lama.app
import type { NetworkSettingsGroup } from './types';
// ✓ Same file
import type { SettingStoreApi } from '@refinio/one.core/lib/storage-base-common.js';
// ✓ Already available in lama.app packages/one.core.expo
```

**In new SettingsProvider.tsx**:
```typescript
import { SettingsManager } from '@src/settings/SettingsManager';
// ✓ File being copied
import { SettingsStore } from '@refinio/one.core.expo/lib/system/expo/settings-store';
// ✓ Already in packages/one.core.expo
import type { DeviceSettingsGroup } from '@src/types/device';
// ✓ File being copied
```

**In new SettingsPlan.ts (Phase 2)**:
```typescript
import { SettingsManager } from '@settings/SettingsManager';
// ✓ From packages if created as settings.core
import type { SettingStoreApi } from '@refinio/one.core.expo/lib/storage-base-common.js';
// ✓ Available
```

---

## Copy Commands Reference

```bash
# Copy settings files
cp /Users/gecko/src/lama/lama/src/settings/SettingsManager.ts /Users/gecko/src/lama/lama.app/src/settings/
cp /Users/gecko/src/lama/lama/src/settings/types.ts /Users/gecko/src/lama/lama.app/src/settings/
cp /Users/gecko/src/lama/lama/src/settings/index.ts /Users/gecko/src/lama/lama.app/src/settings/

# Copy device types
cp /Users/gecko/src/lama/lama/src/types/device.ts /Users/gecko/src/lama/lama.app/src/types/

# Verify
ls -la /Users/gecko/src/lama/lama.app/src/settings/
ls -la /Users/gecko/src/lama/lama.app/src/types/
```

---

## Phase 1 (SHORT TERM) Deliverables

**Files to copy**: 4
- SettingsManager.ts
- types.ts
- index.ts
- device.ts

**Files to create**: 2
- SettingsProvider.tsx
- useSettings.ts (just exports hook)

**Files to modify**: 1
- app/_layout.tsx (wrap with SettingsProvider)
- src/transport/PlanTransportAdapter.ts (add settings routing - optional)

**Total changes**: ~7 files
**Estimated effort**: 2-3 hours
**Risk**: LOW (copied pattern from working lama, just swaps storage layer)

---

## Phase 2 (MEDIUM TERM) Deliverables

**New package**: packages/settings.core
- Create SettingsPlan wrapping SettingsManager
- Async methods for all operations
- Type-safe interfaces

**Files to modify**:
- src/transport/PlanTransportAdapter.ts (add full settings route)
- useLamaClient hook (add settings client interface)

**Total changes**: ~3-4 files
**Estimated effort**: 1-2 hours
**Risk**: LOW (straightforward plan wrapper pattern)
**Benefit**: Reusable across platforms, aligns with unified plan system

---

## References

Full details in:
- `/Users/gecko/src/lama/lama.app/SETTINGS_ARCHITECTURE.md` (comprehensive guide)
- `/Users/gecko/src/lama/CLAUDE.md` (unified plan system architecture)

