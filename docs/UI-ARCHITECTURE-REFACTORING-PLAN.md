# UI Architecture Refactoring Plan

## Problem Statement

The current UI architecture has fundamental design flaws that need to be addressed:

### Critical Issues

#### 1. **Wrong Module Location**
- UI infrastructure lives in `lama.core/ui/`
- **Problem**: `lama.core` is a business logic module, not a UI infrastructure module
- **Impact**: Violates separation of concerns, creates tight coupling between business logic and UI infrastructure
- **Evidence**: `lama.core/package.json` exports both business logic (`./plans/*`, `./services/*`) and UI (`./ui/contexts/*`)

#### 2. **Incomplete Migration**
- Components are split across three locations:
  - `lama.ui/src/components/` - 66 exported items (partial migration)
  - `lama.browser/browser-ui/src/components/` - 55+ components (original location)
  - `lama.cube/electron-ui/src/components/` - 42+ components (duplicate implementations)
- **Problem**: No single source of truth for UI components
- **Impact**: Duplication, inconsistency, maintenance overhead

#### 3. **No React Native Support**
- All docs mention React Native/Expo as a goal
- **Problem**: No actual React Native implementation exists
- **Impact**: Cannot build mobile apps despite architecture claiming to support it

#### 4. **Unclear Boundaries**
- What goes in `lama.core/ui` vs `lama.ui` is not clearly defined
- **Problem**: Inconsistent decisions about where code belongs
- **Impact**: Confusion, wrong placement of new code

#### 5. **Multiple Migration Strategies**
- Three different strategy documents with conflicting approaches:
  - UI-PLATFORM-AGNOSTIC-MIGRATION.md (infrastructure to lama.core/ui)
  - UI-CONSOLIDATION-STRATEGY.md (piecemeal migration, 6-8 weeks)
  - UI-WHOLESALE-ADOPTION-STRATEGY.md (wholesale copy, 2-3 weeks)
- **Problem**: No clear decision on which approach to follow
- **Impact**: Paralysis, incomplete migrations

## What Was Intended

Based on the user's statement, the intended architecture was:

1. **ui.core** - Dedicated UI infrastructure module
   - Platform-agnostic React infrastructure
   - Context providers, types, transport adapters
   - Routing abstractions
   - React Native compatible

2. **lama.browser UI components** - Reusable across platforms
   - All UI components from lama.browser
   - Used by web, Electron, and React Native platforms
   - Single source of truth

3. **Platform-specific implementations**
   - Each platform provides adapters
   - Minimal platform-specific code
   - Maximum code reuse

## Proposed Architecture

### Module Structure

```
src/lama/
├── ui.core/                    # NEW - UI Infrastructure Module
│   ├── contexts/               # React contexts (PlansContext, etc.)
│   ├── types/                  # UI types (LAMAPlans, LLMConfig, etc.)
│   ├── transport/              # Transport adapters (IPC, HTTP, Stdio)
│   ├── routing/                # Routing infrastructure
│   ├── hooks/                  # Platform-agnostic React hooks
│   └── package.json            # @lama/ui-core
│
├── lama.ui/                    # UI Components Library
│   ├── components/             # ALL shared components
│   │   ├── ui/                 # Primitives (shadcn/ui)
│   │   ├── chat/               # Chat components
│   │   ├── settings/           # Settings components
│   │   ├── device/             # Device components
│   │   └── ...                 # All other components
│   ├── lib/                    # UI utilities
│   ├── styles/                 # Shared styles
│   └── package.json            # Depends on @lama/ui-core
│
├── lama.browser/
│   └── browser-ui/             # Browser Platform
│       ├── src/
│       │   ├── adapters/       # Browser-specific adapters
│       │   ├── model/          # Model instantiation
│       │   ├── initialization/ # ONE.core setup
│       │   └── App.tsx         # Entry point
│       └── package.json        # Depends on @lama/ui
│
├── lama.cube/
│   └── electron-ui/            # Electron Platform
│       ├── src/
│       │   ├── adapters/       # Electron IPC adapters
│       │   ├── bridge/         # IPC bridge
│       │   └── App.tsx         # Entry point
│       └── package.json        # Depends on @lama/ui
│
├── lama.native/                # NEW - React Native Platform
│   ├── src/
│   │   ├── adapters/           # React Native adapters
│   │   ├── navigation/         # React Navigation setup
│   │   └── App.tsx             # Entry point
│   └── package.json            # Depends on @lama/ui-core
│                               # (Uses React Native UI components)
│
└── lama.core/                  # Business Logic ONLY
    ├── plans/                  # Business logic plans
    ├── services/               # LLM services, etc.
    ├── models/                 # Data models
    └── package.json            # NO UI exports
```

