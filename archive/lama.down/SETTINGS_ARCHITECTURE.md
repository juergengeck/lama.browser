# Settings Architecture Analysis: lama.cube vs lama vs lama.app Integration

## Executive Summary

Both `lama.cube` (reference implementation) and `lama` (legacy mobile) use **identical SettingsManager architecture**. The system is designed for plan-based integration into `lama.app` using:

1. **SettingsManager** - Generic key-value store with ONE.core integration
2. **SettingsProvider** - React Context provider for app-wide access
3. **ONE.core SettingsStore** - Platform-specific persistence (Expo SecureStore for lama.app)

---

## File Locations

### lama.cube (Reference Implementation)
- `/Users/gecko/src/lama/lama.cube/reference/lama/src/settings/SettingsManager.ts`
- `/Users/gecko/src/lama/lama.cube/reference/lama/src/settings/types.ts`
- `/Users/gecko/src/lama/lama.cube/reference/lama/src/settings/index.ts`
- `/Users/gecko/src/lama/lama.cube/reference/lama/src/providers/app/SettingsProvider.tsx`

### lama (Legacy Mobile - IDENTICAL to cube)
- `/Users/gecko/src/lama/lama/src/settings/SettingsManager.ts` (identical)
- `/Users/gecko/src/lama/lama/src/settings/types.ts` (identical)
- `/Users/gecko/src/lama/lama/src/settings/index.ts` (identical)
- `/Users/gecko/src/lama/lama/src/providers/app/SettingsProvider.tsx` (nearly identical)

### lama.app (Target Integration)
- ONE.core Expo SettingsStore: `/Users/gecko/src/lama/lama/packages/one.core.expo/src/system/expo/settings-store.ts`
- Uses `expo-secure-store` for encrypted persistence

---

## Architecture Overview

### 1. SettingsManager (Core Business Logic)

**Location**: `src/settings/SettingsManager.ts`

**Purpose**: Generic key-value store with async persistence via ONE.core PropertyTreeStore

**Key Responsibilities**:
- Get/set/delete/clear settings in-memory
- Load/save from ONE.core PropertyTreeStore
- Emit events on changes via OEvent
- Provide specialized methods for device and network settings
- Centralized defaults via static methods

**Interface**:
```typescript
interface ISettingsManager {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  clear(): void;
  getAll(): Record<string, unknown>;
  load(): Promise<void>;
  save(): Promise<void>;
  readonly onChange: OEvent<(key: string, value: unknown) => void>;
}
```

**Specialized Methods for Device Settings**:
```typescript
// Single source of truth for device defaults
static getDefaultDeviceSettings(): DeviceSettingsGroup

// Getters/Setters
getDeviceSettings(): DeviceSettingsGroup
setDeviceSettings(settings: DeviceSettingsGroup): void
updateDeviceSettings(settings: Partial<DeviceSettingsGroup>): void

// Network settings
getNetworkSettings(): NetworkSettingsGroup
setNetworkSettings(settings: NetworkSettingsGroup): void
updateNetworkSettings(settings: Partial<NetworkSettingsGroup>): void
```

**Constructor**:
```typescript
constructor(
  storageKey = 'app_settings',
  propertyTree?: SettingStoreApi  // ONE.core SettingsStore
)
```

---

### 2. Settings Types

**File**: `src/settings/types.ts`

```typescript
// Settings categories
type SettingsKey = 'device' | 'network' | 'security' | 'ui';

// Device settings group
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

// Network settings group
interface NetworkSettingsGroup {
  $type$: 'Settings.network';
  eddaDomain: string;
  commServerUrl?: string;
  autoConnect?: boolean;
  [key: string]: unknown;
}

// Generic settings group
interface SettingsGroup {
  $type$: string;
  [key: string]: unknown;
}

// Storage interface (not used directly in app, used by ONE.core)
interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}
```

---

### 3. SettingsProvider (React Context)

