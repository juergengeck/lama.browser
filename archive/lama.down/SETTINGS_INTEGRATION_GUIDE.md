# Settings Integration Guide for lama.app

## Quick Start

You have **two comprehensive documents** to guide your settings integration:

1. **SETTINGS_ARCHITECTURE.md** (570 lines)
   - Complete architectural analysis
   - How settings work across platforms
   - Design patterns and principles
   - Integration strategies with code examples

2. **SETTINGS_FILES_MANIFEST.md** (473 lines)
   - Exact files to copy and create
   - Detailed file specifications
   - Import references
   - Copy commands
   - Phase 1 & 2 deliverables

---

## TL;DR - The 5-Minute Summary

### What You Need to Know

**Settings = Key-Value Store + Persistence + React Context**

1. **SettingsManager** (from lama)
   - Generic key-value store
   - Uses ONE.core SettingsStore for persistence
   - Works even if storage unavailable
   - Observable pattern (onChange events)

2. **SettingsStore** (from one.core.expo)
   - Platform-specific: Expo uses `expo-secure-store` (encrypted!)
   - Simple API: getItem/setItem/removeItem/clear
   - Async operations

3. **SettingsProvider** (create for lama.app)
   - React Context wrapper
   - Loads settings on app start
   - Provides useSettings() hook to components

4. **Settings Categories**:
   - General: language, darkMode
   - Device: discovery, ports, devices dict
   - Network: Edda domain, comm server
   - AI: provider configs, summary config

### What to Do

**Phase 1 (2-3 hours)**:
1. Copy 4 files from lama: `settings/`, `types/device.ts`
2. Create SettingsProvider.tsx using Expo SettingsStore
3. Wrap app with SettingsProvider
4. Use useSettings() hook in components

**Phase 2 (1-2 hours)**:
1. Create SettingsPlan in packages/settings.core
2. Add to PlanTransportAdapter routing
3. Gain client.settings.* API

---

## Critical Points

### Device Discovery is DISABLED by Default
```typescript
// ALWAYS use this for device defaults
SettingsManager.getDefaultDeviceSettings()  // discoveryEnabled: false

// Why disabled?
// 1. Privacy - don't broadcast device presence
// 2. Security - minimize attack surface
// 3. Battery - save power on mobile
```

**DO NOT** hardcode device settings. Always use the static method.

### Settings Persist via Expo SecureStore

```typescript
// Encrypted storage for sensitive data
import { SettingsStore } from '@refinio/one.core.expo/lib/system/expo/settings-store';

const settingsManager = new SettingsManager('app_settings', SettingsStore);
await settingsManager.load();  // Loads from SecureStore
await settingsManager.save();  // Saves to SecureStore
```

### Optional PropertyTree (No AppModel Dependency)

```typescript
// Works in two modes:
constructor(storageKey = 'app_settings', propertyTree?: SettingStoreApi)
                                         // ↑ optional!

// With SettingsStore provided (lama.app):
const manager = new SettingsManager('app_settings', SettingsStore);
// ✓ Works immediately, no AppModel needed

// Without SettingsStore (fallback):
const manager = new SettingsManager('app_settings');
// ✓ Works in-memory, can't persist
```

This avoids the AppModel initialization blocking issue that plagued lama.

---

## File Locations

### All Source Files in lama (to copy from)

```
/Users/gecko/src/lama/lama/src/settings/
  ├── SettingsManager.ts   (319 lines)
  ├── types.ts             (72 lines)
  └── index.ts             (2 lines)

/Users/gecko/src/lama/lama/src/types/
  └── device.ts            (96 lines)

/Users/gecko/src/lama/lama/src/providers/app/
  └── SettingsProvider.tsx  (Reference for pattern - don't copy as-is)
```

### ONE.core Expo SettingsStore (to use from)

```
/Users/gecko/src/lama/lama/packages/one.core.expo/src/system/expo/
  └── settings-store.ts    (Implements SettingStoreApi)
```

