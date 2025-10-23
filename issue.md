# Issue: Person Recipe Not Recognized as Versioned in Worker

## Problem

When creating AI contacts in the browser worker, `storeVersionedObject()` throws error:

```
SVO-SO2: Object is not a versioned object
{
  obj: {
    $type$: 'Person',
    email: 'qwen2.5-coder-14b@local.ai',
    name: 'Qwen 2.5 Coder 14B'
  }
}
```

**Location**: `AIContactManager.ts:94` calling `storeVersionedObject(personData)`

## Root Cause Analysis

### How Recipe Registration Works

1. `isVersionedObject()` in `object-recipes.ts` checks if `obj.$type$` is in the `versionedObjects` Set
2. This Set is populated when recipes are registered via `addRecipeToRuntime()`
3. `addRecipeToRuntime()` is called by `initInstance()` after storage is ready

### The Initialization Flow

```
oneAuth.register()
  └─> initInstance()
      ├─> initStorage() (lines 232-240)
      ├─> addCoreRecipesToRuntime() (line 245) ← Registers CORE_RECIPES
      ├─> createInstance() (lines 255-266) ← Creates Instance with initialRecipes
      ├─> Load recipes from Instance object (lines 269-271)
      └─> addRecipeToRuntime() for each recipe (lines 273-275) ← Registers all recipes
```

**Person recipe registration happens at line 273-275 in instance.ts**

### Critical Timing Issue

The Person recipe IS registered by `initInstance()`, but `storeVersionedObject()` still fails. This suggests one of:

1. **Module Instance Isolation**: Vite creates separate ONE.core bundles for worker vs main thread
   - Each has its own `versionedObjects` Set
   - Recipes registered in one instance aren't visible to another

2. **Async Race Condition**: Even though we wait for register() to complete, something is checking recipes before they're fully registered

## What We Tried

### Attempt 1: Remove Double Recipe Registration

**Changed**: Removed manual `registerRecipes()` call in worker-one-core.ts (line 158)

**Reasoning**: Avoid double registration, rely on SingleUserNoAuth's internal registration

**Result**: FAILED - Same error

### Attempt 2: Move Model Init After Login Completes

**Changed**:
- Removed `onLogin` event handler that triggered `_initModels()` during registration
- Changed `_initModels()` to be called AFTER `oneAuth.login()/register()` returns
- Added explicit wait: login/register → _initModels()

**Code**:
```typescript
// OLD (WRONG):
this.oneAuth.onLogin(this._initModels.bind(this))
// _initModels() runs DURING initInstance()

// NEW:
await this.oneAuth.login()  // or register()
console.log('✅ Login successful - all recipes registered')
await this._initModels()  // Run AFTER initInstance() completes
```

**Reasoning**: Ensure ALL recipes are registered before creating any objects

**Result**: FAILED - Same error (user confirms "it does not")

## Evidence

### Recipe IS Loaded at Module Level

```typescript
// worker-one-core.ts lines 22-35
import { CORE_RECIPES } from '@refinio/one.core/lib/recipes.js';
console.log('[WorkerOneCore] Module-level recipes loaded:', {
  core: CORE_RECIPES?.length,  // Shows correct count
  // ...
});
```

### Person Recipe Exists in CORE_RECIPES

```bash
$ grep -A15 "name: 'Person'" packages/one.core/lib/recipes.js
# Shows Person recipe with proper structure
```

### SingleUserNoAuth Passes Recipes Correctly

```typescript
// SingleUserNoAuth.ts line 60-70
await initInstance({
  // ...
  initialRecipes: this.config.recipes,  // Contains CORE_RECIPES + Stable + Experimental
  // ...
});
```

## Hypothesis: Vite Worker Bundle Isolation

### The Problem

Vite's worker build configuration creates a SEPARATE bundle for the worker:

