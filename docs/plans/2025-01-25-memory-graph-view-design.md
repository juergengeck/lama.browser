# Memory Graph View Design

**Date:** January 25, 2025
**Status:** Approved
**Platform:** lama.browser

## Overview

A React Flow-based graph visualization for the Memory View that displays persistent knowledge (SubjectAssembly objects from memory.core) and their relationships to conversation-level subjects (from TopicAnalysis). The graph provides visual exploration of cross-conversation knowledge with time-aware navigation to specific moments in chat history.

## Background

### Three-Layer Knowledge System

1. **Topic Analysis** (conversation-level):
   - Subjects & Keywords extracted from chat messages
   - Ephemeral, per-conversation analysis
   - Already integrated via TopicAnalysisModel

2. **Memory.core** (global, persistent knowledge):
   - **SubjectAssembly** - Long-term knowledge objects
   - **ChatMemoryAssociation** - Links chat topics to memories
   - Transcends individual conversations
   - Currently NOT integrated in lama.browser

3. **Cube.core** (dimensional indexing):
   - Dimensional index for efficient cross-topic queries
   - Subjects indexed with metadata (topic, keyword, subjectType)
   - Enables incremental updates without full scans

### Current State

- MemoryView.tsx is a placeholder component
- Memory.core exists but not wired into browser platform
- Infrastructure ready, needs integration

## Goals

- **Display Memories**: Show SubjectAssembly objects with search/browse capability
- **Show Relationships**: Visualize memory→subject connections and memory→memory keyword overlap
- **Enable Navigation**: Click subject nodes to jump to conversation timestamp
- **Use Persistent Structure**: Query cube.core indices, not recompute everything
- **Incremental Updates**: React to new data without full refresh

## Architecture

### Data Model

```typescript
interface MemoryNode {
  id: string;              // SubjectAssembly idHash
  name: string;
  description?: string;
  created: number;         // For sizing (recency)
  keywords: string[];
  subjectRefs: SHA256IdHash<Subject>[]; // References to conversation subjects
}

interface SubjectNode {
  id: string;              // Subject idHash (from TopicAnalysis)
  name: string;            // Subject combination (e.g., "python+testing")
  topicId: string;         // Which conversation
  keywords: string[];
  timeRanges: TimeRange[]; // When discussed
  isMemory: false;         // Distinguish from memories
}

interface GraphEdge {
  source: string;
  target: string;
  type: 'memory-memory' | 'memory-subject'; // Different visual styles
  weight: number;          // Similarity or reference strength
  sharedKeywords?: string[];
}
```

### Module Integration

**MemoryModule** (new):
- Import MemoryPlan and ChatMemoryPlan from memory.core
- Inject ONE.core storage dependencies (like AIModule pattern)
- Supply memoryPlan and chatMemoryPlan via Model getters
- Initialize during Model.init() after owner context established

**Module Dependencies:**
- Demands: ChannelManager, TopicModel, TopicAnalysisModel, CubeStorage (optional)
- Supplies: MemoryPlan, ChatMemoryPlan

### Data Flow

```
MemoryView
  → useMemoryGraph hook
    → model.cubeStorage.query() [dimensional query]
    → model.memoryPlan.getSubject() [fetch memories]
    → buildFromIndexedData() [construct graph]
  → GraphCanvas (React Flow)
    → MemoryNode / SubjectNode components
```

## Visualization

### Library: React Flow

**Why React Flow:**
- React-native, handles layout algorithms
- Zoom/pan built-in
- Good performance
- Easy custom nodes/edges

**Layout Algorithm:**
- Force-directed layout (dagre or built-in)
- Memories cluster by keyword similarity
- Subject nodes orbit around parent memories
- Configurable spacing

### Visual Design

**Memory Nodes (primary):**
- Large circles (60px diameter)
- Gradient fill based on recency (newer = brighter)
- Border thickness = number of subject references
- Label: memory name