**Location**: `src/providers/app/SettingsProvider.tsx`

**Purpose**: React Context provider for application-wide settings access with persistence

**Key Features**:
- Generic settings: language, darkMode
- AI settings: provider configs, summary config
- Device settings: device config, device settings group
- Import/export functionality
- Loading and error states

**Context Interface**:
```typescript
interface SettingsContextType {
  // General
  language: string;
  setLanguage(lang: string): Promise<void>;
  darkMode: boolean;
  setDarkMode(enabled: boolean): Promise<void>;
  
  // AI
  providerConfigs: Record<string, LLMSettings>;
  summaryConfig: AISummaryConfig;
  updateProvider(providerId: string, config: Partial<LLMSettings>): Promise<void>;
  updateSummary(config: Partial<AISummaryConfig>): Promise<void>;
  
  // Device
  deviceConfig: DeviceConfig;
  deviceSettings: DeviceSettingsGroup;
  updateDeviceConfig(config: Partial<DeviceConfig>): Promise<void>;
  updateDeviceSettings(settings: Partial<DeviceSettingsGroup>): Promise<void>;
  
  // Utils
  isLoading: boolean;
  error: string | null;
  importSettings(settings: any): Promise<void>;
  exportSettings(): Promise<string>;
}
```

**Provider Initialization**:
```typescript
export function SettingsProvider({ children }: SettingsProviderProps) {
  const { instance } = useInstance();  // Gets AppModel with PropertyTree
  
  // State management for all settings
  const [language, setLanguageState] = useState('en');
  const [darkMode, setDarkModeState] = useState(false);
  const [deviceSettings, setDeviceSettings] = useState<DeviceSettingsGroup>(
    SettingsManager.getDefaultDeviceSettings()
  );
  // ... more state
  
  // Load on mount
  useEffect(() => {
    loadSettings();
  }, [instance]);
  
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
```

**Usage Hook**:
```typescript
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
```

---

## Default Settings

### Device Settings Defaults
```typescript
{
  $type$: 'Settings.device',
  devices: {},
  discoveryEnabled: false,           // DISABLED by default (privacy/security/battery)
  discoveryPort: 49497,
  discoveryBroadcastInterval: 5000,  // ms
  autoConnect: false,
  addOnlyConnectedDevices: false,
  defaultDataPresentation: {
    $type$: 'ESP32DataPresentation',
    format: 'json'
  }
}
```

### Network Settings Defaults
```typescript
{
  $type$: 'Settings.network',
  eddaDomain: 'https://edda.dev.refinio.one',
  autoConnect: false
}
```

---

## Storage Architecture

### ONE.core SettingsStore Integration

**Platform-Specific Implementations**:
- **Node.js**: File-based store
- **Browser**: localStorage
- **Expo**: `expo-secure-store` (encrypted)

**Expo Implementation Details** (`src/system/expo/settings-store.ts`):
```typescript
// Uses expo-secure-store for encrypted persistence
export const SettingsStore: SettingStoreApi = {
  async getItem(key: string): Promise<string | AnyObject | undefined>
  async setItem(key: string, value: string | AnyObject): Promise<void>
  async removeItem(key: string): Promise<void>
  async clear(): Promise<void>
};
```

**Key Features**:
- Encrypted storage for sensitive data
- JSON serialization support
- Key tracking via `__one_settings_keys__`
- Detailed logging for debugging

**API Interface** (from ONE.core):
```typescript
type SettingStoreApi = {
  getItem(key: string): Promise<string | AnyObject | undefined>;
  setItem(key: string, value: string | AnyObject): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
};
```

---

## Settings Categories and Defaults

### 1. General App Settings
- **language**: 'en' (from AsyncStorage via i18n config)
- **darkMode**: false (or system colorScheme)