```typescript
// vite.config.ts lines 31-38
worker: {
  format: 'es',
  rollupOptions: {
    output: {
      entryFileNames: 'worker.js'
    }
  }
}
```

This means:
- Worker has its own copy of `@refinio/one.core`
- Worker has its own `versionedObjects` Set in `object-recipes.ts`
- Main thread has a DIFFERENT `versionedObjects` Set

Even though `dedupe` is configured (line 59), workers are isolated by design.

### Why This Breaks Recipe Registration

When `storeVersionedObject()` is called in the worker:

1. Worker calls `initInstance()` → registers recipes in **worker's** `versionedObjects` Set
2. Worker calls `storeVersionedObject()` → checks **worker's** `versionedObjects` Set
3. But if they're different module instances → lookup fails!

**Critical Question**: Are the `initInstance()` and `storeVersionedObject()` imports resolving to the SAME ONE.core module instance in the worker?

## Debugging Steps Needed

1. **Verify module instance**:
   ```typescript
   import { versionedObjects } from '@refinio/one.core/lib/object-recipes.js';
   console.log('versionedObjects Set ID:', versionedObjects);
   // Log this in initInstance() AND in storeVersionedObject()
   // If different objects → module duplication confirmed
   ```

2. **Check recipe registration**:
   ```typescript
   // After initInstance() completes
   import { hasRecipe, isVersionedObjectType } from '@refinio/one.core/lib/object-recipes.js';
   console.log('hasRecipe("Person"):', hasRecipe('Person'));
   console.log('isVersionedObjectType("Person"):', isVersionedObjectType('Person'));
   ```

3. **Check actual Set contents**:
   ```typescript
   // In worker after login
   import { getKnownTypes } from '@refinio/one.core/lib/object-recipes.js';
   console.log('Known versioned types:', Array.from(getKnownTypes()));
   ```

## Potential Solutions

### Option 1: Manual Recipe Registration in Worker

Register recipes directly in worker BEFORE calling any storage functions:

```typescript
import { addRecipeToRuntime } from '@refinio/one.core/lib/object-recipes.js';
import { CORE_RECIPES } from '@refinio/one.core/lib/recipes.js';

// BEFORE oneAuth.login()
for (const recipe of CORE_RECIPES) {
  addRecipeToRuntime(recipe);
}
```

**Risk**: Double registration throws error (line 240 in object-recipes.ts)

### Option 2: Fix Vite Worker Module Resolution

Ensure worker uses EXACT same ONE.core instance as main thread.

**Problem**: Workers are isolated by design - may not be possible

### Option 3: Use SharedWorker or MessageChannel

Don't run ONE.core in worker - use main thread instance and communicate via messages.

**Problem**: Defeats purpose of worker isolation

### Option 4: Explicitly Export and Check versionedObjects Set

Make the internal Set accessible for debugging:

```typescript
// In object-recipes.ts
export { versionedObjects }; // Currently private

// In worker
import { versionedObjects } from '@refinio/one.core/lib/object-recipes.js';
console.log('Set contents:', Array.from(versionedObjects));
```

## Files Involved

- `/Users/gecko/src/lama/lama.browser/worker/core/worker-one-core.ts` - Worker initialization
- `/Users/gecko/src/lama/lama.core/models/ai/AIContactManager.ts:94` - Where error occurs
- `/Users/gecko/src/lama/lama.browser/packages/one.core/src/object-recipes.ts:303` - `isVersionedObject()` check
- `/Users/gecko/src/lama/lama.browser/packages/one.core/src/instance.ts:191` - Recipe registration
- `/Users/gecko/src/lama/lama.browser/packages/one.models/src/models/Authenticator/SingleUserNoAuth.ts` - Auth flow
- `/Users/gecko/src/lama/lama.browser/vite.config.ts` - Worker bundle config

## Status

**UNRESOLVED** - Person recipe registration timing issue persists even after moving initialization after login completes.

Next step: Add debugging to verify if worker has separate ONE.core module instance.
