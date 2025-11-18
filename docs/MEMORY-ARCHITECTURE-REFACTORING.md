# Memory Architecture Refactoring Plan

**Status**: Proposal
**Date**: 2025-11-11
**Issue**: Memory system is not properly independent from chat system

## Problem Statement

The current memory architecture violates the principle that **memory should be independent and complementary to chat**, not tightly coupled to it.

### Current Issues

1. **Chat-Scoped Subject IDs**: Subjects are stored with chat-specific IDs
   ```typescript
   // memory.core/src/services/ChatMemoryService.ts:378
   id: `chat-${topicId}-${subject.name.toLowerCase().replace(/\s+/g, '-')}`
   ```

2. **Duplicate Code**: `ChatMemoryService` exists in both `memory.core` AND `lama.core`

3. **Incomplete Independence**: `MemoryPlan.getContextForMessage()` iterates over all chats, suggesting subjects should be global but are stored per-chat

4. **Naming Confusion**: "ChatMemory" conflates two concepts:
   - Chat-specific config (auto-extraction settings)
   - General memory storage (subjects/keywords)

5. **Unfinished Initialization**: `MemoryServicesPlan` commented out in `memory.core/src/index.ts`

## Desired Architecture

### Separation of Concerns

```
┌──────────────────────────────────────────────────────────┐
│                    memory.core                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │  MemoryPlan (General Memory Storage)               │  │
│  │  • Global subject/keyword storage                  │  │
│  │  • CRUD operations on SubjectAssembly              │  │
│  │  • Cross-chat search and retrieval                 │  │
│  │  • NO topicId in subject IDs                       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  SubjectIndex (Fast Lookup)                        │  │
│  │  • Keyword → Subject mappings                      │  │
│  │  • Jaccard similarity search                       │  │
│  │  • In-memory cache for performance                 │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ChatMemoryPlan (Chat Integration)                 │  │
│  │  • Per-chat configuration (auto-extract, etc.)     │  │
│  │  • Automatic extraction from messages              │  │
│  │  • Links between chats and subjects                │  │
│  │  • Uses MemoryPlan for actual storage              │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Global Memory Storage**
   - Subjects stored with global IDs (no topicId prefix)
   - Same subject from multiple chats → single SubjectAssembly
   - Metadata tracks which chats mention the subject

2. **Chat-Specific Configuration**
   - `ChatMemoryConfig`: Per-chat settings (enabled, auto-extract, min confidence)
   - `ChatMemoryAssociation`: Links topics to subjects (many-to-many)
   - Stored separately from subjects

3. **Clear Responsibilities**
   - `MemoryPlan`: General-purpose memory CRUD (chat-agnostic)
   - `ChatMemoryPlan`: Chat-specific auto-extraction and config
   - `SubjectIndex`: Fast keyword-based lookup

## Detailed Design

### 1. MemoryPlan (Global Memory)

**Location**: `memory.core/src/plans/MemoryPlan.ts`

**Responsibilities**:
- CRUD operations on global SubjectAssembly objects
- Cross-chat search and retrieval
- NO chat-specific logic

**Interface**:
```typescript
class MemoryPlan {
  // CRUD operations (chat-agnostic)
  async createSubject(params: CreateSubjectParams): Promise<SubjectAssembly>
  async getSubject(idHash: SHA256IdHash): Promise<SubjectAssembly | null>
  async updateSubject(idHash: SHA256IdHash, updates: UpdateParams): Promise<SubjectAssembly>
  async deleteSubject(idHash: SHA256IdHash): Promise<boolean>
  async listSubjects(filters?: SubjectFilters): Promise<SHA256IdHash[]>

  // Search (global, not per-chat)
  async searchByKeywords(keywords: string[], limit?: number): Promise<SubjectAssembly[]>
  async findSimilar(idHash: SHA256IdHash, limit?: number): Promise<SubjectAssembly[]>