### 2. AI Provider Settings
```typescript
{
  local: {
    $type$: 'LLMSettings',
    id: 'local',
    model: 'llama2',
    enabled: false,
    settings: { threads: 4, temperature: 0.7, ... }
  },
  cloud: {
    $type$: 'LLMSettings',
    id: 'cloud',
    model: 'gpt-4',
    enabled: false,
    settings: { maxTokens: 2048, ... }
  }
}
```

### 3. Summary Config
```typescript
{
  enabled: false,
  maxTokens: 100,
  temperature: 0.7,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0
}
```

### 4. Device Settings
- Discovery enabled/disabled
- Available devices with connection info
- Auto-connect preferences
- Data presentation format

### 5. Network Settings
- Edda domain URL
- CommServer URL
- Auto-connect flag

---

## Critical Design Patterns

### 1. Single Source of Truth for Device Defaults
```typescript
// ALWAYS use this for device defaults, NEVER hardcode defaults elsewhere
public static getDefaultDeviceSettings(): DeviceSettingsGroup {
  return {
    $type$: 'Settings.device',
    devices: {},
    discoveryEnabled: false,  // Critical: Privacy by default
    // ... rest of defaults
  };
}
```

**Why**: Prevents settings inconsistency across codebase. Any place needing device defaults must call this method.

### 2. Graceful Degradation (PropertyTree Optional)
```typescript
// Settings work even if PropertyTree unavailable
constructor(storageKey = 'app_settings', propertyTree?: SettingStoreApi) {
  this.storageKey = storageKey;
  this.propertyTree = propertyTree;  // Optional
}

async load(): Promise<void> {
  if (this.propertyTree) {
    // Use ONE.core storage
  } else {
    console.warn('PropertyTreeStore not available, using in-memory only');
    this.initializeDefaultSettings();
  }
}
```

### 3. Event-Driven Changes
```typescript
public set<T>(key: string, value: T): void {
  this.settings[key] = value;
  this.onChange.emit(key, value);  // Notify listeners
}
```

### 4. Async Persistence
```typescript
// Load and save are async to handle I/O
async load(): Promise<void> { /* ... */ }
async save(): Promise<void> { /* ... */ }
```

---

## Current Limitations (lama Legacy)

The legacy `SettingsProvider.tsx` has **disabled PropertyTree access** with TODO comments:

```typescript
// TEMPORARY: Disable PropertyTree access to prevent initialization blocking
console.warn('[SettingsProvider] PropertyTree access temporarily disabled, using defaults');
setDeviceSettings(SettingsManager.getDefaultDeviceSettings());
setProviderConfigs(defaultProviderConfigs);
setIsLoading(false);
return;
```

**Reason**: PropertyTree initialization was blocking app startup.

**Workaround**: Uses in-memory-only mode with manual import/export.

---

## Integration Strategy for lama.app

### Option A: Use SettingsManager Directly (Recommended)

1. **Create settings management plan** (for plan-based architecture):
   ```typescript
   // packages/settings.core/src/plans/SettingsPlan.ts
   export class SettingsPlan {
     constructor(
       private nodeOneCore: any,
       private settingsStore?: SettingStoreApi
     ) {}
     
     async getSetting<T>(key: string): Promise<T | undefined> { }
     async setSetting<T>(key: string, value: T): Promise<void> { }
     async getDeviceSettings(): Promise<DeviceSettingsGroup> { }
     async updateDeviceSettings(settings: Partial<DeviceSettingsGroup>): Promise<void> { }
   }
   ```

2. **Create SettingsProvider for lama.app**:
   ```typescript
   // src/providers/SettingsProvider.tsx
   import { SettingsPlan } from '@settings/core/plans/SettingsPlan';
   
   export function SettingsProvider({ children }) {
     const client = useLamaClient();  // Uses PlanTransportAdapter
     const [settings, setSettings] = useState({});
     
     useEffect(() => {
       // Load settings via plan
       client.settings.getDeviceSettings()
         .then(setSettings);
     }, []);
     
     return (
       <SettingsContext.Provider value={{ settings, ... }}>
         {children}
       </SettingsContext.Provider>
     );
   }
   ```

