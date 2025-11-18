# packages/refinio.api Architecture Analysis

## Complete Type System Overview

### 1. PLAN TYPES

#### Base Plan Interface
**File**: `/Users/gecko/src/lama/packages/refinio.api/src/registry/PlanRegistry.ts` (Line 19-22)
```typescript
export interface Plan {
  // Plans are classes with async methods
  // Methods must return promises - enforced at registration time
}
```

#### Plan Classes (Concrete Implementations)

1. **OneInstancePlan**
   - **File**: `/Users/gecko/src/lama/packages/refinio.api/src/handlers/OneInstancePlan.ts`
   - **Line Numbers**: 18-47
   - **Methods**:
     - `getInstanceId()`: Returns `{ idHash }`
     - `getOwner()`: Returns `{ owner }`
     - `getInfo()`: Returns `{ idHash, owner, initialized }`
   - **Purpose**: Platform-agnostic handler for ONE.core instance management

2. **OneStoragePlan**
   - **File**: `/Users/gecko/src/lama/packages/refinio.api/src/handlers/OneStoragePlan.ts`
   - **Line Numbers**: 35-105
   - **Methods**:
     - `storeVersionedObject(obj)`: Returns `{ hash, idHash, versionHash }`
     - `getObjectByIdHash(idHash)`: Returns `{ obj, idHash, hash }`
     - `getVersionedObjectByHash(hash)`: Returns the object
     - `storeUnversionedObject(obj)`: Returns `{ hash }`
     - `getUnversionedObject(hash)`: Returns object
     - `storeBlob(arrayBuffer)`: Returns `{ hash, status }`
     - `readBlob(hash)`: Returns ArrayBuffer
   - **Purpose**: Platform-agnostic plan for ONE.core storage operations

3. **OneLeutePlan**
   - **File**: `/Users/gecko/src/lama/packages/refinio.api/src/handlers/OneLeutePlan.ts`
   - **Line Numbers**: 16-94
   - **Methods**:
     - `getOwnIdentity()`: Returns user's identity
     - `getContacts()`: Returns all contacts
     - `getContact(personIdHash)`: Returns specific contact
     - `createContact(params)`: Returns new contact
     - `updateContact(personIdHash, updates)`: Updates contact
     - `getGroups()`: Returns all groups
     - `createGroup(params)`: Creates group
     - `addGroupMember(groupIdHash, personIdHash)`: Adds to group
     - `removeGroupMember(groupIdHash, personIdHash)`: Removes from group
   - **Purpose**: Platform-agnostic plan for identity and contact management

4. **OneChannelsPlan**
   - **File**: `/Users/gecko/src/lama/packages/refinio.api/src/handlers/OneChannelsPlan.ts`
   - **Line Numbers**: 17-71
   - **Methods**:
     - `createChannel(params)`: Creates CHUM channel
     - `postToChannel(channelId, obj)`: Posts object to channel
     - `getChannel(channelId)`: Gets channel info
     - `listChannels()`: Lists all channels
     - `getMatchingChannels(channelId)`: Gets matching channel infos
     - `deleteChannel(channelId, owner)`: Deletes channel
   - **Purpose**: Platform-agnostic plan for channel communication

5. **OneCryptoPlan**
   - **File**: `/Users/gecko/src/lama/packages/refinio.api/src/handlers/OneCryptoPlan.ts`
   - **Line Numbers**: 22-76
   - **Methods**:
     - `sign(params)`: Returns `{ signature }`
     - `verify(params)`: Returns `{ valid }`
     - `encrypt(params)`: Returns `{ encrypted }`
     - `decrypt(params)`: Returns `{ decrypted }`
     - `hash(data)`: Returns `{ hash }`
   - **Purpose**: Platform-agnostic plan for cryptographic operations

6. **AssemblyPlan** (Story/Assembly Service)
   - **File**: `/Users/gecko/src/lama/packages/refinio.api/src/stories/AssemblyPlan.ts`
   - **Line Numbers**: 46-133
   - **Methods**:
     - `createStory(params)`: Returns `{ story, hash, idHash }`
     - `createAssembly(params)`: Returns `{ assembly, hash, idHash }`
   - **Implements**: `IAssemblyHandler` interface
   - **Purpose**: Creates Story (audit trail) and Assembly (supply/demand matching) objects

