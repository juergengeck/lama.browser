# LAMA's Unique Vision: AI Identity & Persistent Memory

## Why This Matters

Most agent frameworks (including Anthropic's Agent SDK) treat AI assistants as **ephemeral task executors** - they start fresh each session with no memory of past interactions. LAMA takes a fundamentally different approach: **AI assistants with persistent identity that learn and remember over time**.

## Core Innovation

### 1. AI Identity Enables Persistence

Each AI assistant can have a persistent identity stored as a `Person` entity in ONE.core:
- Associated knowledge base (SubjectAssembly objects)
- Conversation history across sessions
- Learned preferences and context
- Attribution for created/modified knowledge

**Why this is different**: The AI isn't just a stateless function - it's an entity with memory and history.

### 2. Subject Boundaries Protect Context Windows

Instead of cramming everything into the LLM's context window (typically 4k-128k tokens):
- **Store** learned knowledge as SubjectAssembly objects in ONE.core
- **Retrieve** relevant subjects on-demand using Jaccard similarity search
- **Context window** focuses only on active reasoning, not historical knowledge

**Example**:
```
Traditional Agent (context window):
- System prompt (500 tokens)
- Entire conversation history (15,000 tokens)
- Retrieved documents (10,000 tokens)
= 25,500 tokens (approaching limit, can't add more)

LAMA Agent (with subjects):
- System prompt (500 tokens)
- Recent conversation (2,000 tokens)
- Retrieved subjects (5 specific, 1,000 tokens total)
= 3,500 tokens (plenty of room for reasoning)
```

**Why this is different**: Context window becomes workspace for active thinking, not a database.

### 3. Memories are Shared, Not Recreated

SubjectAssembly objects are content-addressed and globally accessible:
- Created once, referenced many times
- Multiple conversations can reference the same subject
- Updates tracked via SubjectSource array
- CHUM sync distributes knowledge to group members

**Example**:
```typescript
// Conversation A (Monday)
Agent learns: "ComponentFactory is our internal React pattern"
→ Creates SubjectAssembly { id: "componentfactory", keywords: ["react", "pattern", "factory"] }

// Conversation B (Tuesday, different topic)
User: "How should I structure the new React component?"
→ Agent retrieves SubjectAssembly via keyword search
→ Uses ComponentFactory knowledge without re-learning

// SubjectSource tracking
SubjectAssembly.sources = [
  { type: "chat", id: "topic-monday-123", extractedAt: 1699286400 },
  { type: "chat", id: "topic-tuesday-456", extractedAt: 1699372800 }
]
```

**Why this is different**: Knowledge compounds across conversations instead of starting fresh.

### 4. Knowledge Bodies at Any Abstraction Level

Using cube.core's dimensional indexing, organize knowledge from concrete to abstract:

**Concrete Facts** (specific, time-bound):
```
"React 19 adds Server Components"
→ Dimensions: {who: "official-docs", when: "2024-11", domain: "react"}
```

**Patterns** (generalizable, project-specific):
```
"ComponentFactory pattern for our codebase"
→ Dimensions: {who: "team", project: "lama", domain: "architecture"}
```

**Principles** (abstract, timeless):
```
"Component architectures trend toward server-side rendering"
→ Dimensions: {domain: "web-development", confidence: 0.85}
```

**Multi-dimensional queries**:
```typescript
// "Show me React knowledge learned this month from Alice"
cube.query({
  domain: { operator: "equals", value: "react" },
  who: { operator: "equals", value: "alice-person-hash" },
  when: { operator: "range", start: "2024-11-01", end: "2024-12-01" }
})
```

**Why this is different**: Knowledge is queryable and filterable, not just keyword-searchable.

### 5. Social Learning with Privacy Boundaries

Group chat scenario:
- Alice teaches agent about "GraphQL best practices"
- Agent stores SubjectAssembly in group channel
- CHUM syncs subject to all group members
- Bob queries for GraphQL help → retrieves Alice's knowledge
- **Privacy**: Subject NOT accessible in Bob's separate P2P chat with agent

**Channel Architecture**:
```
Group Chat (3+ participants)
- Each participant has own channel
- SubjectAssembly posted to all channels
- CHUM syncs between participants
→ Social learning enabled

P2P Chat (2 participants)
- Single shared channel
- SubjectAssembly only in that channel
→ Knowledge isolated from other chats
```

**Provenance Audit**:
```typescript
SubjectAssembly.sources = [
  { type: "chat", id: "group-frontend-team", extractedAt: 1699286400 },
  { type: "manual", id: "alice-person-hash", extractedAt: 1699372800 },
  { type: "import", id: "documentation-import-789", extractedAt: 1699459200 }
]

// User can see:
// - This knowledge came from 3 sources
// - Group chat contribution on Nov 6
// - Alice's manual edit on Nov 7
// - Documentation import on Nov 8
```

**Why this is different**: Transparent, auditable knowledge sharing with enforced privacy boundaries.

### 6. Search & Retrieval via cube.core

**SubjectIndex** (memory.core):
- Fast keyword → subjects mapping (O(1) lookup)
- Jaccard similarity for relevance scoring
- In-memory index, incrementally updated

**CubeStorage** (cube.core):
- Multi-dimensional queries (who/when/where/custom)
- Query execution plans with cost estimation
- QueryResult caching for repeated queries

**Performance**:
```
Keyword search: <10ms for 1000 subjects
Dimensional query (uncached): 100-500ms
Dimensional query (cached): <10ms
```

**Why this is different**: Combines speed of keyword search with precision of dimensional filtering.

## Technical Foundation

### memory.core
- **SubjectAssembly**: Persistent knowledge objects with keywords and provenance
- **SubjectIndex**: O(1) keyword lookups, Jaccard similarity search
- **ChatMemoryPlan**: Chat-scoped memory extraction and retrieval
- **MemoryPlan**: Global CRUD operations for subjects

### cube.core
- **CubeObject**: Links data objects with dimensional metadata
- **Dimension**: who/when/where + custom dimensions
- **DimensionValue**: Concrete values for dimensions
- **QueryResult**: Cached multi-dimensional query results

### ONE.core
- Content-addressed storage (SHA256 hashing)
- Versioned objects with automatic deduplication
- CHUM sync protocol for P2P/group distribution
- Channel-based access control for privacy

## What This Unlocks

1. **Learning AI Assistants**: Build expertise over time instead of starting fresh
2. **Organic Knowledge Bases**: Grow through use, not manual curation
3. **Cross-Conversation Intelligence**: Leverage past learnings in new contexts
4. **Context Window Optimization**: Focus on reasoning, not knowledge retrieval
5. **Auditable Provenance**: Know where every piece of knowledge originated
6. **Privacy-Preserving Social Learning**: Share knowledge within groups, isolate between chats
7. **Dimensional Knowledge Organization**: Query by who/when/where/project/domain
8. **Compound Knowledge Growth**: Each conversation adds to collective intelligence

## Comparison to Ephemeral Agents

| Feature | Ephemeral Agents | LAMA Agents |
|---------|------------------|-------------|
| **Memory Persistence** | None (fresh each session) | Permanent (ONE.core storage) |
| **Context Window Usage** | Full history loaded | Only active reasoning |
| **Knowledge Sharing** | Not possible | CHUM sync across conversations |
| **Provenance** | Not tracked | Full SubjectSource audit trail |
| **Privacy** | N/A (no persistence) | Channel-based isolation |
| **Query Capabilities** | N/A | Multi-dimensional (cube.core) |
| **Learning** | Per-session only | Continuous across sessions |
| **Knowledge Attribution** | N/A | Per-subject tracking |

## Implementation Priority

Phase 1 (Core Agent):
- AgentPlan orchestration
- Tool calling (ReACT pattern)
- Streaming and context management

Phase 2 (Memory Integration):
- KnowledgeManager bridge to memory.core
- Built-in knowledge tools (store/retrieve/query)
- ContextCompactor using subjects

Phase 3 (Dimensional Knowledge):
- cube.core integration
- Multi-dimensional queries
- QueryResult caching

Phase 4 (Social Learning):
- Group channel knowledge sharing
- Provenance auditing
- Privacy enforcement testing

## Use Cases

### Personal AI Assistant
- Learns your coding style across projects
- Remembers past decisions and rationale
- Surfaces relevant past solutions when needed

### Team Knowledge Base
- Captures team discussions as structured knowledge
- New members query past decisions
- Knowledge attributed to contributors

### Research Assistant
- Builds domain knowledge incrementally
- Dimensional queries: "papers from 2024 about LLMs"
- Connects concepts across reading sessions

### Code Review Agent
- Learns codebase patterns over time
- References past reviews and decisions
- Suggests patterns based on team preferences

## Success Metrics

- **Context Window Reduction**: 80% less usage through on-demand retrieval
- **Knowledge Recall**: 95%+ accuracy retrieving relevant past subjects
- **Cross-Session Learning**: Agents successfully apply knowledge from prior conversations
- **Social Learning**: Group members benefit from each other's teaching
- **Privacy Enforcement**: Zero knowledge leakage between isolated channels

## Why This is LAMA's Differentiator

While other agent frameworks focus on task execution, LAMA enables:
- **Persistent AI identity** that learns and grows
- **Shared knowledge** that compounds over time
- **Privacy-preserving collaboration** via channel architecture
- **Auditable provenance** for trust and compliance
- **Dimensional organization** beyond simple search

This isn't just an agent framework - it's a foundation for AI assistants with memory, identity, and the ability to learn from experience.