**Subject Nodes (secondary):**
- Small circles (30px diameter)
- Solid color (different from memories)
- Label: subject name (truncated)
- Time badge on hover: "Discussed: Nov 24, 2:30 PM"
- Multiple timeRanges: "3 occurrences" badge

**Edges:**
- Memory→Subject: Solid line, arrow pointing to subject (direct reference)
- Memory→Memory: Dashed line, no arrow, thickness by Jaccard similarity
- Color: Subtle gray, highlights on hover

**Canvas:**
- Full height/width container
- White/light background with subtle grid
- Minimap in bottom-right corner
- Toolbar: Search, filters, layout controls, zoom

## Interactions

### Node Interactions

**Hover (any node):**
- Dim unconnected nodes (opacity: 0.3)
- Highlight connected edges
- Show tooltip:
  - Memory: name, description, created date, keyword count
  - Subject: name, conversation name, time range, message count

**Click Memory Node:**
- Select node (highlight ring)
- Open side panel showing:
  - Memory details (name, description, metadata)
  - List of connected subjects (grouped by conversation)
  - Related memories (by keyword overlap)

**Click Subject Node:**
- Navigate to conversation (topicId)
- Scroll to timestamp (timeRanges[0].start) using ChatView's scrollToTime
- Close memory view

**Double-click Memory Node:**
- Focus mode: Hide all nodes except this memory + direct connections
- "Exit Focus" button appears

### Controls (Toolbar)

- **Search:** Filter nodes by name/keyword (fuzzy search)
- **Layout:** Switch between force-directed/hierarchical/circular
- **Filters:**
  - Show/hide subject nodes (toggle)
  - Date range slider (filter by memory creation date)
  - Minimum connections (hide isolated nodes)
- **Zoom:** Fit to view, zoom in/out, reset

### Keyboard Shortcuts

- `Esc`: Clear selection, exit focus mode
- `F`: Fit selected node to view
- `/`: Focus search box

## Component Structure

```
MemoryView/
├── MemoryGraph.tsx          // Main container
│   ├── GraphCanvas.tsx      // React Flow wrapper
│   │   ├── MemoryNode.tsx   // Custom memory node
│   │   ├── SubjectNode.tsx  // Custom subject node
│   │   └── CustomEdge.tsx   // Custom edge renderer
│   ├── GraphControls.tsx    // Toolbar (search, filters, layout)
│   ├── MemoryDetailPanel.tsx // Side panel for selected memory
│   └── GraphMinimap.tsx     // Overview minimap
└── hooks/
    ├── useMemoryGraph.ts    // Data fetching & graph building
    └── useGraphLayout.ts    // Layout computation
```

### Key APIs

**useMemoryGraph.ts:**
```typescript
export function useMemoryGraph() {
  const model = useModel();

  // 1. Query cube for indexed subjects (efficient dimensional query)
  const cubeQuery = model.cubeStorage.query()
    .dimension('subjectType', '=', 'analyzed')
    .limit(100)
    .sortBy('created', 'desc');

  const indexedSubjects = await cubeQuery.execute();

  // 2. Extract memory references from subjects
  const memoryRefs = new Set(
    indexedSubjects.flatMap(s => s.memoryRefs || [])
  );

  // 3. Fetch only needed memories
  const memories = await Promise.all(
    Array.from(memoryRefs).map(id =>
      model.memoryPlan.getSubject(id)
    )
  );

  // 4. Build graph from pre-indexed data (no computation!)
  const graph = buildFromIndexedData(memories, indexedSubjects);

  return { nodes, edges, loading, error };
}
```

**Subject Node Click Handler:**
```typescript
const handleSubjectClick = async (subjectNode: SubjectNode) => {
  // 1. Navigate to conversation
  navigate(`/chat/${subjectNode.topicId}`);

  // 2. Get subject details
  const subject = await model.topicAnalysisModel.getSubject(subjectNode.id);

  // 3. Scroll to timestamp when subject was discussed
  const timestamp = subject.timeRanges[0].start;
  scrollToTime(timestamp);
};
```

## Performance

### Efficient Data Loading

**Use Cube.core Indices:**
- Query dimensional index (already computed)
- No full scans of storage
- No recomputing relationships

