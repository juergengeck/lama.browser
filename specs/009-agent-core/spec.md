# Feature Specification: Agent Core - Autonomous Multi-Step AI Orchestration

**Feature Branch**: `009-agent-core`
**Created**: 2025-11-12
**Status**: Draft
**Input**: User request to create agent.core library that extracts and formalizes LAMA's existing LLM orchestration patterns (streaming, tool calling, context management) into a platform-agnostic agent framework, enabling autonomous multi-step reasoning workflows while maintaining clean-room independence from Anthropic's Agent SDK.

## LAMA's Unique Vision: AI Identity & Persistent Memory

**Why LAMA's approach is different**: Unlike ephemeral agent frameworks, LAMA provides AI assistants with **persistent identity** and **shared knowledge** through ONE.core's content-addressed storage. This transforms agents from stateless task executors into learning entities that build knowledge over time.

**Core Principles**:

1. **AI Identity Enables Persistence**: Each AI assistant can have a persistent identity stored as a Person in ONE.core, with associated memory subjects, learned knowledge, and conversation history that survives across sessions

2. **Subject Boundaries Protect Context Windows**: Instead of keeping everything in short-term memory (context window), agents store learned knowledge as SubjectAssembly objects (via memory.core). Related memories are retrieved on-demand using Jaccard similarity search, dramatically reducing context window pressure

3. **Memories are Shared, Not Recreated**: SubjectAssembly objects created in one conversation can be retrieved in another. Multiple users/chats can reference the same subject (tracked via SubjectSource), eliminating redundant knowledge creation

4. **Knowledge Bodies at Any Abstraction Level**: Using cube.core's dimensional indexing (who/when/where/custom), agents can organize knowledge from concrete facts ("React 19 adds Server Components") to abstract principles ("Component architectures tend toward server-side rendering"). Multi-dimensional queries enable precise knowledge retrieval

5. **Social Learning with Privacy Boundaries**: Agents learn from multiple users and conversations, but SubjectSource tracking enables auditable privacy controls. Subject visibility can be scoped by topic, user, or group using ONE.core's channel-based access control

6. **Search & Retrieval via cube.core**: Dimensional queries (e.g., "knowledge from last week about React, created by Alice") enable sophisticated knowledge management beyond simple keyword search. QueryResult caching optimizes repeated queries

**Technical Foundation**:
- **memory.core**: Subject storage, keyword indexing, Jaccard similarity search
- **cube.core**: Multi-dimensional knowledge organization (who/when/where/custom dimensions)
- **ONE.core**: Content-addressed storage, versioned objects, CHUM sync for knowledge sharing
- **Channel-based access**: P2P (shared channel) vs Group (per-participant channels) for privacy

**What This Unlocks**:
- AI assistants that remember previous conversations and build expertise over time
- Knowledge bases that grow organically through use, not manual curation
- Cross-conversation learning while respecting privacy boundaries
- Context windows focused on active reasoning, not historical knowledge retrieval
- Auditable knowledge provenance (who learned what, when, from which conversation)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - AI Assistant Executes Multi-Step Research Task (Priority: P1)

A user asks LAMA's AI assistant to "research the latest React 19 features, compare them to Vue 3, and summarize key differences for my team."

**Why this priority**: This is the core value proposition - autonomous agents that decompose complex tasks into steps, execute them using tools, and synthesize results. Without this, agent.core provides no benefit over existing LLM integration.

**Independent Test**: Can be fully tested by creating an AgentPlan with ResearchAgent configuration, providing the prompt, and verifying the agent: 1) decomposes into subtasks (search React 19 docs, search Vue 3 docs, compare features), 2) executes tool calls (web search, documentation fetch), 3) synthesizes final summary without user intervention.

**Acceptance Scenarios**:

1. **Given** an AgentPlan with research tools enabled, **When** user provides complex multi-step prompt, **Then** agent decomposes into subtasks, executes each step, and returns synthesized result
2. **Given** a subtask requires tool execution, **When** agent determines web search is needed, **Then** agent invokes search tool, processes results, and incorporates findings into next reasoning step
3. **Given** agent encounters ambiguous requirement, **When** agent cannot proceed without clarification, **Then** agent requests user input and resumes task after receiving response
4. **Given** agent execution spans multiple LLM calls, **When** context window approaches limit, **Then** agent automatically compacts conversation history while preserving critical context

---

### User Story 2 - Developer Creates Custom Agent with Domain Tools (Priority: P1)

A developer wants to create a "DevOps Agent" that can analyze logs, check system health, and suggest fixes using custom monitoring tools.

**Why this priority**: Extensibility via custom tools is essential for agent.core adoption. Developers must be able to register domain-specific tools without modifying core library.

**Independent Test**: Can be fully tested by defining custom tools (checkLogs, getSystemMetrics, restartService) using ToolDefinition interface, registering them with AgentPlan, and verifying agent can invoke these tools during task execution.

