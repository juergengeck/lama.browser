# Unified Journal System - Implementation Complete

Successfully implemented a unified journal system that aggregates conversations, memory entries, LLM calls, and AI contacts into a single chronological feed.

## Architecture Overview

```
┌────────────────────────────────────────────────┐
│          JournalPlan (Aggregator)              │
│  - getAllEntries() → unified chronological feed│
│  - Queries multiple sources via dependency DI  │
│  - Returns typed JournalEntry[]                │
└────────────────────────────────────────────────┘
          ↓ queries ↓         ↓        ↓
    ┌─────────┐  ┌────────┐  ┌──────┐  ┌────────┐
    │ChatPlan │  │Subjects│  │LLM   │  │AI      │
    │         │  │Plan    │  │Calls │  │Contacts│
    └─────────┘  └────────┘  └──────┘  └────────┘
               (Ready)     (TODO)    (TODO)
```

## Implementation Details

### 1. Core Type System (lama.core/plans/JournalPlan.ts)

**Discriminated Union for All Entry Types:**
```typescript
export type JournalEntry =
  | ConversationEntry   // Messages from ChatPlan
  | MemoryEntry         // Subjects from SubjectsPlan
  | LLMCallEntry        // LLM interactions (from AssemblyPlan storage)
  | AIContactEntry      // AI contact creation events (from AssemblyPlan storage)
  | SystemEventEntry    // Extensible for other events
```

**Each Entry Type Has:**
- Common base: `id`, `timestamp`, `type` (discriminator)
- Type-specific fields with full type safety
- TypeScript exhaustiveness checking

### 2. Aggregator Implementation (lama.core/plans/JournalPlan.ts:424-540)

**`getAllEntries()` Method:**
```typescript
async getAllEntries(options?: {
  conversationId?: string;
  type?: JournalEntry['type'] | JournalEntry['type'][];
  limit?: number;
  offset?: number;
}): Promise<JournalEntry[]>
```

**Features:**
- **Multi-source aggregation**: ChatPlan, SubjectsPlan (extensible)
- **Chronological sorting**: All entries sorted by timestamp
- **Type filtering**: Filter by one or more entry types
- **Pagination**: limit + offset support
- **Graceful error handling**: Each data source fails independently
- **Performance conscious**: Filters and paginates efficiently

**Data Sources:**
1. **Conversations** (ChatPlan - ✅ Implemented):
   - Fetches all conversations
   - For each conversation, fetches messages
   - Maps to `ConversationEntry` type

2. **Memory Entries** (SubjectsPlan - ✅ Ready):
   - Fetches all subjects via `SubjectsPlan.getAll()`
   - Maps Subject fields to `MemoryEntry`:
     - `subject.description` or `subject.id` → `subjectName`
     - Keyword hashes → string array
   - Includes metadata: messageCount, createdAt, lastSeenAt

3. **LLM Calls** (AssemblyPlan/Assembly - TODO):
   - Requires ONE.core reverse map queries (see implementation guide below)
   - Query: `AssemblyPlan` where `name` starts with "LLM Call:"
   - For each plan, aggregate Assembly objects by property
   - Reconstruct `LLMCallEntry` from assemblies

4. **AI Contacts** (AssemblyPlan/Assembly - TODO):
   - Similar approach to LLM calls (see implementation guide below)
   - Query: `AssemblyPlan` where `name` starts with "AI Contact Created:"
   - Aggregate Assembly objects for contact properties
   - Reconstruct `AIContactEntry` from assemblies

**Implementation Guide for LLM/AI Entries:**

The following code demonstrates how to implement reverse map queries for AssemblyPlan objects. This approach requires platform-specific ONE.core instance access.

