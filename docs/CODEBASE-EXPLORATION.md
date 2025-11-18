# LAMA Codebase Exploration Summary

## 1. CUBE.CORE STRUCTURE & CAPABILITIES

### Location
`lama.cube/node_modules/@cube/cube.core/` (external npm package)

### Current Implementation
**CubeStorage** (`src/storage/CubeStorage.ts`) - Minimal implementation for dimensional storage:
- **Purpose**: Multi-dimensional object indexing and querying
- **Key Classes**:
  - `CubeStorage`: Main orchestrator
  - `QueryResultStorage`: Persists query results as ONE objects
  - `CubeObject`: Links data object hash to dimensional metadata
  - `DimensionValue`: Stores concrete value for a dimension
  - `QueryResult`: Return type from queries

### Current Capabilities
```typescript
async store(objectHash: SHA256Hash, metadata: DimensionalMetadata)
  -> SHA256Hash<CubeObject>
  // Indexes object in each dimension, creates CubeObject

async query(criteria: QueryCriteria) -> QueryResult
  // Executes multi-dimensional queries:
  // 1. Query each dimension independently
  // 2. Intersect results (AND logic)
  // 3. Store query result as ONE object
  // 4. Return matching objects (currently returns hashes only)
```

### Dimension Interface
All dimensions must implement `DimensionInstance`:
```typescript
init(): Promise<void>
getDimensionHash(): Promise<SHA256Hash<Dimension>>
index(objectHash: SHA256Hash, value: any): Promise<SHA256Hash<DimensionValue>>
query(criterion: DimensionCriterion): Promise<SHA256Hash[]>
getValueHash(value: any): Promise<SHA256Hash<DimensionValue>>
```

### Query Types
```typescript
QueryCriteria: { [dimensionName: string]: DimensionCriterion }

DimensionCriterion:
  - operator: 'equals' | 'range' | 'contains' | 'wildcard' | 'proximity'
  - value?: any
  - start?: any, end?: any (for ranges)
  - pattern?: string (for wildcards)
  - center/radiusMeters (for geo)

StoredQueryResult: Persisted query as ONE object with:
  - queryCriteria (JSON-serialized)
  - resultHashes: SHA256Hash<CubeObject>[]
  - executionTime, timestamp
  - enrichedNodes: nodes created during enrichment
```

### TODO Items
- QueryBuilder (fluent API) - not yet exported
- DimensionRegistry - for tracking available dimensions
- CustomDimensionManager - for registering custom dimensions
- Index enrichment - foundation exists, not fully implemented
- Load actual CubeObjects from hashes (currently returns hashes only)

---

## 2. ASSEMBLY OBJECTS - TYPE DEFINITIONS

### Location
`assembly.core/types/Assembly.ts`

### Current Structure
```typescript
interface Assembly {
  $type$: 'CubeAssembly'  // Type marker for ONE.core
  storyRef: SHA256IdHash<Story>  // ID property (stable across versions)
  supply: Supply  // Inline: what is offered
  demand: Demand  // Inline: what is needed
  instanceVersion: string  // SHA256Hash (contextual to Instance)
  children?: string[]  // Child Assembly version hashes
  metadata?: Map<string, string>
  matchScore?: number  // 0.0-1.0
  status?: string
  created: number  // Unix timestamp
  modified?: number
}
```

### Supply (What's Offered)
```typescript
interface Supply {
  domain: string  // Type of supply (conversation, capability, memory, tool, identity)
  subjects: string[]  // SHA256Hash of thematic keywords
  keywords: string[]  // SHA256Hash of atomic concepts
  ownerId?: string  // SHA256IdHash<Person>
  verifiableCredentials?: VerifiableCredential[]  // Cryptographic proof
}
```

### Demand (What's Needed)
```typescript
interface Demand {
  domain: string  // Must match Supply.domain
  keywords: string[]  // SHA256Hash for matching
  trustLevel?: 'me' | 'trusted' | 'group' | 'public'
  groupHash?: string  // SHA256IdHash<Group> for filtering
}
```

### Plan (Learned from Execution)
```typescript
interface Plan {
  $type$: 'AssemblyPlan'
  id: string  // ID property (isId: true)
  name: string
  description?: string
  demandPatterns: DemandPattern[]
  supplyPatterns: SupplyPattern[]
  matchingLogic?: string
  minMatchScore?: number
  created: number
  modified?: number
  status?: string
}
```