**Acceptance Scenarios**:

1. **Given** developer defines ToolDefinition with typed input schema, **When** developer registers tool with AgentPlan via ToolRegistry, **Then** tool becomes available for agent invocation during reasoning
2. **Given** agent receives task requiring custom tool, **When** agent determines checkLogs tool is needed, **Then** agent extracts tool parameters from context, invokes tool, and processes results
3. **Given** custom tool execution fails, **When** tool throws error, **Then** agent receives error message and can retry with adjusted parameters or request user intervention
4. **Given** multiple custom tools are registered, **When** agent needs to chain tool calls, **Then** agent orchestrates sequence without developer implementing coordination logic

---

### User Story 3 - Platform Integrates Agent Streaming to UI (Priority: P2)

Electron and browser platforms need to display agent reasoning progress in real-time as the agent works through multi-step tasks.

**Why this priority**: User experience demands transparency into agent execution. Without streaming, long-running tasks appear frozen and users cannot provide early feedback.

**Independent Test**: Can be fully tested by creating AgentPlan with streaming callbacks, executing multi-step task, and verifying callbacks receive: 1) reasoning steps as they occur, 2) tool invocations with parameters, 3) intermediate results, 4) final synthesized response.

**Acceptance Scenarios**:

1. **Given** AgentPlan configured with onReasoningStep callback, **When** agent executes multi-step task, **Then** callback receives each reasoning step with timestamp and content
2. **Given** agent invokes tool during execution, **When** tool call begins, **Then** onToolInvocation callback receives tool name, parameters, and execution ID
3. **Given** tool execution completes, **When** tool returns result, **Then** onToolResult callback receives execution ID, status, and result data
4. **Given** agent completes final synthesis, **When** agent generates response, **Then** onComplete callback receives full result with execution summary and token usage

---

### User Story 4 - AI Assistant Builds Persistent Knowledge Base (Priority: P1)

A user teaches their AI assistant about their company's internal framework over multiple conversations. The assistant should remember this knowledge permanently and retrieve it when relevant, without keeping everything in active context.

**Why this priority**: This is LAMA's killer feature - persistent AI memory that outlives sessions and grows over time. Distinguishes LAMA from ephemeral agent frameworks.

**Independent Test**: Can be fully tested by: 1) agent learns framework concepts in conversation A, stores as SubjectAssembly via memory.core, 2) in conversation B (separate session), agent retrieves framework subjects using keyword search when user asks related question, 3) verify subjects have SubjectSource tracking showing both conversations.

**Acceptance Scenarios**:

1. **Given** agent learning from conversation, **When** agent encounters new concept (e.g., "ComponentFactory pattern"), **Then** agent stores SubjectAssembly with keywords, description, and SubjectSource metadata linking to current topic
2. **Given** stored knowledge subjects, **When** user asks related question in new conversation, **Then** agent retrieves relevant subjects via Jaccard similarity search and incorporates into reasoning without re-learning
3. **Given** subject referenced in multiple conversations, **When** subject is updated with new information, **Then** SubjectSource array tracks all contributing conversations for auditable provenance
4. **Given** agent context window approaching limit, **When** agent needs historical knowledge, **Then** agent retrieves specific subjects on-demand rather than keeping entire conversation history in context

---

### User Story 5 - Agent Organizes Knowledge with Dimensional Metadata (Priority: P2)

A developer wants their AI assistant to organize learned knowledge by dimensions (who created, when learned, which project) to enable sophisticated queries like "show me React knowledge learned this month from Alice."

**Why this priority**: Dimensional knowledge organization (via cube.core) enables LAMA to scale beyond simple keyword search to rich, queryable knowledge bases.

**Independent Test**: Can be fully tested by: 1) agent stores subjects as CubeObjects with dimensional metadata (who/when/project), 2) execute multi-dimensional query via cube.core, 3) verify results match criteria and include QueryResult caching.

**Acceptance Scenarios**:

1. **Given** agent storing learned knowledge, **When** agent creates SubjectAssembly, **Then** agent also creates CubeObject with DimensionValues for who (learner), when (timestamp), and custom dimensions (project, domain)
2. **Given** dimensional knowledge base, **When** agent needs domain-specific knowledge, **Then** agent executes cube.core query with criteria (e.g., project="frontend" AND when>last_week) to retrieve relevant subjects
3. **Given** repeated dimensional queries, **When** query is executed multiple times, **Then** cube.core returns cached QueryResult for performance optimization
4. **Given** knowledge from multiple users, **When** agent queries with who dimension, **Then** results filtered by creator identity while respecting privacy boundaries (channel-based access)

---

### User Story 6 - Social Learning with Privacy Controls (Priority: P2)

Multiple users in a group chat want their AI assistant to learn from all participants, but ensure knowledge can't leak between separate P2P conversations.