**Incremental Updates:**
```typescript
// Listen for cube updates
model.cubeStorage.onUpdate((event) => {
  if (event.type === 'subject' || event.type === 'memory') {
    // Add/update single node, don't re-query
    updateGraphNode(event.data);
  }
});
```

**Progressive Loading:**
- Limit initial render to 100 most recent memories
- "Load More" button for expansion
- Virtual rendering (React Flow handles this)

**Edge Computation:**
- Only compute edges for memories with keyword overlap
- Skip edges with similarity < 0.2
- Cache in sessionStorage

### Optimization Targets

- Initial load: < 2 seconds (100 memories)
- Incremental update: < 100ms
- Interaction response: < 50ms
- Graph with 500 nodes: Still interactive

## Error Handling

### Loading States

```typescript
const [state, setState] = useState({
  status: 'loading' | 'empty' | 'ready' | 'error',
  nodes: [],
  edges: [],
  error: null
});

// loading: Show skeleton loader
// empty: "No Memories Yet" + enable instructions
// error: Show error + retry button
// ready: Display graph
```

### Edge Cases

**No cube.core available (browser fallback):**
- Use direct TopicAnalysisModel queries
- Show warning: "Advanced indexing unavailable"
- Still functional, slower performance

**Orphaned references:**
- Subject references non-existent memory
- Display as "ghost node" (grayed out)
- Tooltip: "Referenced memory unavailable"

**Circular references:**
- Memory A → Subject B → Memory A
- Graph layout handles naturally (cycles OK)

**No subjects linked:**
- Show isolated memory node
- Filter: "Hide isolated memories"

**Performance degradation (>500 nodes):**
- Show warning
- Offer date range filter
- Focus mode on selected memory

**Concurrent updates:**
- Queue updates during interaction
- Apply on idle callback
- Badge: "Updates available (refresh)"

## Integration Steps

### 1. Create MemoryModule

```typescript
// browser-ui/src/modules/MemoryModule.ts
export class MemoryModule implements Module {
  readonly name = 'MemoryModule';

  static demands = [
    { targetType: 'ChannelManager', required: true },
    { targetType: 'TopicModel', required: true },
    { targetType: 'TopicAnalysisModel', required: true },
    { targetType: 'CubeStorage', required: false }
  ];

  public memoryPlan!: MemoryPlan;
  public chatMemoryPlan!: ChatMemoryPlan;
}
```

### 2. Register in Model

```typescript
// browser-ui/src/model/Model.ts
this.modules.set('memory', new MemoryModule());

get memoryPlan() { return this.modules.get('memory').memoryPlan; }
get chatMemoryPlan() { return this.modules.get('memory').chatMemoryPlan; }
```

### 3. Implement Components

- Replace MemoryView.tsx placeholder with MemoryGraph
- Create useMemoryGraph hook with cube queries
- Implement custom React Flow nodes/edges
- Add toolbar controls and interactions

### 4. Wire Navigation

- Use existing ChatView scrollToTime functionality
- Navigate to conversation + scroll to timestamp
- Close memory view on subject click

## Dependencies

**New:**
- `@xyflow/react` (React Flow library)
- `@memory/core` (already exists, needs integration)

**Existing:**
- `@refinio/one.core` (storage)
- `@cube/core` (dimensional queries)
- React Router (navigation)
- Model system (module integration)

## Success Criteria

- [ ] MemoryModule integrated into browser platform
- [ ] Graph displays memories and subjects from cube queries
- [ ] Click subject node navigates to conversation + timestamp
- [ ] Hover shows tooltips with details
- [ ] Search/filter controls work
- [ ] Incremental updates without full refresh
- [ ] Performance: < 2s load, < 100ms updates
- [ ] Error states handled gracefully
- [ ] No cube.core fallback works (slower but functional)

## Future Enhancements

- Edit memory details from panel
- Create new memories manually
- Merge related memories
- Export graph as image
- 3D force-directed layout option
- Collaborative memory editing (P2P sync)