#### Base Classes for Plan Composition

1. **CoordinationPlan**
   - **File**: `/Users/gecko/src/lama/packages/refinio.api/src/CoordinationPlan.ts`
   - **Line Numbers**: 38-110
   - **Key Features**:
     - Orchestrates multiple atomic plans
     - Uses `api.invoke()` to delegate to atomic plans
     - Progress event support via `OEvent<ProgressEvent>`
     - Methods:
       - `emitProgress(step, percent, message)`: Emit progress event
       - `invokeAtomicPlan(operation, request, context)`: Invoke atomic plan with error context
       - `rollback?(completedSteps)`: Optional rollback on failure
   - **Purpose**: Base for multi-step workflow coordination

2. **TransportPlan**
   - **File**: `/Users/gecko/src/lama/packages/refinio.api/src/TransportPlan.ts`
   - **Line Numbers**: 44-184
   - **Abstract Methods**:
     - `start(config?)`: Start transport server
     - `stop()`: Stop transport
     - `extractAuthContext(request)`: Extract auth from transport request
     - `isRunning()`: Check if transport is running
   - **Concrete Methods**:
     - `invokeOperation(operation, request, transportRequest, requestId)`: Core routing method
     - `formatError(err)`: Format error response
     - `generateRequestId()`: Generate unique ID
   - **Purpose**: Base for transport implementations (HTTP, IPC, QUIC, etc.)

---

### 2. STORY TYPES

**File**: `/Users/gecko/src/lama/packages/refinio.api/src/types/story-execution.ts`

#### Story Creation Pattern

**Critical Pattern**:
- Every Plan execution → Story (automatic audit trail)
- Some executions → Assembly (triggered by business logic providing supply/demand)

#### ExecutionContext (Line 19-54)
```typescript
export interface ExecutionContext {
  title: string;                              // Human-readable title
  description: string;                        // Detailed description
  planId: SHA256IdHash<any>;                 // Plan being executed
  productId?: SHA256IdHash<any>;             // Product/Assembly ID (optional)
  instanceVersion: string;                    // Merkle root context
  owner: string;                              // Executor (SHA256IdHash<Person>)
  domain: string;                             // Domain identifier
  
  // Optional: Supply/Demand for Assembly creation
  supply?: Supply;                           // What is offered/available
  demand?: Demand;                           // What is needed/requested
  matchScore?: number;                       // Match score (0.0-1.0)
  metadata?: Map<string, string>;            // Additional metadata
}
```

#### Story Object Structure (Created by AssemblyPlan.createStory)
```typescript
{
  $type$: 'Story',
  id: string;
  title: string;
  description: string;
  plan: SHA256IdHash<any>;              // Reference to Plan
  product: SHA256IdHash<any> | null;    // Reference to product (if exists)
  instanceVersion: string;               // Merkle root at execution time
  success: boolean;                      // Execution success
  outcome?: string;                      // Error message if failed
  matchScore: number | null;             // Supply/demand match score
  metadata: Map<string, string>;         // Arbitrary metadata
  duration: number;                      // Execution time in ms
  owner: string;                         // Executor identity
  domain: string;                        // Domain identifier
  created: number;                       // Timestamp
}
```

#### ExecutionResult (Line 121-142)
```typescript
export interface ExecutionResult<T = any> {
  success: boolean;                      // Success flag
  result?: T;                            // Result from operation
  story?: {
    hash: string;
    idHash: string;                      // Always present on success
  };
  assembly?: {
    hash: string;
    idHash: string;                      // Only if supply/demand provided
  };
  error?: string;                        // Error message if failed
}
```

---

### 3. SUPPLY/DEMAND TYPES

#### Supply (Line 59-74)
```typescript
export interface Supply {
  domain: string;                        // Domain identifier
  subjects: string[];                    // Thematic keywords (SHA256 hashes)
                                        // E.g., "climate-policy"
  keywords: string[];                   // Atomic concepts (SHA256 hashes)
  ownerId?: string;                     // Owner (SHA256IdHash<Person>)
  verifiableCredentials?: VerifiableCredential[];  // Proof of identity/capabilities
}
```