### Your Destination (lama.app)

```
/Users/gecko/src/lama/lama.app/src/settings/        ← copy from lama
/Users/gecko/src/lama/lama.app/src/types/device.ts  ← copy from lama
/Users/gecko/src/lama/lama.app/src/providers/SettingsProvider.tsx  ← create new!
/Users/gecko/src/lama/lama.app/src/hooks/useSettings.ts            ← create new!
```

---

## Implementation Checklist

### Phase 1: React Context Integration (2-3 hours)

- [ ] Copy settings files from lama
  - [ ] src/settings/SettingsManager.ts
  - [ ] src/settings/types.ts
  - [ ] src/settings/index.ts
  - [ ] src/types/device.ts

- [ ] Create SettingsProvider
  - [ ] Create src/providers/SettingsProvider.tsx
  - [ ] Use SettingsStore from one.core.expo
  - [ ] Initialize SettingsManager with SettingsStore
  - [ ] Manage state for: language, darkMode, device, network, AI settings
  - [ ] Implement useSettings() hook
  - [ ] Handle load/save/import/export

- [ ] Wrap app with SettingsProvider
  - [ ] Modify app/_layout.tsx
  - [ ] Wrap children with <SettingsProvider>

- [ ] Test integration
  - [ ] Settings load on startup
  - [ ] Settings persist to SecureStore
  - [ ] useSettings() hook works in components
  - [ ] Settings survive app restart
  - [ ] Device defaults are correct

### Phase 2: Plan-Based Architecture (1-2 hours)

- [ ] Create SettingsPlan
  - [ ] packages/settings.core/src/plans/SettingsPlan.ts
  - [ ] Wrap SettingsManager
  - [ ] Expose async methods: get/set, device/network, import/export

- [ ] Update PlanTransportAdapter
  - [ ] Add case 'settings' in router
  - [ ] Initialize and invoke SettingsPlan
  - [ ] Map client methods to plan operations

- [ ] Update useLamaClient hook
  - [ ] Add SettingsClient interface
  - [ ] Expose client.settings.* methods

- [ ] Test plan-based access
  - [ ] client.settings.getDeviceSettings()
  - [ ] client.settings.updateDeviceSettings()
  - [ ] Device defaults work

---

## Key Design Decisions for lama.app

### Decision 1: Store via Expo SecureStore, not AppModel
**Why**: 
- No AppModel initialization dependency
- Encrypted by default
- Settings available immediately on startup
- Avoids blocking issue from lama

**How**:
```typescript
import { SettingsStore } from '@refinio/one.core.expo/lib/system/expo/settings-store';
const settingsManager = new SettingsManager('app_settings', SettingsStore);
```

### Decision 2: Load settings early, not in SettingsProvider initialization
**Why**:
- Don't wait for AppModel
- Settings immediately available
- Better startup performance

**How**:
```typescript
useEffect(() => {
  settingsManager.load()
    .then(() => { /* update state */ })
    .catch(err => { /* handle error, use defaults */ });
}, []);
```

### Decision 3: Use React Context + Plans (both!)
**Why**:
- Context for synchronous component access
- Plans for cross-platform reusability
- Gradual migration path

**How**:
- Phase 1: Context only, works immediately
- Phase 2: Plans added, components can use either/both

---

## Common Mistakes to Avoid

### ❌ DON'T hardcode device defaults
```typescript
// WRONG!
const defaults = { discoveryEnabled: false, ... };

// RIGHT!
const defaults = SettingsManager.getDefaultDeviceSettings();
```

### ❌ DON'T depend on AppModel for settings
```typescript
// WRONG!
const manager = new SettingsManager();  // No store!
const manager = new SettingsManager(key, appModel.propertyTree);  // Blocked!

// RIGHT!
const manager = new SettingsManager(key, SettingsStore);  // Ready now!
```

