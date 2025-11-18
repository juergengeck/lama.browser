# Assembly Core Refactoring Plan

## Executive Summary

Consolidate assembly.core types to use canonical names (`Assembly`, `Plan`, `Story`) instead of prefixed variants (`CubeAssembly`, `AssemblyPlan`, `AssemblyStory`). Move Supply/Demand to shared location since they're foundational matching primitives.

## Current State Analysis

### 1. Conflicting Supply/Demand Definitions

**one.models/MatchingRecipes.ts** - Simple identity matching:
```typescript
interface Supply {
    $type$: 'Supply';
    identity: string;        // Person ID
    match: string;           // Match pattern
    isActive: boolean;
    timestamp: number;
}

interface Demand {
    $type$: 'Demand';
    identity: string;
    match: string;
    isActive: boolean;
    timestamp: number;
}
```
- Used for: User-to-user matching (dating, networking, etc.)
- Scope: Identity-based discovery

**assembly.core/types/Assembly.ts** - Rich knowledge/capability matching:
```typescript
interface Supply {
    domain: string;                      // 'conversation', 'capability', 'memory', 'tool'
    subjects: string[];                  // SHA256Hash - thematic combinations
    keywords: string[];                  // SHA256Hash - atomic concepts
    ownerId?: SHA256IdHash<Person>;
    verifiableCredentials?: VerifiableCredential[];
}

interface Demand {
    domain: string;
    keywords: string[];                  // SHA256Hash
    trustLevel?: 'me' | 'trusted' | 'group' | 'public';
    groupHash?: SHA256IdHash<Group>;
}
```
- Used for: Knowledge/capability matching, Assembly creation
- Scope: Domain-specific with trust verification

**Decision:** These serve DIFFERENT purposes. Keep both but rename one.models version to avoid collision.

### 2. Type Name Inconsistencies

| Concept | Type Definition ($type$) | Recipe Name | Target $type$ | Status |
|---------|-------------------------|-------------|---------------|--------|
| Assembly | 'CubeAssembly' | 'Assembly' | 'Assembly' | ❌ Mismatch |
| Plan | 'AssemblyPlan' | 'AssemblyPlan' | 'Plan' | ❌ Wrong |
| Story | 'AssemblyStory' | 'Story' | 'Story' | ❌ Mismatch |

**refinio.api already uses correct names:**
- `$type$: 'Assembly'` ✅
- `$type$: 'Story'` ✅

### 3. Current Files Using Old Names

**assembly.core:**
- `types/Assembly.ts` - Type definitions
- `recipes/AssemblyRecipe.ts` - Recipe for Assembly (name is correct)
- `recipes/PlanRecipe.ts` - Recipe name 'AssemblyPlan' (needs rename)
- `recipes/StoryRecipe.ts` - Recipe name 'Story' (correct)
- `plans/AssemblyPlan.ts` - Service class (name OK, creates objects)
- `handlers/AssemblyHandler.ts` - Business logic

**lama.core:**
- `plans/JournalPlan.ts` - Creates objects with `$type$: 'AssemblyPlan'`
- `plans/ProposalInteractions.ts` - Creates `$type$: 'ProposalInteractionPlan'`

**chat.core:**
- `plans/GroupPlan.ts` - Creates `$type$: 'AssemblyStory'`

## Target Architecture

### 1. Canonical Type Names

```typescript
// assembly.core/types/Assembly.ts
export interface Assembly {
    $type$: 'Assembly';  // ← Changed from 'CubeAssembly'
    storyRef: SHA256IdHash<Story>;
    supply: Supply;
    demand: Demand;
    instanceVersion: string;
    children?: string[];
    // ... rest unchanged
}

export interface Plan {
    $type$: 'Plan';  // ← Changed from 'AssemblyPlan'
    id: string;
    name: string;
    demandPatterns: DemandPattern[];
    supplyPatterns: SupplyPattern[];
    // ... rest unchanged
}

export interface Story {
    $type$: 'Story';  // ← Changed from 'AssemblyStory'
    id: string;
    title: string;
    description: string;
    plan: SHA256IdHash<Plan>;
    product: SHA256IdHash<Assembly>;
    // ... rest unchanged
}
```

### 2. Supply/Demand Organization

**Option A: Keep in assembly.core (Recommended)**
- Supply/Demand are tightly coupled to Assembly
- Assembly embeds Supply/Demand inline
- assembly.core is the platform-agnostic foundation

**Option B: Move to one.core**
- Makes them available to all packages
- But one.core doesn't have domain concepts yet
- Requires one.core changes

**Option C: Create matching.core**
- Dedicated package for matching primitives
- Most modular but adds complexity

**Recommended: Option A** - Keep in assembly.core, export for use elsewhere

**For one.models MatchingRecipes:**
- Rename to `IdentitySupply` and `IdentityDemand`
- Update $type$ to 'IdentitySupply' / 'IdentityDemand'
- Clarify they're for identity-based matching only

### 3. Recipe Names

```typescript
// assembly.core/recipes/PlanRecipe.ts
export const PlanRecipe: Recipe = {
    $type$: 'Recipe',
    name: 'Plan',  // ← Changed from 'AssemblyPlan'
    // ... rest unchanged
};
```

**Update allowedTypes references:**
- AssemblyRecipe: `allowedTypes: new Set(['Story', 'Plan'])`  (was 'AssemblyPlan')
- StoryRecipe: `allowedTypes: new Set(['Plan', 'Assembly'])`  (was 'AssemblyPlan', 'Assembly')

## Migration Steps

### Phase 1: Update assembly.core Types (BREAKING CHANGE)