**Use Cases**:
- Connection invites: Identity verification supply
- Sharing: Available resources/capabilities
- AI responses: LLM capabilities

#### Demand (Line 79-91)
```typescript
export interface Demand {
  domain: string;                        // Must match Supply.domain for matching
  keywords: string[];                   // Keywords for matching supply (SHA256 hashes)
  trustLevel?: TrustLevel;              // Required trust level
  groupHash?: string;                   // Optional: filter to group members
                                        // (SHA256IdHash<Group>)
}
```

**Trust Levels**: `'me' | 'trusted' | 'group' | 'public'`

**Use Cases**:
- Connection invites: Demand with credential filters
- Resource requests: Specific capabilities needed
- AI requests: User context/prompt as demand

#### VerifiableCredential (Line 101-116)
```typescript
export interface VerifiableCredential {
  type: string;                         // E.g., "GroupMembership", "Identity", "Capability"
  credentialHash: string;               // Hash or reference
  issuer: string;                       // Issuer identity (SHA256IdHash<Person>)
  issued: number;                       // Issuance timestamp
  expires?: number;                     // Optional expiration
}
```

---

### 4. ASSEMBLY TYPES

**File**: `/Users/gecko/src/lama/packages/refinio.api/src/stories/AssemblyPlan.ts`

#### Assembly Object Structure (Created by AssemblyPlan.createAssembly)
```typescript
{
  $type$: 'Assembly',
  storyRef: string;                      // Reference to Story (idHash)
  supply: {
    domain: string;
    keywords: string[];
    ownerId: string;
    subjects: string[];
    verifiableCredentials: VerifiableCredential[];
  };
  demand: {
    domain: string;
    keywords: string[];
    trustLevel: TrustLevel;
    credentialFilters: any[];            // Additional credential filters
    groupHash: string | null;
  };
  instanceVersion: string;               // Merkle root context
  matchScore: number;                    // Supply/demand match score (0.0-1.0)
  metadata: Map<string, string>;         // Arbitrary metadata
  status: string;                        // E.g., 'active'
  planRef: string;                       // Reference to Plan
  owner: string;                         // Owner identity
  domain: string;                        // Domain identifier
  created: number;                       // Timestamp
}
```

#### AssemblyQueryFilter (Line 30-35)
```typescript
export interface AssemblyQueryFilter {
  domain?: string;                       // Filter by domain
  metadata?: Record<string, string>;    // Filter by metadata
  owner?: string;                       // Filter by owner
  keywords?: string[];                  // Filter by keywords
}
```

---

### 5. SUPPORTING TYPES

#### AuthContext (src/types/context.ts:16-36)
```typescript
export interface AuthContext {
  userId: SHA256IdHash<Person>;         // User ID
  sessionId: string;                    // Session ID for tracking
  capabilities: string[];               // E.g., 'chat:send', 'admin:*'
}
```

#### PlanContext (src/types/context.ts:44-69)
```typescript
export interface PlanContext {
  auth: AuthContext;                    // Authentication/authorization
  requestId: string;                    // Unique request ID
  timestamp: number;                    // Unix timestamp (milliseconds)
  metadata?: Record<string, any>;       // Transport-specific metadata
}
```

#### PlanMetadata (src/registry/PlanRegistry.ts:24-43)
```typescript
export interface PlanMetadata {
  name: string;
  description?: string;
  version?: string;
  methods: MethodMetadata[];
}

export interface MethodMetadata {
  name: string;
  description?: string;
  params?: ParameterMetadata[];
  returns?: string;
}

export interface ParameterMetadata {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}
```

#### PlanTransaction (src/registry/PlanRegistry.ts:50-54)
```typescript
export interface PlanTransaction {
  plan: string;                         // Plan name
  method: string;                       // Method name
  params: any;                          // Method parameters
}
```

#### StoryResult (src/registry/PlanRegistry.ts:61-72)
```typescript
export interface StoryResult<T = any> {
  success: boolean;
  plan: PlanTransaction;                // The executed plan
  data?: T;                             // Result data
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
  executionTime?: number;
}
```