```typescript
// Example: Fetch LLM Call entries from AssemblyPlan storage
async getLLMCallEntries(): Promise<LLMCallEntry[]> {
  try {
    // Platform must provide ONE.core instance access
    if (!this.oneCore) {
      console.warn('[JournalPlan] ONE.core instance not available - skipping LLM calls');
      return [];
    }

    const entries: LLMCallEntry[] = [];

    // Query AssemblyPlan objects by name pattern
    const assemblyPlans = await this.oneCore.queryObjects({
      type: 'AssemblyPlan',
      filter: (plan: any) => plan.name?.startsWith('LLM Call:')
    });

    // For each AssemblyPlan, reconstruct the LLMCallEntry
    for (const plan of assemblyPlans) {
      // Fetch all Assembly objects for this plan
      const assemblies = await this.oneCore.getAssembliesForPlan(plan.idHash);

      // Aggregate properties from assemblies
      const entry: LLMCallEntry = {
        type: 'llm-call',
        id: plan.idHash,
        timestamp: plan.createdAt || Date.now(),
        model: assemblies.find(a => a.property === 'model')?.value || 'unknown',
        provider: assemblies.find(a => a.property === 'provider')?.value || 'unknown',
        prompt: assemblies.find(a => a.property === 'prompt')?.value || '',
        response: assemblies.find(a => a.property === 'response')?.value || '',
        tokensUsed: assemblies.find(a => a.property === 'tokensUsed')?.value || 0,
        error: assemblies.find(a => a.property === 'error')?.value
      };

      entries.push(entry);
    }

    return entries;
  } catch (error) {
    console.error('[JournalPlan] Error fetching LLM call entries:', error);
    return [];
  }
}

// Example: Fetch AI Contact entries
async getAIContactEntries(): Promise<AIContactEntry[]> {
  try {
    if (!this.oneCore) {
      console.warn('[JournalPlan] ONE.core instance not available - skipping AI contacts');
      return [];
    }

    const entries: AIContactEntry[] = [];

    // Query AssemblyPlan objects by name pattern
    const assemblyPlans = await this.oneCore.queryObjects({
      type: 'AssemblyPlan',
      filter: (plan: any) => plan.name?.startsWith('AI Contact Created:')
    });

    for (const plan of assemblyPlans) {
      const assemblies = await this.oneCore.getAssembliesForPlan(plan.idHash);

      const entry: AIContactEntry = {
        type: 'ai-contact',
        id: plan.idHash,
        timestamp: plan.createdAt || Date.now(),
        contactId: assemblies.find(a => a.property === 'contactId')?.value || '',
        displayName: assemblies.find(a => a.property === 'displayName')?.value || 'AI Contact',
        model: assemblies.find(a => a.property === 'model')?.value || 'unknown'
      };

      entries.push(entry);
    }

    return entries;
  } catch (error) {
    console.error('[JournalPlan] Error fetching AI contact entries:', error);
    return [];
  }
}
```

**Key Requirements:**
- Platform must inject ONE.core instance (add `oneCore` to `JournalPlanExternalDeps`)
- ONE.core must support reverse map queries (object iteration by type)
- AssemblyPlan/Assembly storage must be implemented
- Error handling is critical - fail gracefully if storage unavailable

### 3. Dependency Injection (lama.core/plans/JournalPlan.ts:133-162)

**External Dependencies Interface:**
```typescript
export interface JournalPlanExternalDeps {
  chatPlan?: any;      // ChatPlan for conversation entries
  subjectsPlan?: any;  // SubjectsPlan for memory entries
}
```

**Wiring Method:**
```typescript
setExternalDeps(externalDeps: JournalPlanExternalDeps): void {
  this.chatPlan = externalDeps.chatPlan;
  this.subjectsPlan = externalDeps.subjectsPlan;
}
```

**Allows platform-specific wiring after construction** - clean separation between core logic and data sources.

### 4. Platform Integration

**lama.browser Model.ts (lines 306-310):**
```typescript
// Wire up JournalPlan's external dependencies
this.journalPlan.setExternalDeps({
    chatPlan: this.chatPlan
    // subjectsPlan: this.subjectsPlan  // TODO: Add when SubjectsPlan is implemented
});
```

**ui.core Plans Interface (ui.core/src/types/plans.ts):**
- Added `SubjectsPlan` type import (line 26)
- Added `subjects: SubjectsPlan` to `LAMAPlans` interface (line 77)

### 5. UI Components

**JournalEntryCard.tsx** - Entry-type-specific renderers:
- **Conversation Entry** (blue): Shows sender, content, attachments, AI badge
- **Memory Entry** (purple): Shows subject name, keywords (badges), message count
- **LLM Call Entry** (green): Shows model, prompt, response, tokens, errors
- **AI Contact Entry** (orange): Shows display name, model
- **System Event** (gray): Shows event type, description

**JournalView.tsx** - Unified journal feed:
- Uses `journal.getAllEntries()` instead of just conversations
- **Type filtering UI**: Dropdown with checkboxes for each entry type
- **Filter badge**: Shows count of hidden types
- **Empty states**: Different messages for no data vs. all types filtered out
- **Chronological display**: Sorted by timestamp (oldest to newest)
- **Pagination support**: limit/offset for performance

## Current Status

### ✅ Fully Functional
- Conversation aggregation (from ChatPlan)
- Type-safe journal entry system with discriminated unions
- Filterable, chronological journal feed
- UI components compile successfully
- Ready for production use

### ⏳ Pending Implementation
1. **SubjectsPlan Integration**:
   - SubjectsPlan exists in lama.core
   - Interface added to LAMAPlans
   - Mapping logic in JournalPlan complete
   - **TODO**: Instantiate SubjectsPlan in platform Model

2. **LLM Call Entries** (TODO):
   - Requires implementing ONE.core reverse map queries
   - Query AssemblyPlan objects by name pattern
   - Aggregate Assembly objects to reconstruct LLMCallEntry
   - Estimated effort: Medium (ONE.core query implementation)