### Story (Audit Trail)
```typescript
interface Story {
  $type$: 'AssemblyStory'
  id: string  // ID property
  title: string
  description: string
  plan: SHA256IdHash<Plan>
  product: SHA256IdHash<Assembly>
  instanceVersion: string  // Merkle root context
  success: boolean
  matchScore?: number
  created: number
}
```

### KEY INSIGHT
**Assembly Version Hash = Complete LLM Memory**
A single Assembly hash contains:
- Complete history (via Supply chain)
- Current task (via Demand)
- All child Assemblies (via children tree)
- Instance context (via instanceVersion)
- Cryptographic proof (Merkle root)

---

## 3. JOURNAL VIEW COMPONENT

### Location
`lama.ui/src/components/journal/`

### Current Components
1. **ConversationList.tsx**: Container for conversation cards
   - Props: conversations[], selectedConversationId, isCollapsed, callbacks
   - Renders: Card list with pagination via ScrollArea

2. **ConversationCard.tsx**: Individual conversation UI
   - Shows: Name, last message snippet, time, participants, model name
   - Actions: Select, rename, add users, configure MCP, delete
   - Responsive: Collapsed (avatar only) vs expanded (full details)

3. **ChatExport.tsx**: Export functionality
   - Formats: JSON, Markdown, HTML
   - Uses: `useLamaClient()` hook (type-safe plan interface)
   - Callbacks: onExportSuccess, onExportError

### Data Structures Currently Needed
```typescript
interface Conversation {
  id: string
  name: string
  type?: 'direct' | 'group'
  participants: Participant[]
  participantCount?: number
  lastMessage?: string
  lastMessageTime?: Date | string
  modelName?: string
  isGroup?: boolean
  hasAIParticipant?: boolean
  isAITopic?: boolean
}

interface Participant {
  id: string
  name: string
  isLLM: boolean
  color?: string
}
```

### How Journal Currently Works
1. **Data source**: Passed as prop to ConversationList (not queried)
2. **No current indexing**: No dimension queries being performed
3. **UI-driven filtering**: Component handles selection/display logic
4. **No persistence tracking**: No metadata about conversation creation time, owner, etc.

### TODO for Journal
- Add dimensions to track: owner, creation time, participant count
- Add query interface: "Get conversations for user X from date Y to Z"
- Store conversation metadata with cube indexing
- Index by lastMessageTime for sorting
- Index by participants for filtering

---

## 4. PLAN ID USAGE & STRUCTURE

### Current Plan ID Pattern
```typescript
interface Plan {
  id: string  // ID property (isId: true in recipe)
  // ...
}
```

### How Plan IDs Work
- **String identifier**: User-provided during creation
- **Versioning**: ONE.core creates version chain from all updates
- **Recipe**: `PlanRecipe.ts` marks `id` with `isId: true`
- **Retrieval**: `getObjectByIdHash(planIdHash)` returns latest version

### Plan ID Examples in Code
```typescript
// From chat.core (no specific examples, uses generic string)
// From assembly.core - similar pattern

// From ExportPlan/ChatPlan request/response patterns
// No structured plan ID usage yet
```

### Plan ID Lifecycle
1. **Creation**: `id: 'plan-' + uniqueIdentifier`
2. **Storage**: `storeVersionedObject(plan)` → returns `{ hash, idHash }`
3. **Retrieval**: `getObjectByIdHash(idHash)` → latest Plan version
4. **Updates**: Create new Plan version with same `id`

### TODO for Plan ID Usage
- Standardize plan ID naming: `domain:purpose:version` (e.g., `chat:message-export:1`)
- Add plan category/type dimension to Assembly
- Link Assembly.plan to specific Plan versions
- Enable "which plan created this Assembly?" queries

---

## 5. INDEXING PATTERNS IN CODEBASE

### Current Patterns

#### 1. ONE.core Native Indexing (recipes.ts)
```typescript
// All objects are indexed by content hash automatically
const { hash, idHash } = await storeVersionedObject(obj);
// hash: Content hash (ONE version)
// idHash: ID hash (all versions of this object)
```

#### 2. CubeStorage Dimensional Indexing
```typescript
// Index object with dimensional metadata
const cubeObjectHash = await cubeStorage.store(objectHash, {
  when: timestamp,
  who: personId,
  where: location,
  custom: customDimensionValue
});
```