---

### 6. PROGRESSION EVENT TYPE

#### ProgressEvent (src/CoordinationPlan.ts:27-31)
```typescript
export interface ProgressEvent {
  step: string;
  percent: number;
  message?: string;
}
```

**Used by CoordinationPlan for multi-step workflow progress reporting**

---

## Current Usage Patterns

### Pattern 1: Story Creation (Every Plan Execution)
**File**: `/Users/gecko/src/lama/packages/refinio.api/src/stories/StoryFactory.ts`

```typescript
await factory.recordExecution({
  title: "Send message",
  planId: chatPlanId,
  owner: userId,
  domain: "conversation",
  instanceVersion: instanceHash
}, () => channelManager.postToChannel(topicId, message));
// Returns: ExecutionResult with story hash
```

### Pattern 2: Story + Assembly (Triggered by Business Logic)
```typescript
await factory.recordExecution({
  title: "Accept connection invite",
  planId: connectionPlanId,
  owner: userId,
  domain: "identity",
  instanceVersion: instanceHash,
  demand: {
    domain: "identity",
    keywords: ["pairing", "trust"],
    trustLevel: "trusted"
  },
  supply: {
    domain: "identity",
    keywords: ["identity-verification"],
    ownerId: remotePersonId,
    verifiableCredentials: [...]
  },
  matchScore: 0.95
}, () => connectionsModel.acceptInvite(invite));
// Returns: ExecutionResult with story AND assembly hashes
```

### Pattern 3: Coordination Plan (Multi-Step Orchestration)
**Base Implementation**: `CoordinationPlan` (src/CoordinationPlan.ts)

Example extends CoordinationPlan:
```typescript
class ConversationPlan extends CoordinationPlan {
  async sendWithAnalysis(request, context) {
    // Step 1: Send message
    this.emitProgress('sending', 0, 'Sending message...');
    const chatResult = await this.invokeAtomicPlan(
      'chat:sendMessage',
      { topicId, content },
      context
    );
    
    // Step 2: Analyze
    this.emitProgress('analyzing', 33, 'Analyzing keywords...');
    const analysis = await this.invokeAtomicPlan(
      'topicAnalysis:analyze',
      { topicId, messageId: chatResult.messageId },
      context
    );
    
    // Step 3: Generate AI response (optional)
    if (request.triggerAI) {
      this.emitProgress('generating', 66, 'Generating AI response...');
      const aiResult = await this.invokeAtomicPlan(
        'ai:generateResponse',
        { topicId, context: analysis },
        context
      );
    }
    
    return { chatResult, analysis };
  }
}
```

---

## Architecture Relationships

```
┌─ BASE CLASSES ─────────────────────────────────────────┐
│                                                         │
│  Plan (Interface)                                       │
│    ├── OneInstancePlan (concrete)                       │
│    ├── OneStoragePlan (concrete)                        │
│    ├── OneLeutePlan (concrete)                          │
│    ├── OneChannelsPlan (concrete)                       │
│    ├── OneCryptoPlan (concrete)                         │
│    ├── AssemblyPlan (concrete - Story/Assembly)         │
│    ├── CoordinationPlan (multi-step orchestration)      │
│    └── TransportPlan (abstract - protocol handler)      │
│            ├── HTTPTransportPlan                        │
│            ├── IPCTransportPlan                         │
│            └── StdioTransportPlan                       │
└─────────────────────────────────────────────────────────┘

┌─ EXECUTION & AUDIT TRAIL ──────────────────────────────┐
│                                                         │
│  Plan Execution → Story (AUTOMATIC)                     │
│       ↓                                                  │
│  If Supply/Demand Provided → Assembly (TRIGGERED)       │
│       ↓                                                  │
│  ExecutionResult {                                      │
│    success, result, story, assembly, error             │
│  }                                                      │
│                                                         │
│  StoryFactory (orchestrates creation)                   │
│  └── AssemblyPlan (creates Story & Assembly objects)   │
└─────────────────────────────────────────────────────────┘

┌─ SUPPLY/DEMAND MATCHING ───────────────────────────────┐
│                                                         │
│  Supply { domain, subjects, keywords, owner, creds }    │
│       ↓                                                  │
│  Matching Logic (domain must match, keywords match)      │
│       ↓                                                  │
│  Demand { domain, keywords, trustLevel, groupHash }     │
│       ↓                                                  │
│  matchScore (0.0-1.0) → Assembly.matchScore             │
└─────────────────────────────────────────────────────────┘

┌─ PLAN REGISTRY & INVOCATION ───────────────────────────┐
│                                                         │
│  PlanRegistry                                           │
│    register(name, plan, metadata)                       │
│    ├── Plans.set(name, plan)                           │
│    └── Metadata.set(name, metadata)                    │
│       ↓                                                  │
│  invoke<T>(operation, request, context)                │
│    → PlanTransaction { plan, method, params }          │
│    → StoryResult { success, plan, data, error }        │
└─────────────────────────────────────────────────────────┘

┌─ CONTEXT FLOW ─────────────────────────────────────────┐
│                                                         │
│  Transport → AuthContext                                │
│    ├── userId (SHA256IdHash<Person>)                   │
│    ├── sessionId                                       │
│    └── capabilities                                    │
│       ↓                                                  │
│  PlanContext (created for each invocation)              │
│    ├── auth: AuthContext                               │
│    ├── requestId (unique per request)                   │
│    ├── timestamp                                        │
│    └── metadata (transport-specific)                    │
└─────────────────────────────────────────────────────────┘
```