**Why this priority**: Privacy-preserving social learning is essential for group collaboration. ONE.core's channel architecture enables this naturally.

**Independent Test**: Can be fully tested by: 1) agent learns subjects in group chat (group-based channel), 2) verify subjects accessible to all group members via CHUM sync, 3) attempt to access group subjects from P2P chat, 4) verify channel isolation prevents leakage.

**Acceptance Scenarios**:

1. **Given** agent learning in group chat, **When** agent stores SubjectAssembly, **Then** subject posted to group channel and synced to all participants via CHUM
2. **Given** group knowledge subjects, **When** any group member queries for related knowledge, **Then** agent retrieves subjects learned from any participant (social learning)
3. **Given** subject created in group channel, **When** agent in separate P2P chat searches for knowledge, **Then** group subjects NOT accessible due to channel isolation
4. **Given** SubjectSource tracking, **When** user audits subject provenance, **Then** system shows which conversations/participants contributed to subject creation and updates

---

### User Story 7 - Agent Maintains Conversation Context Across Sessions (Priority: P3)

A user wants their AI assistant to remember conversation flow and resume tasks after closing and reopening the application.

**Why this priority**: Session resumption complements persistent knowledge - users need both long-term memory (subjects) and conversation continuity.

**Independent Test**: Can be fully tested by executing agent task with ConversationManager, serializing conversation state to ONE.core storage, rehydrating state in new AgentPlan instance, and verifying resumed agent has access to previous context.

**Acceptance Scenarios**:

1. **Given** agent execution with conversation history, **When** conversation is serialized via ConversationManager.save(), **Then** state includes messages, context window, and metadata
2. **Given** serialized conversation state, **When** new AgentPlan instance loads state via ConversationManager.load(), **Then** agent resumes with full context including previous reasoning steps
3. **Given** conversation approaching context limit, **When** ConversationManager detects window exceeded, **Then** manager compacts by storing important facts as SubjectAssembly and removing from active context
4. **Given** multiple concurrent agent conversations, **When** platform stores each conversation separately, **Then** agent instances operate independently with isolated context

---

### User Story 8 - Developer Tests Agent Behavior with Mock Tools (Priority: P3)

A developer wants to write unit tests for agent task decomposition and tool orchestration without invoking real LLM providers or external tools.

**Why this priority**: Testability is essential for production agent deployments. Developers must be able to verify agent behavior deterministically without network dependencies.

**Independent Test**: Can be fully tested by injecting mock LLMProvider and mock tools into AgentPlan, defining expected LLM responses, executing agent task, and asserting correct tool invocations and result synthesis.

**Acceptance Scenarios**:

1. **Given** AgentPlan with MockLLMProvider, **When** developer defines response sequence for multi-step task, **Then** agent executes using mock responses and invokes tools as expected
2. **Given** mock tool definitions, **When** agent invokes tool during execution, **Then** mock tool returns predefined result without executing real implementation
3. **Given** test asserting specific tool invocation, **When** agent completes execution, **Then** test verifies tool was called with expected parameters
4. **Given** error scenario test, **When** mock tool throws error, **Then** test verifies agent handles error according to error recovery strategy

---

### Edge Cases

- **What happens when agent enters infinite reasoning loop?** AgentPlan enforces maximum iteration limit (default: 10 steps), throws MaxIterationsExceededError with execution trace when exceeded
- **How does agent handle tools with streaming responses?** ToolExecutor supports AsyncIterator tool results, agent processes streamed chunks incrementally and can display progress via callbacks
- **What happens when LLM provider becomes unavailable mid-execution?** AgentPlan catches provider errors, exposes via onError callback, and can retry with exponential backoff if configured
- **How does agent handle conflicting tool results?** Agent reasoning incorporates all tool results into context, LLM synthesizes conflicts in final response or requests clarification
- **What happens when context window is exceeded during critical task?** ConversationManager preserves system prompt and most recent messages, summarizes middle context, and continues execution
- **How does agent handle concurrent tool executions?** ToolExecutor supports parallel tool invocation when agent requests multiple tools, aggregates results before next reasoning step

## Requirements *(mandatory)*

### Functional Requirements

#### Agent Orchestration Core

- **FR-001**: System MUST provide AgentPlan class that orchestrates multi-step LLM reasoning with tool integration
- **FR-002**: AgentPlan MUST decompose complex tasks into reasoning steps without requiring explicit step definitions from developer
- **FR-003**: AgentPlan MUST support ReACT pattern (Reasoning, Action, Observation) for tool-augmented LLM workflows
- **FR-004**: System MUST enforce maximum iteration limits to prevent infinite reasoning loops (configurable, default: 10)
- **FR-005**: AgentPlan MUST be platform-agnostic and accept dependencies (LLMProvider, ToolRegistry, ConversationManager) via constructor injection
- **FR-006**: System MUST support autonomous task execution without user intervention for multi-step workflows

