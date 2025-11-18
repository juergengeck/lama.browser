# Story/Assembly Implementation - Phase 1 Complete

## Summary

Story/Assembly automation has been successfully integrated into **ChatPlan** as the first implementation. This serves as the pattern for all other Plans.

## What Was Implemented

### ChatPlan Integration (/Users/gecko/src/lama/chat.core/plans/ChatPlan.ts)

1. **Added StoryFactory injection**
   - Added `storyFactory?: StoryFactory` to constructor (optional for gradual adoption)
   - Added import: `import type { StoryFactory } from '@refinio/refinio.api/dist/plan-system-index.js';`

2. **Added static planId getter**
   ```typescript
   static get planId(): SHA256IdHash<any> {
     return 'plan-chat-core-v1' as SHA256IdHash<any>;
   }
   ```

3. **Added instance version helper**
   ```typescript
   private getCurrentInstanceVersion(): string {
     return this.nodeOneCore.instanceVersion || `instance-${Date.now()}`;
   }
   ```

4. **Wrapped sendMessage() with Story recording** (Story-only, no Assembly)
   - Created `sendMessageInternal()` for actual logic
   - Wrapped with `storyFactory.recordExecution()` when available
   - Falls back to direct call if no StoryFactory (gradual adoption)

5. **Wrapped createConversation() with Story + Assembly** (Trigger case #4/#6)
   - Created `createConversationInternal()` for actual logic
   - Wrapped with `storyFactory.recordExecution()` including supply/demand
   - Triggers Assembly creation when creating chat/group chat

### Package Dependencies

- Added `"@refinio/refinio-api": "*"` to chat.core/package.json peerDependencies
- Packages linked via existing packages/ symlink
- Import path: `@refinio/refinio.api/dist/plan-system-index.js`

### Build Status

✅ chat.core builds successfully
✅ assembly.core builds successfully
✅ refinio.api builds successfully

## Integration Pattern for Other Plans

### Step 1: Update Package Dependencies

```json
// package.json
{
  "peerDependencies": {
    "@refinio/one.core": "*",
    "@refinio/one.models": "*",
    "@refinio/refinio-api": "*"  // Add this
  }
}
```

### Step 2: Add Imports

```typescript
import type { StoryFactory } from '@refinio/refinio.api/dist/plan-system-index.js';
```

### Step 3: Update Constructor

```typescript
export class SomePlan {
  // Add static metadata
  static get name(): string { return 'SomePlan'; }
  static get description(): string { return 'Plan description'; }
  static get version(): string { return '1.0.0'; }

  // Add static planId
  static get planId(): SHA256IdHash<any> {
    return 'plan-someplan-v1' as SHA256IdHash<any>;
  }

  private storyFactory?: StoryFactory;

  constructor(
    nodeOneCore: any,
    // ... other dependencies
    storyFactory?: StoryFactory  // Add as optional parameter
  ) {
    this.nodeOneCore = nodeOneCore;
    this.storyFactory = storyFactory;
  }

  // Add helper method
  private getCurrentInstanceVersion(): string {
    return this.nodeOneCore.instanceVersion || `instance-${Date.now()}`;
  }
}
```

### Step 4: Wrap Operations

#### Story-Only Operations (Most Methods)

```typescript
async someOperation(request: SomeRequest): Promise<SomeResponse> {
  const userId = this.nodeOneCore.ownerId;

  // Wrap with Story recording
  if (this.storyFactory) {
    try {
      const result = await this.storyFactory.recordExecution(
        {
          title: 'Human-readable operation name',
          description: 'What this does',
          planId: SomePlan.planId,
          owner: userId || 'unknown',
          domain: 'conversation',  // or 'identity', 'knowledge', etc.
          instanceVersion: this.getCurrentInstanceVersion()
          // NO supply/demand for simple operations
        },
        async () => {
          return await this.someOperationInternal(request, userId);
        }
      );

      return result.result!;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // Fallback if no StoryFactory
  return await this.someOperationInternal(request, userId);
}

private async someOperationInternal(request: SomeRequest, userId: string | null): Promise<SomeResponse> {
  // Original implementation here
  // Throw errors instead of returning error responses
}
```

#### Story + Assembly Operations (Trigger Cases)

For the 11 defined trigger cases (see ASSEMBLY-TRIGGER-CASES.md):

```typescript
async createInvite(request: CreateInviteRequest): Promise<CreateInviteResponse> {
  const userId = this.nodeOneCore.ownerId;

  if (this.storyFactory) {
    try {
      const result = await this.storyFactory.recordExecution(
        {
          title: 'Create connection invite',
          description: `Creating invite for ${request.recipientName}`,
          planId: ConnectionPlan.planId,
          owner: userId || 'unknown',
          domain: 'identity',
          instanceVersion: this.getCurrentInstanceVersion(),

          // TRIGGER ASSEMBLY CREATION
          supply: {
            domain: 'identity',
            keywords: ['invitation', 'connection-offer'],
            ownerId: userId || 'unknown',
            verifiableCredentials: [], // Add if available
            subjects: []
          },
          demand: {
            domain: 'identity',
            keywords: ['connection-request', 'trust-establishment'],
            trustLevel: 'trusted'
          },
          matchScore: 1.0
        },
        async () => {
          return await this.createInviteInternal(request, userId);
        }
      );

      return result.result!;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  return await this.createInviteInternal(request, userId);
}
```

## Next Plans to Implement

### Priority Order (Tier 1)

1. **ContactsPlan** - User creation, group creation, invites
2. **ConnectionPlan** - Create invite, accept invite
3. **AIPlan** - AI response generation (optional, if exists)

### Implementation Checklist

For each Plan:

- [ ] Add `@refinio/refinio-api` to package.json peerDependencies
- [ ] Add StoryFactory import
- [ ] Add storyFactory to constructor (optional parameter)
- [ ] Add static planId getter
- [ ] Add getCurrentInstanceVersion() helper
- [ ] Identify operations to wrap
- [ ] For each operation:
  - [ ] Create internal implementation method
  - [ ] Wrap with storyFactory.recordExecution()
  - [ ] Add supply/demand if it's a trigger case
  - [ ] Test Story creation
  - [ ] Test Assembly creation (if applicable)
- [ ] Build and verify no TypeScript errors
- [ ] Document in Plan's JSDoc

## Platform Integration (NOT YET DONE)

Platforms (lama.cube, lama.browser) need to:

1. Initialize AssemblyHandler
2. Create StoryFactory
3. Pass StoryFactory to Plan constructors

Example (lama.cube):

```typescript
import { AssemblyHandler } from '@assembly/core';
import { StoryFactory } from '@refinio/refinio.api/dist/plan-system-index.js';
import { ChatPlan } from '@chat/core/plans/ChatPlan.js';

// Initialize AssemblyHandler
const assemblyHandler = new AssemblyHandler({
  oneCore: nodeOneCore,
  storeVersionedObject,
  getObjectByIdHash,
  getObject
});

// Create StoryFactory
const storyFactory = new StoryFactory(assemblyHandler);

// Inject into Plans
const chatPlan = new ChatPlan(
  nodeOneCore,
  stateManager,
  messageVersionManager,
  messageAssertionManager,
  storyFactory  // Add here
);
```

## Testing Approach

1. **Phase 1** (Current): ChatPlan with StoryFactory optional
   - Test with StoryFactory = undefined (existing behavior)
   - Test with StoryFactory = instance (new behavior)

2. **Phase 2**: Platform integration
   - Initialize AssemblyHandler in platform
   - Pass StoryFactory to Plans
   - Verify Stories are created in ONE.core storage

3. **Phase 3**: Verify Assembly creation
   - Test chat creation
   - Verify Assembly created with supply/demand
   - Check dimensional properties (owner, domain, etc.)

4. **Phase 4**: Journal view integration
   - Query Stories by owner, domain, time
   - Query Assemblies by plan, owner
   - Display in journal view

## Current Status

✅ **Phase 1 Complete**: ChatPlan integrated with Story/Assembly automation
🔄 **Next**: Implement ContactsPlan and ConnectionPlan
⏳ **Pending**: Platform initialization and testing

## Files Modified

- `/Users/gecko/src/lama/chat.core/plans/ChatPlan.ts` - Story/Assembly integration
- `/Users/gecko/src/lama/chat.core/package.json` - Added refinio-api dependency
- `/Users/gecko/src/lama/packages/refinio.api/` - Story/Assembly automation implementation
- `/Users/gecko/src/lama/assembly.core/` - Dimensional properties added

## Documentation

- `/Users/gecko/src/lama/packages/refinio.api/STORY-ASSEMBLY-ARCHITECTURE.md` - Architecture overview
- `/Users/gecko/src/lama/packages/refinio.api/ASSEMBLY-TRIGGER-CASES.md` - 11 trigger cases defined
- This file - Implementation progress