  // Metadata queries
  async getSubjectsForChat(topicId: SHA256IdHash): Promise<SubjectAssembly[]>
  async getChatsForSubject(idHash: SHA256IdHash): Promise<SHA256IdHash[]>
}
```

**Key Changes**:
- Subject IDs are global: `subject-<normalized-name>` (NO topicId)
- Metadata tracks sources: `{ extractedFrom: [topicId1, topicId2, ...] }`
- Merging: Same subject from different chats → update existing, add source

### 2. SubjectIndex (Fast Lookup)

**Location**: `memory.core/src/services/SubjectIndex.ts` (NEW)

**Responsibilities**:
- In-memory index for fast keyword → subject lookups
- Jaccard similarity calculations
- Caching for performance

**Interface**:
```typescript
class SubjectIndex {
  // Index management
  async buildIndex(): Promise<void>
  async addSubject(subject: SubjectAssembly): Promise<void>
  async removeSubject(idHash: SHA256IdHash): Promise<void>
  async updateSubject(subject: SubjectAssembly): Promise<void>

  // Search
  findByKeywords(keywords: string[]): SubjectMatch[]
  findSimilar(keywords: string[], limit: number): SubjectMatch[]

  // Statistics
  getIndexStats(): IndexStats
}

interface SubjectMatch {
  subject: SubjectAssembly;
  relevanceScore: number;      // Jaccard similarity
  matchingKeywords: string[];
}
```

**Implementation**:
- Map<keyword, Set<subjectIdHash>> for fast lookups
- Rebuilt on initialization, incrementally updated
- Stored in memory (not ONE.core) for speed

### 3. ChatMemoryPlan (Chat Integration)

**Location**: `memory.core/src/plans/ChatMemoryPlan.ts`

**Responsibilities**:
- Per-chat configuration (enable/disable, settings)
- Automatic extraction from messages
- Association management (chat ↔ subjects)
- Delegates to MemoryPlan for actual storage

**Interface**:
```typescript
class ChatMemoryPlan {
  // Configuration (chat-specific)
  async enableMemories(topicId: SHA256IdHash, config: ChatMemoryConfig): Promise<void>
  async disableMemories(topicId: SHA256IdHash): Promise<void>
  async getConfig(topicId: SHA256IdHash): Promise<ChatMemoryConfig | null>

  // Extraction (uses MemoryPlan for storage)
  async extractFromMessages(request: ExtractRequest): Promise<ExtractResponse>
  async extractFromChat(topicId: SHA256IdHash, limit?: number): Promise<ExtractResponse>

  // Associations (chat ↔ subjects)
  async linkSubjectToChat(subjectId: SHA256IdHash, topicId: SHA256IdHash): Promise<void>
  async unlinkSubjectFromChat(subjectId: SHA256IdHash, topicId: SHA256IdHash): Promise<void>
  async getSubjectsForChat(topicId: SHA256IdHash): Promise<SubjectAssembly[]>

  // Context retrieval
  async getContextForMessage(message: string, topicId?: SHA256IdHash): Promise<ContextResponse>
}
```

**Key Changes**:
- `extractFromMessages` creates/updates subjects via `MemoryPlan.createSubject()`
- Subject IDs are global (no topicId prefix)
- Associations stored separately as `ChatMemoryAssociation` objects

### 4. Data Models

#### SubjectAssembly (Global, Chat-Agnostic)

```typescript
interface SubjectAssembly {
  $type$: 'SubjectAssembly';
  id: string;                    // Global ID: "project-lama" (NO topicId!)
  name: string;                  // Display name: "Project LAMA"
  description?: string;
  keywords: string[];            // Extracted keywords
  metadata: Map<string, string>; // Extensible metadata

  // Source tracking (which chats mention this)
  sources: SubjectSource[];      // NEW: track all sources

  // Timestamps
  created: number;
  modified: number;
}

interface SubjectSource {
  type: 'chat' | 'manual' | 'import';
  id: string;                    // topicId for chat, userId for manual, etc.
  extractedAt: number;
  confidence?: number;
}
```

**Migration**: Existing subjects with `chat-<topicId>-<name>` IDs → extract name, create global ID, move topicId to sources

#### ChatMemoryConfig (Chat-Specific Settings)

```typescript
interface ChatMemoryConfig {
  $type$: 'ChatMemoryConfig';
  topicId: SHA256IdHash;         // Which chat this configures
  enabled: boolean;
  autoExtract: boolean;
  updateInterval: number;
  minConfidence: number;
  keywords: string[];            // Additional tracking keywords
}
```

**No change** - already chat-specific

#### ChatMemoryAssociation (Many-to-Many Links)

```typescript
interface ChatMemoryAssociation {
  $type$: 'ChatMemoryAssociation';
  topicId: SHA256IdHash;         // Which chat
  subjectId: SHA256IdHash;       // Which subject (global ID)