### ❌ DON'T assume PropertyTree always available
```typescript
// WRONG!
const tree = instance.propertyTree;  // Might be undefined!

// RIGHT!
const tree = SettingsStore;  // Always defined!
```

### ❌ DON'T forget async load
```typescript
// WRONG!
const settings = settingsManager.getAll();  // Empty, not loaded yet!

// RIGHT!
await settingsManager.load();
const settings = settingsManager.getAll();  // Now populated!
```

---

## Testing

### Basic Persistence Test
```typescript
// In your test
const manager = new SettingsManager('test', SettingsStore);

// 1. Set a value
manager.set('language', 'es');

// 2. Save to storage
await manager.save();

// 3. Create new manager, load from storage
const manager2 = new SettingsManager('test', SettingsStore);
await manager2.load();

// 4. Verify loaded
expect(manager2.get('language')).toBe('es');
```

### Device Settings Test
```typescript
// Verify defaults
const defaults = SettingsManager.getDefaultDeviceSettings();
expect(defaults.discoveryEnabled).toBe(false);
expect(defaults.discoveryPort).toBe(49497);

// Verify update
const manager = new SettingsManager('test', SettingsStore);
manager.updateDeviceSettings({ discoveryEnabled: true });
expect(manager.getDeviceSettings().discoveryEnabled).toBe(true);
```

---

## References

### Reading Order (for maximum understanding)

1. **This file** (you are here) - Overview & quick start
2. **SETTINGS_ARCHITECTURE.md** - Deep dive into design
3. **SETTINGS_FILES_MANIFEST.md** - Implementation checklist

### Key Files to Review

1. SettingsManager.ts
   - Understand load/save cycle
   - Study device/network specialized methods
   - Note static defaults methods

2. ONE.core Expo SettingsStore
   - Understand how SecureStore is wrapped
   - Async API
   - JSON serialization

3. lama SettingsProvider.tsx (reference only!)
   - Pattern for React Context
   - State management example
   - Import/export example
   - (But don't copy - adapt for Expo!)

### Unified Plan System

When implementing Phase 2, review:
- `/Users/gecko/src/lama/CLAUDE.md` - Plan architecture
- `/Users/gecko/src/lama/specs/008-unified-plan-system/` - Spec details
- `chat.core` package - Example plan implementation

---

## Troubleshooting

### "SettingsManager not available when component loads"
**Cause**: Tried to access settings before SettingsProvider renders
**Fix**: Wrap component tree with SettingsProvider
```typescript
// app/_layout.tsx
<SettingsProvider>
  <RootStack />
</SettingsProvider>
```

### "Settings not persisting"
**Cause**: Didn't pass SettingsStore to SettingsManager
**Fix**: 
```typescript
// RIGHT
const manager = new SettingsManager('key', SettingsStore);

// WRONG
const manager = new SettingsManager('key');  // No persistence!
```

### "AppModel initialization blocked"
**This was lama's problem, NOT lama.app's**
- We use Expo SettingsStore directly (not PropertyTree)
- Settings load independently of AppModel
- No blocking dependency

### "useSettings() not available"
**Cause**: Component not wrapped in SettingsProvider
**Fix**: Ensure provider wraps entire app
```typescript
// app/_layout.tsx or app.tsx
return <SettingsProvider><Stack /></SettingsProvider>;
```

---

## Next Steps

1. Read **SETTINGS_FILES_MANIFEST.md** completely
2. Copy the 4 files from lama
3. Create SettingsProvider.tsx (follow pattern from lama, use Expo SettingsStore)
4. Test Phase 1
5. Create SettingsPlan for Phase 2
6. Celebrate - settings architecture is done!

---

## Questions?

Refer to the comprehensive documents:
- SETTINGS_ARCHITECTURE.md (what/why/how)
- SETTINGS_FILES_MANIFEST.md (where/which/implementation)

Or review the source:
- lama settings (reference working implementation)
- ONE.core Expo (understand platform integration)