---

## Key Files Summary

| File | Lines | Purpose |
|------|-------|---------|
| `src/types/story-execution.ts` | 1-142 | ExecutionContext, Supply, Demand, VerifiableCredential, ExecutionResult |
| `src/stories/StoryFactory.ts` | 1-200 | Story/Assembly creation for Plan executions |
| `src/stories/AssemblyPlan.ts` | 1-133 | Story and Assembly object creation |
| `src/registry/PlanRegistry.ts` | 1-289 | Plan registration and invocation |
| `src/CoordinationPlan.ts` | 1-164 | Base class for multi-step workflows |
| `src/TransportPlan.ts` | 1-185 | Base class for protocol handlers |
| `src/handlers/OneInstancePlan.ts` | 1-47 | Instance lifecycle operations |
| `src/handlers/OneStoragePlan.ts` | 1-105 | ONE.core storage operations |
| `src/handlers/OneLeutePlan.ts` | 1-94 | Identity/contact/group management |
| `src/handlers/OneChannelsPlan.ts` | 1-71 | Channel communication |
| `src/handlers/OneCryptoPlan.ts` | 1-76 | Cryptographic operations |
| `src/types/context.ts` | 1-122 | AuthContext, PlanContext |
| `src/stories/index.ts` | 1-21 | Public exports for Story/Assembly |
| `src/stories-index.ts` | 1-78 | Platform-agnostic API exports |
| `src/plan-system-index.ts` | 1-78 | Unified Plan System exports |

---

## Design Principles

1. **Automatic Story Creation**: Every Plan execution creates a Story (audit trail)
2. **Triggered Assembly Creation**: Assembly only created when Supply/Demand provided
3. **Platform-Agnostic**: All Plans use one.core abstractions (OEvent, etc.)
4. **Type Safety**: Strong typing with SHA256IdHash branded strings
5. **Composition over Inheritance**: Plans delegate via `api.invoke()` not inheritance
6. **Transparent Coordination**: CoordinationPlan handles multi-step orchestration
7. **Supply/Demand Matching**: Central pattern for resource/capability matching
8. **Immutable Storage**: ONE.core uses content-addressed immutable storage

---

## Next Steps for Refactoring

Based on this analysis, refactoring could involve:

1. **Unified Plan System**: Consolidate Plan registry and invocation
2. **Generic Supply/Demand**: Create base matching algorithm
3. **Story Query APIs**: Add querying/filtering for audit trails
4. **Assembly Matching**: Implement sophisticated supply/demand matching
5. **Coordination Templates**: Create common coordination patterns
6. **Progressive Story Loading**: Stream story execution progress
7. **Supply/Demand Caching**: Cache matching scores for performance