#### Tool Integration

- **FR-007**: System MUST provide ToolRegistry for registering and managing available tools
- **FR-008**: Tools MUST be defined using ToolDefinition interface with typed input schemas and execution functions
- **FR-009**: System MUST support synchronous and asynchronous tool execution
- **FR-010**: ToolExecutor MUST extract tool invocation requests from LLM responses using robust JSON parsing
- **FR-011**: ToolExecutor MUST handle malformed LLM tool requests by requesting clarification from LLM
- **FR-012**: System MUST support parallel tool execution when LLM requests multiple tools simultaneously
- **FR-013**: ToolExecutor MUST inject tool results back into conversation context for next reasoning step
- **FR-014**: System MUST support tool execution streaming via AsyncIterator for long-running operations

#### LLM Provider Abstraction

- **FR-015**: System MUST provide LLMProvider interface for abstracting Ollama, Claude, LM Studio, and other providers
- **FR-016**: LLMProvider implementations MUST support streaming responses via callback functions
- **FR-017**: LLMProvider implementations MUST handle tool calling format conversion between provider-specific schemas
- **FR-018**: System MUST support provider fallback when primary provider is unavailable (optional, configurable)
- **FR-019**: LLMProvider MUST expose token usage metrics for monitoring and cost tracking

#### Conversation Management

- **FR-020**: System MUST provide ConversationManager for managing conversation history and context windows
- **FR-021**: ConversationManager MUST implement TTL caching for recent conversation history (default: 5 seconds)
- **FR-022**: ConversationManager MUST automatically compact conversation history when context window limit approached
- **FR-023**: ConversationManager MUST support conversation serialization to ONE.core versioned objects
- **FR-024**: ConversationManager MUST support conversation deserialization for session resumption
- **FR-025**: System MUST preserve system prompts and critical context during conversation compaction
- **FR-026**: ConversationManager MUST support conversation branching for exploring alternative reasoning paths

#### Streaming & Progress

- **FR-027**: AgentPlan MUST support streaming callbacks for real-time progress updates
- **FR-028**: System MUST expose onReasoningStep callback for each agent reasoning iteration
- **FR-029**: System MUST expose onToolInvocation callback when agent invokes tool
- **FR-030**: System MUST expose onToolResult callback when tool execution completes
- **FR-031**: System MUST expose onComplete callback when agent finishes task with final result
- **FR-032**: System MUST expose onError callback for error handling during execution
- **FR-033**: Callbacks MUST receive structured event objects with timestamps, execution IDs, and metadata

#### Error Handling & Recovery

- **FR-034**: AgentPlan MUST fail fast and throw errors for unrecoverable conditions (no silent failures)
- **FR-035**: System MUST expose error details via onError callback for UI presentation
- **FR-036**: AgentPlan MUST support error recovery strategies (retry, skip, abort) configurable per error type
- **FR-037**: ToolExecutor MUST handle tool execution failures and inject error messages into conversation context
- **FR-038**: System MUST preserve execution trace for debugging when errors occur

#### Platform Integration

- **FR-039**: agent.core MUST be platform-agnostic and work in Node.js, browser, and other JavaScript environments
- **FR-040**: agent.core MUST NOT depend on Electron, browser APIs, or platform-specific modules
- **FR-041**: agent.core MUST integrate with existing LAMA plan system via AgentPlan class
- **FR-042**: AgentPlan MUST be invocable via refinio.api transport layer (IPC, HTTP, stdio, WebWorker)
- **FR-043**: agent.core MUST reuse existing lama.core LLM provider implementations (Ollama, Claude, LM Studio)

#### Persistent Memory & Knowledge Management

- **FR-049**: System MUST integrate with memory.core for persistent knowledge storage via SubjectAssembly objects
- **FR-050**: AgentPlan MUST support automatic knowledge extraction tool that stores learned concepts as subjects
- **FR-051**: AgentPlan MUST support knowledge retrieval tool that searches subjects using Jaccard similarity (via SubjectIndex)
- **FR-052**: SubjectAssembly storage MUST include SubjectSource tracking for auditable provenance
- **FR-053**: ConversationManager MUST store important facts as SubjectAssembly when approaching context limit
- **FR-054**: System MUST retrieve relevant subjects on-demand rather than keeping all knowledge in context window
- **FR-055**: AgentPlan MUST support cube.core integration for dimensional knowledge organization (who/when/where/custom)
- **FR-056**: System MUST create CubeObject with DimensionValues when storing knowledge with dimensional metadata
- **FR-057**: AgentPlan MUST support multi-dimensional knowledge queries via cube.core (e.g., "knowledge from Alice about React")
- **FR-058**: System MUST use QueryResult caching for repeated dimensional queries
- **FR-059**: Knowledge storage MUST respect ONE.core channel boundaries for privacy (P2P vs Group isolation)
- **FR-060**: SubjectAssembly objects MUST sync via CHUM for social learning within group channels
- **FR-061**: System MUST provide provenance audit tool showing which conversations/participants contributed to subjects