3. **Add to PlanTransportAdapter**:
   ```typescript
   // src/transport/PlanTransportAdapter.ts
   case 'settings':
     const settingsPlan = new SettingsPlan(this.nodeOneCore);
     return await settingsPlan[method](request);
   ```

### Option B: Simple React Context (No Plans)

Use SettingsProvider pattern directly from lama with Expo SettingsStore:

```typescript
// src/providers/SettingsProvider.tsx
import { SettingsManager } from '@settings/SettingsManager';
import { SettingsStore } from '@refinio/one.core.expo/lib/system/expo/settings-store';

export function SettingsProvider({ children }) {
  const settingsManager = new SettingsManager('app_settings', SettingsStore);
  
  const [settings, setSettings] = useState({});
  
  useEffect(() => {
    settingsManager.load().then(() => {
      setSettings(settingsManager.getAll());
    });
  }, []);
  
  return (
    <SettingsContext.Provider value={{ settings, ... }}>
      {children}
    </SettingsContext.Provider>
  );
}
```

---

## Key Differences Between Implementations

### lama.cube vs lama
- **IDENTICAL**: Both use same SettingsManager and types
- **Minor**: lama has one extra property `discoveryBroadcastInterval` in defaults
- **Minor**: Some commented-out code in lama's SettingsProvider

### lama vs lama.app
- **Storage**: lama uses PropertyTree (through ONE.core); lama.app should use expo-secure-store
- **Architecture**: lama uses React Context directly; lama.app can use plans OR context
- **Init**: lama loads in SettingsProvider; lama.app can load in TransportAdapter init

---

## Recommended Approach for lama.app

1. **Short term**: Use Option B (React Context) with Expo SettingsStore
   - Minimal changes
   - Works with existing components
   - Can migrate to plans later

2. **Medium term**: Create `settings.core` package with SettingsPlan
   - Align with unified plan system (Spec 008)
   - Reuse across platforms

3. **Settings structure**:
   - Copy `src/settings/` from lama
   - Copy `src/types/device.ts` from lama
   - Create Expo-specific provider in `src/providers/SettingsProvider.tsx`
   - Use ONE.core Expo SettingsStore for persistence

4. **Components**:
   - Import settings components from legacy lama for UI
   - Migrate to lama.ui components over time
   - Use useSettings() hook in components

---

## Testing Checklist

- [ ] Settings load from Expo SecureStore on app startup
- [ ] Settings save to Expo SecureStore when changed
- [ ] Device settings use SettingsManager.getDefaultDeviceSettings()
- [ ] Settings persist across app restarts
- [ ] Import/export functionality works
- [ ] Settings changes trigger UI updates
- [ ] No settings lost when PropertyTree unavailable
- [ ] Language/theme settings persist

---

## Files to Create/Copy for lama.app

### From lama/src:
```
src/settings/
  ├── SettingsManager.ts (copy from lama)
  ├── types.ts (copy from lama)
  └── index.ts (copy from lama)

src/types/
  ├── device.ts (copy from lama)
  └── ai.ts (reference existing if needed)

src/providers/
  └── SettingsProvider.tsx (new, based on lama but using Expo SettingsStore)

src/hooks/
  └── useSettings.ts (export from provider)
```

### Integration points:
- `app/_layout.tsx`: Wrap with SettingsProvider
- Transport adapter: Add settings plan routing
- Components: Use useSettings() hook

---

## References

- **lama.cube reference**: `/Users/gecko/src/lama/lama.cube/reference/lama/src/`
- **lama legacy**: `/Users/gecko/src/lama/lama/src/`
- **ONE.core Expo**: `/Users/gecko/src/lama/lama/packages/one.core.expo/src/system/expo/`
- **CLAUDE.md**: `/Users/gecko/src/lama/CLAUDE.md` (architecture guidelines)