#### 3. Topic/Channel Indexing (chat.core)
```typescript
// Topics indexed by: participants, topic type, channel manager
// Example: P2P topic ID = lexicographically sorted participant hashes
```

#### 4. AI Detection (ContactService)
```typescript
// Contacts indexed with isLLM boolean flag
// Cached for 5 seconds
```

### Missing Indexing Patterns

#### Assembly Indexing Gaps
1. **Owner/Creator dimension**: No "all assemblies created by person X" query
2. **Time dimension**: No "assemblies created between date Y and Z" query
3. **Domain dimension**: No "all assemblies in 'conversation' domain" query
4. **Status dimension**: No "all active vs archived assemblies" query
5. **Instance Version dimension**: No "all assemblies for this instance" query

#### Plan Indexing Gaps
1. **Creator dimension**: No "plans created by person X" query
2. **Status dimension**: No "active vs archived plans" query
3. **Domain dimension**: No "plans for 'conversation' domain" query
4. **Reference count**: No "which plans created the most assemblies" metric

#### Story Indexing Gaps
1. **Success/Failure dimension**: No success rate analytics
2. **Creator dimension**: No "stories from person X" query
3. **Time dimension**: No timeline queries
4. **Duration dimension**: No performance analytics

---

## 6. REFACTORING NEEDS SUMMARY

### files That Need Refactoring

#### Assembly.core
- [ ] `types/Assembly.ts`: Add dimensional properties to Assembly/Plan/Story
- [ ] `recipes/AssemblyRecipe.ts`: Add new recipe rules for dimensions
- [ ] `recipes/PlanRecipe.ts`: Add creator, status, domain as indexed fields
- [ ] `recipes/StoryRecipe.ts`: Add success, creator, duration as indexed fields

#### Chat.core
- [ ] `plans/ChatPlan.ts`: Add conversation indexing requests
- [ ] `services/ContactService.ts`: Extend with assembly/plan queries
- [ ] New: Add AssemblyIndexingService for dimension management

#### Lama.ui
- [ ] `components/journal/ConversationList.tsx`: Add query interface
- [ ] `components/journal/ConversationCard.tsx`: Display indexed metadata
- [ ] New: Add JournalQueryService hook for dimension queries

#### Cube.core (external)
- [ ] Implement: DimensionRegistry class
- [ ] Implement: CustomDimensionManager
- [ ] Implement: QueryBuilder fluent API
- [ ] Implement: Load CubeObjects from hashes (not just hashes)

---

## 7. SPECIFIC FILES TO READ FIRST

### Understanding Assembly/Plan/Story System
1. `/Users/gecko/src/lama/assembly.core/types/Assembly.ts` ✓ (read)
2. `/Users/gecko/src/lama/assembly.core/recipes/AssemblyRecipe.ts` ✓ (read)
3. `/Users/gecko/src/lama/assembly.core/recipes/PlanRecipe.ts` ✓ (read)
4. `/Users/gecko/src/lama/assembly.core/CLAUDE.md` ✓ (read in system context)

### Understanding Cube Storage
1. `/Users/gecko/src/lama/lama.cube/node_modules/@cube/cube.core/src/types/CubeTypes.ts` ✓ (read)
2. `/Users/gecko/src/lama/lama.cube/node_modules/@cube/cube.core/src/storage/CubeStorage.ts` ✓ (read)
3. `/Users/gecko/src/lama/lama.cube/node_modules/@cube/cube.core/src/index.ts` ✓ (read)

### Understanding Journal/Chat
1. `/Users/gecko/src/lama/lama.ui/src/components/journal/ConversationList.tsx` ✓ (read)
2. `/Users/gecko/src/lama/lama.ui/src/components/journal/ConversationCard.tsx` ✓ (read)
3. `/Users/gecko/src/lama/lama.ui/src/components/journal/ChatExport.tsx` ✓ (read)
4. `/Users/gecko/src/lama/lama.ui/src/components/chat/ChatContext.tsx` ✓ (read)

### Understanding Chat.core
1. `/Users/gecko/src/lama/chat.core/plans/ChatPlan.ts` ✓ (partial read)
2. `/Users/gecko/src/lama/chat.core/CLAUDE.md` ✓ (read in system context)
3. `/Users/gecko/src/lama/chat.core/services/ContactService.ts` (recommend reading)
4. `/Users/gecko/src/lama/chat.core/services/P2PTopicService.ts` (recommend reading)