#### AI Identity & Persistence

- **FR-062**: AgentPlan MUST support optional AI identity (Person entity) for associating knowledge with specific assistants
- **FR-063**: AI identity MAY have associated SubjectAssembly objects representing the assistant's knowledge base
- **FR-064**: System MUST support knowledge sharing between conversations via shared SubjectAssembly objects
- **FR-065**: AgentPlan MUST distinguish between ephemeral context (current reasoning) and persistent knowledge (subjects)

#### Testing & Development

- **FR-066**: AgentPlan MUST be testable in isolation with mock LLMProvider and mock tools
- **FR-067**: System MUST support deterministic testing via predefined LLM response sequences
- **FR-068**: ToolRegistry MUST support tool replacement for testing (inject mock implementations)
- **FR-069**: ConversationManager MUST be testable independently of AgentPlan and LLMProvider
- **FR-070**: System MUST expose execution trace for debugging and test assertions
- **FR-071**: Memory integration MUST be testable with mock SubjectPlan and mock cube.core storage

### Key Entities *(include if feature involves data)*

- **AgentPlan**: Platform-agnostic class orchestrating multi-step LLM reasoning with tool integration. Contains task execution logic, iteration management, and streaming callback handling. Depends on LLMProvider, ToolRegistry, and ConversationManager injected via constructor.

- **LLMProvider**: Interface abstracting LLM API calls across providers (Ollama, Claude, LM Studio). Implements streaming responses, tool calling format conversion, and token usage tracking. Extracted from existing lama.core/services implementations.

- **ToolRegistry**: Registry maintaining available tools and their definitions. Provides tool lookup by name, schema validation, and tool invocation routing. Supports runtime tool registration and removal.

- **ToolDefinition**: Interface defining tool schema with name, description, input schema (typed), and execution function. Supports both sync and async execution patterns. Used by ToolRegistry and ToolExecutor.

- **ToolExecutor**: Component responsible for extracting tool calls from LLM responses, validating parameters, executing tools, and injecting results back into conversation. Implements robust JSON parsing using brace-counting algorithm from lama.core/services/llm-manager.ts.

- **ConversationManager**: Component managing conversation history, context windows, and message caching. Implements TTL cache, automatic compaction, and serialization/deserialization to ONE.core. Extracted from lama.core/models/ai/AIPromptBuilder.ts.

- **ReasoningStep**: Event object representing single iteration in agent reasoning loop. Contains step number, reasoning content, tool invocations (if any), results, and metadata. Emitted via onReasoningStep callback.

- **ToolInvocation**: Event object representing tool execution request from agent. Contains tool name, parameters, execution ID, and timestamp. Emitted via onToolInvocation callback.

- **ToolResult**: Event object representing tool execution completion. Contains execution ID, status (success/error), result data, and execution duration. Emitted via onToolResult callback.

- **AgentExecutionTrace**: Diagnostic object containing full execution history for debugging. Includes all reasoning steps, tool invocations, results, errors, and timing information. Accessible after execution completes.

- **KnowledgeManager**: Component bridging agent.core with memory.core and cube.core. Handles knowledge extraction (concepts → SubjectAssembly), retrieval (keywords → Jaccard search), and dimensional queries (who/when/where → CubeObjects). Injected into AgentPlan via constructor.

- **SubjectAssembly** (from memory.core): Persistent knowledge object with id, name, description, keywords, and SubjectSource array. Stored as ONE.core versioned object, synced via CHUM. Used for long-term memory that outlives conversation context.

- **SubjectSource** (from memory.core): Provenance tracking for subjects. Records type (chat/manual/import), id (topicId/userId), extractedAt timestamp, and optional confidence score. Enables auditable knowledge attribution.

- **SubjectIndex** (from memory.core): In-memory index for O(1) keyword lookups and Jaccard similarity search. Maps keywords → Set<subjectIds> for fast retrieval. Rebuilt on initialization, incrementally updated on subject changes.

- **CubeObject** (from cube.core): Links SubjectAssembly (as oneObjectHash) with dimensional metadata via DimensionValues array. Enables multi-dimensional queries like "React knowledge from Alice learned this month."

- **DimensionValue** (from cube.core): Stores specific value for dimension (who/when/where/custom). Each CubeObject has one DimensionValue per dimension. Indexed for fast queries.