### Dependency Graph

```
┌─────────────────────────────────────────────────────┐
│         Platform Implementations                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  lama.browser    lama.cube    lama.native          │
│  (Browser)       (Electron)   (React Native)       │
│       │              │              │               │
│       └──────────────┼──────────────┘               │
│                      │                              │
└──────────────────────┼──────────────────────────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │     @lama/ui         │  ◄─── Web UI Components
            │  (React Web)         │       (shadcn/ui, CSS)
            └──────────┬───────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │   @lama/ui-core      │  ◄─── UI Infrastructure
            │  (Platform-agnostic) │       (Contexts, Types)
            └──────────┬───────────┘       (React Native ✓)
                       │
                       ▼
            ┌──────────────────────┐
            │    @lama/core        │  ◄─── Business Logic
            │  (Business Logic)    │       (Plans, Services)
            └──────────────────────┘       (No UI code)
```

### Clear Boundaries

| Module | Purpose | Contains | Exports | Dependencies |
|--------|---------|----------|---------|--------------|
| **ui.core** | UI Infrastructure | Contexts, Types, Transport, Routing, Hooks | React primitives, interfaces, adapters | react (peer dep) |
| **lama.ui** | Web UI Components | React components, shadcn/ui, Tailwind CSS | All shared components | @lama/ui-core, @radix-ui/*, react |
| **lama.core** | Business Logic | Plans, Services, Models | Business logic only | ONE.core, chat.core, etc. |
| **lama.browser** | Browser Platform | Browser adapters, Model initialization | None (entry point) | @lama/ui, @lama/core |
| **lama.cube** | Electron Platform | IPC adapters, Electron bridge | None (entry point) | @lama/ui, @lama/core |
| **lama.native** | React Native Platform | React Native adapters, navigation | None (entry point) | @lama/ui-core, @lama/core |

## Migration Plan

### Phase 1: Create ui.core Module (Days 1-2)

**Objective**: Extract UI infrastructure from lama.core to dedicated ui.core module

**Actions**:
1. Create `ui.core/` directory structure
2. Create `ui.core/package.json` as `@lama/ui-core`
3. Move `lama.core/ui/` → `ui.core/src/`
4. Update exports in `ui.core/package.json`
5. Remove UI exports from `lama.core/package.json`
6. Add React peer dependency to ui.core

**Files to Move**:
```bash
lama.core/ui/contexts/    → ui.core/src/contexts/
lama.core/ui/types/       → ui.core/src/types/
lama.core/ui/transport/   → ui.core/src/transport/
lama.core/ui/routing/     → ui.core/src/routing/
lama.core/ui/lib/         → ui.core/src/lib/
```

**Verification**:
- [ ] `lama.core` has no UI code
- [ ] `ui.core` builds successfully
- [ ] All UI types and contexts exported from `@lama/ui-core`

### Phase 2: Update lama.ui Dependencies (Day 3)

**Objective**: Change lama.ui to depend on @lama/ui-core instead of @lama/core

**Actions**:
1. Update `lama.ui/package.json`:
   - Remove: `"@lama/core": "file:../lama.core"`
   - Add: `"@lama/ui-core": "file:../ui.core"`
2. Update all imports in `lama.ui/src/`:
   - Change: `@lama/core/ui/*` → `@lama/ui-core/*`
3. Update `lama.ui/src/index.ts` re-exports
4. Run typecheck: `npm run typecheck`

**Verification**:
- [ ] `lama.ui` imports only from `@lama/ui-core`
- [ ] No imports from `@lama/core` in UI code
- [ ] TypeScript compiles without errors

### Phase 3: Consolidate Components (Days 4-7)

**Objective**: Move ALL components from lama.browser and lama.cube to lama.ui

**Strategy**: Wholesale adoption (fastest approach)

**Actions**:
1. **Audit components**:
   - Identify all components in `lama.browser/browser-ui/src/components/`
   - Identify all components in `lama.cube/electron-ui/src/components/`
   - Create component inventory with dependencies

2. **Move to lama.ui**:
   ```bash
   # Copy all browser components
   cp -r lama.browser/browser-ui/src/components/* lama.ui/src/components/

   # Merge with existing lama.ui components (resolve conflicts)
   # Keep the most mature implementation
   ```

3. **Update imports**:
   - Change `@/model` → use `usePlans()` from `@lama/ui-core`
   - Change platform-specific imports → use dependency injection
   - Add missing components to `lama.ui/src/index.ts`

4. **Handle platform-specific components**:
   - Create `lama.ui/src/components/platform/` directory
   - Add capability flags to `PlatformAdapter` interface
   - Use conditional rendering for platform-specific features

**Verification**:
- [ ] All reusable components in `lama.ui`
- [ ] No duplicate components across platforms
- [ ] All components exported from `@lama/ui`
- [ ] TypeScript compiles without errors

### Phase 4: Update Platform Implementations (Days 8-10)

**Objective**: Update browser and Electron platforms to use consolidated UI

**Browser (lama.browser)**:
1. Update imports: `@/components/*` → `@lama/ui`
2. Remove old components from `browser-ui/src/components/`
3. Keep only: adapters, model, initialization, App.tsx
4. Verify app works identically

**Electron (lama.cube)**:
1. Update imports: local components → `@lama/ui`
2. Remove old components from `electron-ui/src/components/`
3. Keep only: adapters, bridge, App.tsx
4. Verify app works identically

**Verification**:
- [ ] lama.browser works with `@lama/ui` components
- [ ] lama.cube works with `@lama/ui` components
- [ ] Both platforms have identical UI
- [ ] No duplicate component implementations

### Phase 5: Platform Adapter Pattern (Days 11-12)

**Objective**: Standardize platform integration with clean adapter pattern

**Actions**:
1. Define `PlatformAdapter` interface in `ui.core/src/types/platform.ts`:
   ```typescript
   export interface PlatformAdapter {
     // Plans access
     plans: LAMAPlans

     // Platform capabilities
     capabilities: {
       hasStorageQuota: boolean
       hasSubscriptions: boolean
       hasFileSystem: boolean
       // ...
     }

     // Platform-specific operations
     getStorageQuota?(): Promise<StorageQuota>
     // ...
   }
   ```

2. Create adapters for each platform:
   - `lama.browser/src/adapters/BrowserPlatformAdapter.ts`
   - `lama.cube/src/adapters/ElectronPlatformAdapter.ts`

3. Update `PlatformProvider` in `ui.core` to use adapter

4. Update components to use `usePlatform()` hook

**Verification**:
- [ ] All platforms implement `PlatformAdapter`
- [ ] Components use `usePlatform()` instead of platform-specific code
- [ ] Platform-specific features guarded by capability flags

### Phase 6: Documentation (Day 13)

**Objective**: Update all documentation to reflect new architecture

**Actions**:
1. Archive old docs:
   - Move UI-PLATFORM-AGNOSTIC-MIGRATION.md to `docs/archive/`
   - Move UI-CONSOLIDATION-STRATEGY.md to `docs/archive/`
   - Move UI-WHOLESALE-ADOPTION-STRATEGY.md to `docs/archive/`

2. Create new docs:
   - `docs/UI-ARCHITECTURE.md` - Canonical architecture doc
   - `ui.core/README.md` - UI infrastructure guide
   - `lama.ui/README.md` - Component library guide (update existing)

3. Update related docs:
   - `lama.browser/CLAUDE.md` - Update UI references
   - `lama.cube/CLAUDE.md` - Update UI references

**Verification**:
- [ ] Single source of truth for UI architecture
- [ ] All docs reference correct module locations
- [ ] Examples use correct import paths

### Phase 7: React Native Preparation (Day 14)

**Objective**: Prepare for React Native platform (don't implement yet)

**Actions**:
1. Verify `ui.core` has no web-specific dependencies:
   - No DOM API usage
   - No web-specific imports
   - Pure React + TypeScript

2. Document React Native strategy:
   - Which components need React Native versions
   - How to handle navigation
   - How to handle styling

3. Create placeholder:
   - `lama.native/` directory structure
   - `lama.native/package.json` with dependencies
   - `lama.native/README.md` with implementation plan

**Verification**:
- [ ] `ui.core` is React Native compatible
- [ ] Clear plan for React Native implementation
- [ ] Foundation ready for mobile development

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1. Create ui.core | 2 days | Dedicated UI infrastructure module |
| 2. Update lama.ui | 1 day | lama.ui depends on ui.core |
| 3. Consolidate components | 4 days | All components in lama.ui |
| 4. Update platforms | 3 days | Platforms use @lama/ui |
| 5. Platform adapters | 2 days | Clean adapter pattern |
| 6. Documentation | 1 day | Updated architecture docs |
| 7. React Native prep | 1 day | Foundation for mobile |
| **TOTAL** | **14 days** | **Clean, proper architecture** |

## Success Criteria

### Architecture

✅ **Separation of Concerns**
- `lama.core` contains ONLY business logic (no UI code)
- `ui.core` contains ONLY UI infrastructure (contexts, types, adapters)
- `lama.ui` contains ONLY UI components
- Each platform contains ONLY platform-specific code

✅ **Single Source of Truth**
- ONE location for UI infrastructure: `ui.core`
- ONE location for UI components: `lama.ui`
- NO duplicate component implementations
- NO split component libraries

✅ **Clear Dependencies**
- Platforms depend on `@lama/ui` (Web/Electron)
- Platforms depend on `@lama/ui-core` (React Native)
- `lama.ui` depends on `@lama/ui-core`
- `ui.core` depends ONLY on React
- NO UI dependencies in `lama.core`

✅ **React Native Ready**
- `ui.core` is platform-agnostic (no DOM, no web APIs)
- Clear separation between web-specific (lama.ui) and universal (ui.core)
- Foundation exists for React Native implementation

✅ **Maintainability**
- Clear boundaries - developers know where code belongs
- No architectural debt
- Easy to add new platforms
- Easy to add new components

### Technical

- [ ] All TypeScript compiles without errors
- [ ] All platforms run successfully
- [ ] UI behavior identical across platforms
- [ ] No broken imports
- [ ] No circular dependencies
- [ ] Tests pass (if any exist)

## Risks & Mitigations

### Risk: Breaking existing code
**Mitigation**:
- Test after each phase
- Keep platforms working throughout
- Use git branches for safe experimentation

### Risk: Import path changes break platforms
**Mitigation**:
- Use TypeScript compiler to catch broken imports
- Update imports incrementally
- Verify both platforms after each change

### Risk: Component conflicts during consolidation
**Mitigation**:
- Audit components first (inventory)
- Choose most mature implementation
- Test both versions before committing

### Risk: Lost productivity during migration
**Mitigation**:
- Keep platforms working throughout
- Prioritize component consolidation
- Don't block feature development

## Next Steps

1. **Review this plan** - Get approval on approach
2. **Create ui.core** - Start with Phase 1
3. **Execute phases sequentially** - Test after each phase
4. **Update docs as you go** - Keep docs in sync with code
5. **Celebrate clean architecture** - When done, you'll have a proper foundation

## Appendix: Module Ownership

| Module | Owner | Responsibility |
|--------|-------|----------------|
| **ui.core** | UI Infrastructure Team | React contexts, types, transport, routing |
| **lama.ui** | UI Components Team | Shared components, design system |
| **lama.core** | Business Logic Team | Plans, services, models |
| **lama.browser** | Browser Platform Team | Browser adapters, IndexedDB |
| **lama.cube** | Electron Platform Team | IPC adapters, Electron bridge |
| **lama.native** | Mobile Platform Team | React Native adapters, navigation |