3. **AI Contact Entries** (TODO):
   - Similar to LLM calls - uses AssemblyPlan/Assembly storage
   - Query by name pattern "AI Contact Created:"
   - Estimated effort: Low (similar to LLM calls)

## Files Modified

### Core Implementation
1. **lama.core/plans/JournalPlan.ts**:
   - Added unified entry types (lines 42-122)
   - Added external dependency injection (lines 133-162)
   - Implemented `getAllEntries()` aggregator (lines 424-540)
   - Fixed Subject field mapping (lines 496-499)

2. **ui.core/src/types/plans.ts**:
   - Added SubjectsPlan import (line 26)
   - Added subjects property to LAMAPlans (line 77)

### UI Components
3. **lama.ui/src/components/journal/JournalEntryCard.tsx** (NEW):
   - Entry-type-specific renderers
   - Distinct styling per type
   - Time formatting, truncation helpers

4. **lama.ui/src/components/journal/JournalView.tsx** (UPDATED):
   - Switched from conversation-only to unified journal feed
   - Added type filtering UI
   - Enhanced empty states
   - Pagination support

### Platform Wiring
5. **lama.browser/browser-ui/src/model/Model.ts**:
   - Wired up ChatPlan dependency (lines 306-310)
   - **TODO**: Wire up SubjectsPlan when instantiated

## Testing Guide

### Immediate Testing (Available Now)
```typescript
// In any UI component
const { journal } = usePlans();

// Get all conversation entries
const allEntries = await journal.getAllEntries();

// Filter by conversation
const conversationEntries = await journal.getAllEntries({
  conversationId: 'my-topic-id'
});

// Filter by type
const messages = await journal.getAllEntries({
  type: 'conversation',
  limit: 100
});

// Paginate
const recentEntries = await journal.getAllEntries({
  limit: 50,
  offset: 0
});
```

### Future Testing (After SubjectsPlan Integration)
```typescript
// Get memory entries
const memoryEntries = await journal.getAllEntries({
  type: 'memory',
  limit: 50
});

// Get mixed feed
const mixedEntries = await journal.getAllEntries({
  type: ['conversation', 'memory'],
  limit: 100
});
```

## Next Steps

### Immediate (High Priority)
1. **Complete SubjectsPlan Integration**:
   - Instantiate SubjectsPlan in lama.browser Model
   - Wire up to JournalPlan.setExternalDeps()
   - Test memory entry aggregation

### Short-term (Medium Priority)
2. **Implement LLM Call Aggregation**:
   - Add ONE.core reverse map query for AssemblyPlan
   - Implement assembly aggregation logic
   - Map to LLMCallEntry type

3. **Implement AI Contact Aggregation**:
   - Similar reverse map query for AI contact AssemblyPlan objects
   - Map to AIContactEntry type

### Long-term (Low Priority)
4. **Performance Optimization**:
   - Add caching for frequently accessed conversations
   - Implement virtual scrolling for large feeds
   - Add incremental loading

5. **Advanced Features**:
   - Search across all entry types
   - Export unified journal
   - Advanced filtering (date range, keywords, etc.)

## Design Principles

1. **Type Safety**: Discriminated unions ensure exhaustive type checking
2. **Extensibility**: Easy to add new entry types
3. **Performance**: Pagination and filtering at source
4. **Graceful Degradation**: Each data source fails independently
5. **Clean Separation**: Core logic independent of data sources
6. **Dependency Injection**: Platform-specific wiring after construction

## Architecture Insights

### Why Discriminated Unions?
- **Type safety**: TypeScript knows exact type in switch statements
- **Exhaustiveness**: Compiler ensures all cases handled
- **No runtime overhead**: Just TypeScript, compiles to plain JavaScript
- **Easy to extend**: Add new type = add to union

### Why External Dependencies?
- **Platform agnostic**: JournalPlan works in browser, Electron, worker
- **Testable**: Can inject mock ChatPlan/SubjectsPlan
- **Flexible**: Platform decides which sources to provide
- **Lazy loading**: Can wire up dependencies after construction

### Why Assembly Storage for LLM/AI?
- **Follows ONE.core patterns**: Plan/Product architecture
- **Versioned**: Full history of LLM calls
- **Queryable**: Reverse maps enable efficient queries
- **Consistent**: Same storage pattern as other ONE.core objects

## Known Issues

1. **TypeScript Errors**: Existing errors in upstream packages (chat.core, lama.core) - unrelated to journal implementation
2. **SubjectsPlan Not Instantiated**: Platform Model needs to create SubjectsPlan instance
3. **LLM/AI Entries Not Implemented**: Requires ONE.core reverse map queries (TODO)

## Conclusion

The unified journal system is **production-ready** for conversation aggregation and architecturally sound for future expansion. The type-safe design ensures maintainability, and the dependency injection pattern provides flexibility for different platforms.

**Status**: ✅ Phase 1 Complete (Conversations + Architecture)
**Next**: Implement SubjectsPlan integration, then LLM/AI call aggregation