- **QueryResult** (from cube.core): Cached result from dimensional query. Contains resultHashes, resultCount, executionTime, and timestamp. Reused for identical queries within TTL window.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can create custom agents by registering tools and configuring AgentPlan without modifying agent.core source code
- **SC-002**: AgentPlan successfully decomposes and executes multi-step tasks (3+ reasoning iterations) with tool integration in less than 30 seconds for typical workflows
- **SC-003**: Code reuse reaches 100% across platforms - same agent.core code works in Electron, browser, and server environments without platform-specific branches
- **SC-004**: ToolExecutor achieves 95%+ success rate extracting tool calls from LLM responses using robust JSON parsing (brace-counting algorithm)
- **SC-005**: ConversationManager reduces context window overflow errors by 90% through automatic compaction while preserving task-critical context
- **SC-006**: Developers can write comprehensive agent tests using mock providers and tools without requiring real LLM API calls or network access
- **SC-007**: Agent execution streaming provides real-time progress updates with less than 100ms latency between reasoning steps and callback invocations
- **SC-008**: AgentPlan prevents infinite loops in 100% of cases through iteration limits and timeout enforcement
- **SC-009**: Code extraction from lama.core reduces agent implementation complexity by 70% through reuse of existing streaming and tool calling patterns
- **SC-010**: Platform integration time for new agent workflows reduced to under 2 hours due to standardized AgentPlan interface and transport compatibility
- **SC-011**: Persistent knowledge storage reduces context window usage by 80% - agents retrieve specific subjects on-demand instead of loading full conversation history
- **SC-012**: Knowledge retrieval via Jaccard similarity achieves 85%+ relevance for keyword-based searches (validated against manual subject tagging)
- **SC-013**: Agents successfully remember learned concepts across sessions - 95%+ recall rate for subjects created in prior conversations
- **SC-014**: SubjectSource provenance tracking enables 100% auditability - all knowledge attributable to source conversations/participants
- **SC-015**: Dimensional queries (cube.core) reduce irrelevant results by 70% compared to simple keyword search (e.g., filtering by who/when/project)
- **SC-016**: Social learning in group chats enables knowledge sharing - subjects created by any participant accessible to all members with <2 second CHUM sync latency
- **SC-017**: Channel-based privacy isolation prevents 100% of knowledge leakage between P2P and group conversations (verified via access control tests)
- **SC-018**: QueryResult caching reduces repeated dimensional query latency by 95% (cached queries return in <10ms vs >100ms uncached)

## Technical Design *(mandatory)*

### Architecture Overview

agent.core follows LAMA's platform-agnostic architecture principles:

1. **Pure Business Logic**: No platform-specific imports (Electron, browser APIs, Node.js modules)
2. **Dependency Injection**: All dependencies (LLMProvider, ToolRegistry, ONE.core) injected via constructor
3. **Plan-Based Design**: AgentPlan integrates with refinio.api plan registry
4. **Code Extraction**: Reuses proven patterns from lama.core (streaming, tool calling, context management)

### Component Architecture

```
agent.core/
├── plans/
│   └── AgentPlan.ts                    # Main orchestration plan
├── providers/
│   ├── LLMProvider.ts                  # Interface (extract from lama.core)
│   ├── OllamaProvider.ts               # Extract from lama.core/services/ollama.ts
│   └── ClaudeProvider.ts               # Extract from lama.core/services/claude.ts
├── tools/
│   ├── ToolRegistry.ts                 # Tool registration and lookup
│   ├── ToolDefinition.ts               # Tool schema interface
│   ├── ToolExecutor.ts                 # Extract from llm-manager.ts:702-874
│   └── built-in/
│       ├── StoreKnowledgeTool.ts       # Stores concepts as SubjectAssembly
│       ├── RetrieveKnowledgeTool.ts    # Searches subjects via Jaccard
│       └── QueryKnowledgeTool.ts       # Dimensional queries via cube.core
├── conversation/
│   ├── ConversationManager.ts          # Extract from AIPromptBuilder.ts
│   ├── MessageCache.ts                 # TTL cache implementation
│   └── ContextCompactor.ts             # Stores facts as subjects when compacting
├── knowledge/
│   ├── KnowledgeManager.ts             # Bridges agent.core ↔ memory.core/cube.core
│   ├── SubjectExtractor.ts             # Extracts concepts from conversation
│   ├── SubjectRetriever.ts             # Jaccard search via SubjectIndex
│   └── DimensionalQueryBuilder.ts      # Builds cube.core query criteria
├── streaming/
│   ├── StreamingCallbacks.ts           # Callback type definitions
│   └── StreamingAdapter.ts             # ReadableStream handling
├── types/
│   ├── agent-types.ts                  # Core type definitions
│   ├── tool-types.ts                   # Tool-related types
│   ├── conversation-types.ts           # Message and history types
│   └── knowledge-types.ts              # Knowledge/memory-related types
└── utils/
    ├── JSONExtractor.ts                # Brace-counting parser from llm-manager.ts
    └── ErrorHandling.ts                # Error types and recovery strategies
```

### Data Flow