1. **Update type definitions** - `assembly.core/types/Assembly.ts`
   ```typescript
   // Change $type$ fields:
   Assembly: $type$: 'Assembly'  (was 'CubeAssembly')
   Plan: $type$: 'Plan'  (was 'AssemblyPlan')
   Story: $type$: 'Story'  (was 'AssemblyStory')
   ```

2. **Update recipes** - `assembly.core/recipes/`
   - PlanRecipe: Change name to 'Plan'
   - Update all `allowedTypes` references

3. **Update @OneObjectInterfaces** - `assembly.core/types/Assembly.ts`
   ```typescript
   declare module '@OneObjectInterfaces' {
       export interface OneVersionedObjectInterfaces {
           Plan: Plan;          // was AssemblyPlan
           Assembly: Assembly;  // was CubeAssembly (if added)
           Story: Story;        // was AssemblyStory (if added)
       }
   }
   ```

4. **Update implementation** - `assembly.core/plans/AssemblyPlan.ts`
   - Change all `$type$` assignments to new names

### Phase 2: Update Dependent Packages

1. **lama.core**
   - `plans/JournalPlan.ts` - Change `$type$: 'Plan'`
   - Update all Plan creation calls

2. **chat.core**
   - `plans/GroupPlan.ts` - Change `$type$: 'Story'`

3. **lama.cube**
   - Update any Plan/Story/Assembly creation
   - Update type references

### Phase 3: Rename one.models MatchingRecipes (Optional)

1. Rename interfaces:
   - `Supply` → `IdentitySupply`
   - `Demand` → `IdentityDemand`

2. Update recipes:
   - `SupplyRecipe` → name: 'IdentitySupply'
   - `DemandRecipe` → name: 'IdentityDemand'

3. Update usages in one.discovery or other packages

### Phase 4: Database Migration

**CRITICAL:** Existing stored objects have old $type$ values!

**Options:**
A. **Migration script** - Read all objects, update $type$, re-store
B. **Recipe aliases** - Register both old and new names temporarily
C. **Version flag** - Add version field, support both during transition

**Recommended: Option B** for backward compatibility:
```typescript
// Temporary: Register old names as aliases
export const CubeAssemblyRecipe: Recipe = AssemblyRecipe;  // Alias
export const AssemblyPlanRecipe: Recipe = PlanRecipe;      // Alias
export const AssemblyStoryRecipe: Recipe = StoryRecipe;    // Alias
```

## File Changes Checklist

### assembly.core/
- [x] `types/Assembly.ts` - Update $type$ fields, update module declaration
- [x] `recipes/PlanRecipe.ts` - Change name to 'Plan'
- [x] `recipes/AssemblyRecipe.ts` - Update allowedTypes references
- [x] `recipes/StoryRecipe.ts` - Update allowedTypes references
- [x] `plans/AssemblyPlan.ts` - Update all $type$ assignments
- [x] `handlers/AssemblyHandler.ts` - No changes (uses types)
- [x] `index.ts` - Export updated types
- [x] `CLAUDE.md` - Update documentation
- [x] `README.md` - Update examples

### packages/refinio.api/
- [x] `src/stories/AssemblyPlan.ts` - Already uses correct names ✅
- [x] `src/types/story-execution.ts` - Verify Supply/Demand match assembly.core

### lama.core/
- [x] `plans/JournalPlan.ts` - Update $type$: 'Plan'
- [x] `plans/ProposalInteractions.ts` - Update if using Assembly types
- [x] `@OneObjectInterfaces.d.ts` - Update interface names

### chat.core/
- [x] `plans/GroupPlan.ts` - Update $type$: 'Story'

### lama.cube/
- [x] Search for 'AssemblyPlan', 'CubeAssembly', 'AssemblyStory' and update

### packages/one.models/ (Optional)
- [ ] `src/recipes/MatchingRecipes.ts` - Rename to IdentitySupply/IdentityDemand
- [ ] Update dependent code in one.discovery

## Testing Strategy

1. **Unit tests** - Update expected $type$ values
2. **Integration tests** - Verify cross-package compatibility
3. **Storage tests** - Verify objects can be stored/retrieved with new types
4. **Migration tests** - Verify old objects can still be read (if using aliases)

## Rollback Plan

If issues arise:
1. Revert type changes in assembly.core
2. Keep recipe aliases indefinitely
3. Document as "deprecated but supported"

## Timeline

- **Phase 1** (assembly.core): 2-4 hours
- **Phase 2** (dependent packages): 2-3 hours
- **Phase 3** (one.models rename): 1-2 hours (optional)
- **Phase 4** (migration/testing): 2-4 hours

**Total: 7-13 hours**

## Risk Assessment

**High Risk:**
- Database objects with old $type$ values become unreadable
- Mitigation: Recipe aliases

**Medium Risk:**
- Breaking changes in dependent packages
- Mitigation: Coordinated update, version bump

**Low Risk:**
- Documentation drift
- Mitigation: Update all CLAUDE.md files

## Success Criteria

✅ All $type$ fields use canonical names (Assembly, Plan, Story)
✅ No 'CubeAssembly', 'AssemblyPlan', 'AssemblyStory' in codebase
✅ refinio.api and assembly.core use identical type names
✅ All tests pass
✅ Existing objects can still be read (via aliases or migration)
✅ Supply/Demand types are clearly documented and non-conflicting

## Next Steps

1. Review this plan with team
2. Create feature branch: `refactor/unified-assembly-types`
3. Execute Phase 1 (assembly.core)
4. Test thoroughly
5. Execute Phase 2 (dependent packages)
6. Merge and deploy

---
*This refactoring establishes the foundation for a clean, unified plan-based architecture where Assembly, Plan, and Story are the canonical types across the entire platform.*