  // Association metadata
  firstMentioned: number;        // When first mentioned in this chat
  lastMentioned: number;         // Most recent mention
  mentionCount: number;          // How many times mentioned
  confidence: number;            // Extraction confidence
}
```

**Key change**: `subjectId` is global (not chat-scoped)

## Refactoring Steps

### Phase 1: Preparation (No Breaking Changes)

**Goal**: Add new infrastructure without breaking existing code

1. **Create SubjectIndex service**
   - Add `memory.core/src/services/SubjectIndex.ts`
   - Implement in-memory keyword → subject index
   - Add tests

2. **Add SubjectSource to SubjectAssembly**
   - Update `SubjectAssembly` interface to include `sources: SubjectSource[]`
   - Update recipes to support new field
   - Existing subjects will have empty sources array (handled gracefully)

3. **Create migration utilities**
   - Add `memory.core/src/migration/` directory
   - Implement `migrateChatScopedSubjects()` function
   - Add detection logic for old vs new subject IDs

### Phase 2: MemoryPlan Refactoring

**Goal**: Make MemoryPlan truly chat-agnostic

1. **Update MemoryPlan.createSubject()**
   - Remove topicId from subject ID generation
   - Use global IDs: `subject-<normalized-name>`
   - Accept sources array in params
   - Merge logic: if subject exists, add source instead of creating duplicate

2. **Add global search methods**
   - `searchByKeywords(keywords, limit)` - uses SubjectIndex
   - `findSimilar(idHash, limit)` - Jaccard similarity
   - `getSubjectsForChat(topicId)` - filter by sources
   - `getChatsForSubject(idHash)` - extract from sources

3. **Remove chat-specific logic**
   - Move `getContextForMessage()` to ChatMemoryPlan (it iterates chats)
   - MemoryPlan should not know about topics/chats

### Phase 3: ChatMemoryService Migration

**Goal**: Eliminate duplication between memory.core and lama.core

1. **Consolidate to memory.core**
   - Keep `memory.core/src/services/ChatMemoryService.ts` as canonical
   - Delete `lama.core/services/ChatMemoryService.ts`
   - Update imports in lama.core to use memory.core

2. **Update ChatMemoryService.storeSubjectAsMemory()**
   - Call `MemoryPlan.createSubject()` with global ID
   - Pass topicId as a source, not in the ID
   - Handle merging if subject already exists

3. **Add association management**
   - Store `ChatMemoryAssociation` objects separately
   - Link topicId → subjectId (many-to-many)
   - Update when subject is mentioned again

### Phase 4: ChatMemoryPlan Updates

**Goal**: Clean separation between chat config and memory storage

1. **Split responsibilities**
   - Config management stays in ChatMemoryPlan
   - Extraction logic stays in ChatMemoryPlan
   - Actual subject storage delegates to MemoryPlan

2. **Update extractAndStoreSubjects()**
   - Generate global subject IDs
   - Call `MemoryPlan.createSubject()` for storage
   - Create `ChatMemoryAssociation` objects
   - Track mention counts and timestamps

3. **Move getContextForMessage() here**
   - Currently in MemoryPlan but iterates chats (wrong layer)
   - Use SubjectIndex for fast keyword → subject lookup
   - Filter by chat if topicId provided

### Phase 5: Data Migration

**Goal**: Migrate existing chat-scoped subjects to global storage

1. **Detect old subjects**
   - Scan for subject IDs matching `chat-<topicId>-<name>` pattern
   - Identify duplicates across chats (same name, different topicIds)

2. **Merge duplicates**
   - Group subjects by name (ignoring topicId)
   - Merge into single global subject
   - Combine keywords from all instances
   - Create SubjectSource entries for each topicId

3. **Update associations**
   - Create ChatMemoryAssociation objects
   - Link each topicId to merged subject
   - Preserve mention counts and timestamps

4. **Clean up old subjects**
   - Archive old chat-scoped subjects (don't delete, for safety)
   - Update references to use new global IDs

### Phase 6: Testing & Validation

1. **Unit tests**
   - SubjectIndex: keyword search, Jaccard similarity
   - MemoryPlan: global CRUD, source tracking
   - ChatMemoryPlan: extraction, association management

2. **Integration tests**
   - Multi-chat scenario: same subject in multiple chats
   - Cross-chat search: find subjects from any chat
   - Migration: old subjects → new global subjects

3. **Performance tests**
   - SubjectIndex lookup speed with 1000+ subjects
   - Cross-chat search with 100+ topics
   - Memory usage for index

## Migration Strategy

### Backward Compatibility

**During transition** (Phases 1-4):
- Both old (chat-scoped) and new (global) subjects coexist
- Detection logic: if ID starts with `chat-<topicId>-`, use old logic
- Gradually migrate as subjects are updated

**After migration** (Phase 5):
- Old subjects archived but preserved
- New code only creates global subjects
- Migration script available for manual runs

### Rollback Plan

If issues arise:
1. Keep old subjects in storage (archived, not deleted)
2. Feature flag: `USE_GLOBAL_MEMORY` (default: true)
3. Fallback to old logic if flag disabled
4. Restore from backup if needed

## Benefits

### 1. True Independence
- Memory is chat-agnostic, reusable across system
- Subjects can be created manually (not just from chats)
- Future: Import subjects from external sources

### 2. Efficiency
- No duplicate subjects across chats
- SubjectIndex enables fast O(1) keyword lookups
- Cross-chat search without iterating all topics

### 3. Extensibility
- SubjectSource.type allows non-chat sources (manual, import, etc.)
- Associations support any entity type, not just chats
- Future: Link subjects to files, calendar events, etc.

### 4. Clarity
- Clear separation: MemoryPlan (storage) vs ChatMemoryPlan (extraction)
- No duplicate code between memory.core and lama.core
- Easier to understand and maintain

## Risks & Mitigations

### Risk 1: Data Loss During Migration
**Mitigation**:
- Archive old subjects (don't delete)
- Run migration in dry-run mode first
- Backup before migration
- Validation step to verify all subjects migrated

### Risk 2: Performance Regression
**Mitigation**:
- SubjectIndex pre-built on initialization
- Incremental updates (don't rebuild entire index)
- Performance tests before/after
- Rollback plan if too slow

### Risk 3: Breaking Existing Code
**Mitigation**:
- Backward compatibility layer during transition
- Feature flag for gradual rollout
- Update all consumers (lama.cube, lama.browser, etc.)
- Comprehensive integration tests

## Timeline Estimate

- **Phase 1**: 2-3 days (infrastructure, no breaking changes)
- **Phase 2**: 2-3 days (MemoryPlan refactoring)
- **Phase 3**: 1-2 days (consolidate ChatMemoryService)
- **Phase 4**: 2-3 days (ChatMemoryPlan updates)
- **Phase 5**: 2-3 days (data migration)
- **Phase 6**: 2-3 days (testing)

**Total**: 11-17 days (2-3 weeks)

## Open Questions

1. **SubjectIndex persistence**: Store index in ONE.core or rebuild on startup?
   - Proposal: Rebuild on startup (simpler, self-healing)

2. **Subject deduplication**: How to handle slight name variations?
   - Proposal: Normalized names (lowercase, no punctuation) for matching

3. **Cross-chat vs per-chat search**: Should `getContextForMessage()` default to global or chat-specific?
   - Proposal: Optional `topicId` param - null = global, provided = chat-specific

4. **MCP tool updates**: How to expose both memory and chatMemory tools?
   - Proposal: Separate tool categories: `memory.*` (global) and `chatMemory.*` (chat-specific)

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Approve architecture** before starting implementation
3. **Create Phase 1 tasks** in project tracker
4. **Set up feature flag** for gradual rollout
5. **Begin Phase 1** implementation

## References

- Current code: `memory.core/src/`
- Related: `lama.core/services/ChatMemoryService.ts` (duplicate)
- Issue: Line 378 in `memory.core/src/services/ChatMemoryService.ts` (chat-scoped IDs)
- Architecture docs: `memory.core/CLAUDE.md`