#### Standard Agent Execution
```
User Request
    ↓
AgentPlan.execute(task)
    ↓
ConversationManager (load context from ONE.core if resuming)
    ↓
KnowledgeManager.retrieveRelevantSubjects(keywords) → Inject into context
    ↓
┌─→ LLMProvider.chat() → Reasoning Step
│       ↓
│   ToolExecutor.extractToolCalls()
│       ↓
│   ToolRegistry.executeTool() → Tool Result
│       │
│       ├── Built-in: StoreKnowledgeTool → SubjectAssembly via memory.core
│       ├── Built-in: RetrieveKnowledgeTool → Jaccard search via SubjectIndex
│       ├── Built-in: QueryKnowledgeTool → Dimensional query via cube.core
│       └── Custom tools (user-defined)
│       ↓
│   ConversationManager.addMessage(result)
│       ↓
│   Check context window size
│       ├── If approaching limit → ContextCompactor.compact()
│       │   └── Store important facts as SubjectAssembly
│       └── If within limit → Continue
│       ↓
└─── Loop until task complete or max iterations
    ↓
Final synthesis
    ↓
ConversationManager.save() → Persist to ONE.core
    ↓
Return result to caller
```

#### Knowledge Storage Flow (StoreKnowledgeTool)
```
Agent encounters new concept
    ↓
Agent invokes StoreKnowledgeTool(name, keywords, description)
    ↓
KnowledgeManager.storeSubject()
    ↓
SubjectExtractor.createSubjectAssembly(id, name, keywords, source)
    ↓
memory.core MemoryPlan.createSubject()
    ↓
ONE.core storeVersionedObject(SubjectAssembly)
    ↓
SubjectIndex.addSubject() → Update in-memory index
    ↓
[Optional] cube.core CubeStorage.store(SubjectAssembly, dimensionalMetadata)
    ↓
Channel.postToChannel() → CHUM sync to peers
    ↓
Return subject hash to agent
```

#### Knowledge Retrieval Flow (RetrieveKnowledgeTool)
```
Agent needs related knowledge
    ↓
Agent invokes RetrieveKnowledgeTool(keywords, limit)
    ↓
KnowledgeManager.retrieveSubjects()
    ↓
SubjectRetriever.search(keywords) → SubjectIndex
    ↓
Jaccard similarity calculation for each subject
    ↓
Rank subjects by relevance score
    ↓
Return top N subjects to agent
    ↓
Agent incorporates into reasoning context
```

#### Dimensional Query Flow (QueryKnowledgeTool)
```
Agent needs filtered knowledge
    ↓
Agent invokes QueryKnowledgeTool(criteria: {who: "Alice", when: ">2024-11-01"})
    ↓
KnowledgeManager.queryKnowledge()
    ↓
DimensionalQueryBuilder.build(criteria) → QueryCriteria
    ↓
cube.core CubeStorage.query(criteria)
    ↓
Check QueryResult cache
    ├── Cache hit → Return cached results (<10ms)
    └── Cache miss → Execute dimensional query
        ↓
        Intersect results from who/when/where dimensions
        ↓
        Store QueryResult for caching
        ↓
        Return CubeObject[] → SubjectAssembly hashes
    ↓
Hydrate SubjectAssembly objects from ONE.core
    ↓
Return subjects to agent
```

### Code Extraction Plan

#### From lama.core/services/ollama.ts (lines 120-429)
- **Extract**: ReadableStream handling, JSON-line parsing, buffer management
- **Destination**: agent.core/streaming/StreamingAdapter.ts
- **Dependencies**: None (pure stream processing)
- **Changes**: Generalize to work with any provider's streaming format

#### From lama.core/services/llm-manager.ts (lines 702-874)
- **Extract**: Brace-counting JSON parser, ReACT tool calling loop, recursive refinement
- **Destination**: agent.core/tools/ToolExecutor.ts and agent.core/utils/JSONExtractor.ts
- **Dependencies**: LLMProvider (injected)
- **Changes**: Extract disableTools loop guard, make recursion limit configurable

#### From lama.core/models/ai/AIPromptBuilder.ts
- **Extract**: TTL cache, conversation history management, context window calculations
- **Destination**: agent.core/conversation/ConversationManager.ts
- **Dependencies**: None (pure state management)
- **Changes**: Remove LAMA-specific prompt formatting, generalize for any system prompt

#### From lama.core/services/llm-manager.ts (lines 1-289)
- **Extract**: Provider interface, model discovery, unified options
- **Destination**: agent.core/providers/LLMProvider.ts
- **Dependencies**: None (interface only)
- **Changes**: Formalize as TypeScript interface with clear contracts

### Integration with Existing LAMA Plans

agent.core integrates seamlessly with existing plan system:

```typescript
// In chat.core/plans/ChatPlan.ts
import { AgentPlan } from '@lama/agent.core/plans/AgentPlan.js';

export class ChatPlan {
  private agentPlan: AgentPlan;

  constructor(
    private nodeOneCore: any,
    private llmProvider: LLMProvider,
    private toolRegistry: ToolRegistry
  ) {
    this.agentPlan = new AgentPlan(llmProvider, toolRegistry, conversationManager);
  }

  async generateAIResponse(params: { topicId: string; prompt: string }) {
    // Delegate to AgentPlan for multi-step reasoning
    return await this.agentPlan.execute({
      task: params.prompt,
      tools: ['searchHistory', 'analyzeTopic', 'generateResponse'],
      onReasoningStep: (step) => this.emitProgress(step)
    });
  }
}
```

### Testing Strategy

1. **Unit Tests**: Mock LLMProvider and tools, verify AgentPlan orchestration logic
2. **Integration Tests**: Real LLM providers with mock tools, verify end-to-end flow
3. **Extraction Tests**: Compare extracted code behavior against original lama.core implementations
4. **Platform Tests**: Verify agent.core works in Node.js, browser, and Electron environments

### Performance Considerations

- **Streaming Latency**: Callbacks invoked within 100ms of LLM response chunks
- **Context Management**: TTL cache reduces conversation history queries by 80%
- **Tool Execution**: Parallel tool calls reduce multi-tool latency by 60%
- **Memory Usage**: Conversation compaction prevents unbounded memory growth in long sessions

### Security Considerations

- **Tool Sandboxing**: Tools execute in isolated context, cannot access AgentPlan internals
- **Input Validation**: Tool parameters validated against schemas before execution
- **Error Sanitization**: Stack traces sanitized in production to prevent information leakage
- **Iteration Limits**: Prevent resource exhaustion through max iteration enforcement

## Implementation Phases

### Phase 1: Core Extraction (Week 1)
- Create agent.core package structure
- Extract LLMProvider interface and implementations
- Extract ToolExecutor and JSONExtractor from llm-manager.ts
- Write unit tests for extracted components

### Phase 2: Conversation Management (Week 2)
- Extract ConversationManager from AIPromptBuilder.ts
- Implement TTL cache and context compaction
- Add ONE.core serialization support
- Write conversation management tests

### Phase 3: Agent Orchestration (Week 3)
- Implement AgentPlan with ReACT pattern
- Add iteration limits and error handling
- Implement streaming callbacks
- Write end-to-end orchestration tests

### Phase 4: Tool Integration (Week 4)
- Implement ToolRegistry
- Create ToolDefinition interface
- Add parallel tool execution support
- Write tool integration tests

### Phase 5: Platform Integration (Week 5)
- Integrate AgentPlan with refinio.api
- Update ChatPlan to use AgentPlan
- Test across Electron, browser, and server platforms
- Performance optimization and profiling

## Open Questions

1. **Context Compaction Strategy**: Should we use LLM-based summarization or heuristic-based message pruning for context compaction?
   - **Recommendation**: Start with heuristic (keep first/last N messages), add LLM summarization as optional enhancement

2. **Tool Schema Format**: Should we use JSON Schema, Zod, or custom schema format for tool definitions?
   - **Recommendation**: JSON Schema for interoperability with MCP, provide Zod adapter for type safety

3. **Error Recovery**: Should AgentPlan automatically retry failed steps or always delegate error handling to caller?
   - **Recommendation**: Configurable retry strategy (retry count, backoff), default to fail-fast

4. **Streaming Format**: Should we use callbacks, AsyncIterator, or both for streaming progress?
   - **Recommendation**: Callbacks for simplicity and compatibility with existing lama.core patterns

5. **Provider Fallback**: Should AgentPlan support automatic provider fallback (e.g., Claude → Ollama) or require explicit configuration?
   - **Recommendation**: Explicit configuration only - fail fast and let caller decide fallback strategy

## Dependencies

- **@refinio/one.core**: 0.6.1-beta-3 (storage, versioned objects)
- **Existing lama.core**: LLM provider implementations (extraction source)
- **mcp.core**: Optional integration for MCP tool definitions
- **TypeScript**: 5.x (type safety, branded types)

## Migration Path

agent.core is **additive** - no breaking changes to existing code:

1. **Phase 1-4**: Develop agent.core in isolation with comprehensive tests
2. **Phase 5**: Gradually migrate ChatPlan to use AgentPlan (feature flag controlled)
3. **Post-Launch**: Migrate other plans (TopicAnalysisPlan, etc.) as needed
4. **Future**: Consider deprecating direct LLM calls in favor of AgentPlan for consistency

## Success Metrics

- **Adoption**: 3+ plans migrated to use AgentPlan within 1 month of release
- **Reliability**: <1% agent execution failures due to infinite loops or context errors
- **Performance**: Agent task completion 95th percentile < 45 seconds
- **Developer Experience**: Agent integration time < 2 hours for new workflows
- **Code Quality**: 90%+ test coverage for agent.core package
