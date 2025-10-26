# MCP-via-Chat Architecture for Browser Platform

## Overview

**Distributed MCP System**: Peers advertise their MCP tools and others can discover and execute them via the chat protocol. This creates a P2P tool ecosystem without requiring local MCP servers in the browser.

## Architecture

### 1. Tool Advertisement (Broadcast)

Peers with MCP servers (Electron/Node.js instances) advertise their capabilities:

```typescript
interface MCPToolRecipe {
  $type$: 'MCPTool';
  $v$: 1;
  id: string;
  name: string;
  description: string;
  version: string;
  author: SHA256IdHash<Person>;
  signature: string; // Cryptographic signature

  // Tool specification
  parameters: any; // JSON Schema
  returns: any; // JSON Schema

  // Execution details
  runtime: 'native' | 'wasm' | 'javascript' | 'mcp-server';
  serverCommand?: string;
  serverArgs?: string[];

  // Permissions
  permissions: {
    network: boolean;
    filesystem: string[];
    native: string[];
  };
}
```

**Advertisement Flow:**
1. MCP-enabled peer creates `MCPToolRecipe` objects
2. Signs them with their private key
3. Broadcasts to connected peers via channel posts
4. Stores in ONE.core versioned storage

### 2. Tool Discovery (Receive)

Browser platform discovers available tools:

```typescript
interface ToolSharePacket {
  toolId: string;
  toolDefinition: MCPToolRecipe;
  signature: string;
  version: string;
  ownerId: SHA256IdHash<Person>; // Who offers this tool
}
```

**Discovery Flow:**
1. Listen for MCPToolRecipe objects on channels
2. Verify cryptographic signatures
3. Check permissions and trust level
4. Store in local registry (Map<toolId, ToolInfo>)
5. Display in UI (MCPSettings)

### 3. Tool Execution (Remote Call)

Browser sends execution request via chat:

```typescript
interface MCPToolCallRequest {
  $type$: 'MCPToolCallRequest';
  toolId: string;
  parameters: any;
  requestId: string; // UUID for correlation
  requestedBy: SHA256IdHash<Person>;
}

interface MCPToolCallResponse {
  $type$: 'MCPToolCallResponse';
  requestId: string;
  result?: any;
  error?: string;
}
```

**Execution Flow:**
1. LLM decides to use a tool
2. Browser creates `MCPToolCallRequest` message
3. Posts to channel with tool owner
4. Tool owner executes and posts `MCPToolCallResponse`
5. LLM receives result and continues

### 4. Security & Trust

**Cryptographic Verification:**
- Tool definitions signed by author
- Signatures verified before execution
- Trust based on Person identity

**Permission Model:**
```typescript
interface ToolPermissions {
  network: boolean;      // Can access network
  filesystem: string[];  // Allowed paths
  native: string[];     // Allowed native modules
}
```

**Trust Levels:**
- **Trusted** - Direct contacts, execute any tool
- **Limited** - Known contacts, read-only tools only
- **Untrusted** - Unknown peers, no execution

## Implementation Tasks

### Phase 1: Tool Discovery

- [ ] Create `MCPToolRecipe` ONE.core recipe
- [ ] Implement `MCPManager` for browser platform
- [ ] Listen for tool advertisement objects on channels
- [ ] Verify signatures and store in registry
- [ ] Display available tools in `MCPSettings` UI

### Phase 2: Tool Execution

- [ ] Create `MCPToolCallRequest/Response` message types
- [ ] Integrate with `LLMManager` tool system
- [ ] Send execution requests via chat
- [ ] Handle responses and timeouts
- [ ] Update LLM context with results

### Phase 3: Tool Advertisement (Optional for Browser)

- [ ] Allow browser to advertise WASM/JavaScript tools
- [ ] Sign tool definitions with user's key
- [ ] Broadcast to peers
- [ ] Handle incoming execution requests

## File Structure

```
lama.browser/
├── browser-ui/
│   ├── src/
│   │   ├── models/
│   │   │   └── MCPManager.ts         # Browser MCP manager
│   │   ├── handlers/
│   │   │   └── MCPHandler.ts         # IPC-free MCP operations
│   │   ├── components/
│   │   │   └── Settings/
│   │   │       └── MCPSettings.tsx   # Updated for discovery
│   │   └── types/
│   │       └── mcp.ts                # MCP type definitions
│   └── docs/
│       └── MCP-VIA-CHAT.md          # This file
```

## Integration Points

### LLMManager Integration

```typescript
// In LLMManager (lama.core)
async initializeMCP() {
  if (!this.mcpManager) {
    console.log('[LLMManager] MCP via chat - using remote tools only');
    return;
  }

  // Load tools from MCPManager (either local or remote)
  const tools = await this.mcpManager.getAvailableTools();
  this.mcpTools.clear();

  for (const tool of tools) {
    this.mcpTools.set(tool.id, tool);
  }
}
```

### Model Integration

```typescript
// In Model.ts
this.mcpManager = new MCPManager(this, {
  channelManager: this.channelManager,
  leuteModel: this.leuteModel,
  cryptoApi: this.one.crypto
});

await this.mcpManager.init();

// Pass to LLMManager
this.llmManager = new LLMManager(
  llmPlatform,
  this.mcpManager // Now aware of remote tools
);
```

## Reference Implementation

See `/reference/lama/src/models/mcp/MCPManager.ts` for the full implementation pattern.

**Key Methods:**
- `shareToolWithPeer(peerId, toolId)` - Share specific tool
- `broadcastTool(toolId)` - Broadcast to all peers
- `getAvailableTools()` - Get local + remote tools
- `executeTool(toolId, params)` - Execute (local or remote)

## Benefits

✅ **No Local Servers** - Browser doesn't need MCP servers
✅ **P2P Tool Sharing** - Leverage Electron peers' capabilities
✅ **Cryptographic Trust** - Signed tool definitions
✅ **Permission Model** - Control what tools can do
✅ **ONE Platform Native** - Uses existing chat/storage infrastructure

## Future Enhancements

- **Tool Marketplace** - Discover tools from wider network
- **WASM Tools** - Run safe tools locally in browser
- **Tool Composition** - Chain multiple tools together
- **Performance Metrics** - Track tool execution stats
- **Caching** - Cache tool results for repeated calls
