# LAMA Browser API Integration

## Overview

LAMA Browser includes an optional **embedded API server** (powered by `@refinio/refinio-api`) that provides external orchestration and audit capabilities. This allows `refinio.cli` and other tools to inspect, control, and automate browser operations for testing, debugging, and monitoring.

**Purpose**: External tooling, NOT internal feature integration.

## Architecture

```
┌─────────────────────────────────────┐
│   refinio.cli (external tool)       │
│   - Orchestrate operations           │
│   - Audit/inspect state              │
│   - Automated testing                │
│   - Health monitoring                │
└──────────────┬──────────────────────┘
               │ QUIC/WebSocket
               │ localhost:49498
               ↓
┌─────────────────────────────────────┐
│   lama.browser (main thread)        │
│   ┌───────────────────────────────┐ │
│   │ BrowserIntegratedAPI          │ │
│   │ - QuicVCServer                │ │
│   │ - ObjectHandler (CRUD)        │ │
│   │ - ProfileHandler              │ │
│   │ - RecipeHandler               │ │
│   │ - AuditHandler (custom)       │ │
│   └───────────┬───────────────────┘ │
│               │ (shares Instance)    │
│   ┌───────────▼───────────────────┐ │
│   │ Model (ONE.core Instance)     │ │
│   │ - SingleUserNoAuth            │ │
│   │ - LeuteModel                  │ │
│   │ - ChannelManager              │ │
│   │ - TopicModel                  │ │
│   │ - All existing handlers       │ │
│   └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Key Principles

1. **Shared Instance**: API server uses the SAME ONE.core Instance as the browser Model
2. **Localhost Only**: API binds to `localhost` - no network exposure
3. **Development Mode**: Enabled only in dev builds or with explicit flag
4. **Read-Heavy**: Optimized for inspection and audit, not heavy write operations
5. **No Fallbacks**: If API fails, operations fail - fix the problem

## Use Cases

### 1. Orchestration

Programmatically control the browser for testing and automation:

```bash
# Setup test scenario
refinio connect quic://localhost:49498
refinio auth login test@lama.local

# Create test data
refinio create Topic --data '{"id":"test-topic","name":"Test Conversation"}'
refinio create Message --data '{"content":"Test message","topicId":"test-topic"}'

# Batch operations
for i in {1..100}; do
  refinio create Message --data "{\"content\":\"Message $i\",\"topicId\":\"test-topic\"}"
done

# Register custom recipes
refinio recipe register --file custom-recipe.json
```

### 2. Audit & Inspection

Inspect internal state for debugging:

```bash
# Inspect objects
refinio get <idHash>                    # Read specific object
refinio object count                    # Count stored objects

# Inspect models
refinio profile list                    # List all profiles
refinio connection list                 # See active connections
refinio recipe list                     # See registered recipes

# Debug state
refinio stats                           # Get instance statistics
refinio connection status <instanceId>  # Check connection health
```

### 3. Automated Testing

Integrate into CI/CD pipelines:

```bash
#!/bin/bash
# Integration test script

# Start browser with API enabled
npm run dev &
BROWSER_PID=$!

# Wait for API availability
until refinio ping quic://localhost:49498 2>/dev/null; do
  sleep 1
done

# Run test scenarios
refinio connect quic://localhost:49498
refinio create Topic --file test-data.json

# Verify results
OBJECT_COUNT=$(refinio object count | jq '.count')
if [ "$OBJECT_COUNT" -ne 10 ]; then
  echo "Test failed: Expected 10 objects, got $OBJECT_COUNT"
  kill $BROWSER_PID
  exit 1
fi

# Cleanup
kill $BROWSER_PID
```

### 4. Monitoring & Health Checks

Continuous monitoring for production debugging:

```bash
# Health check script
while true; do
  refinio stats | jq '{
    objects: .objectCount,
    connections: .connectionStatus,
    initialized: .isInitialized
  }'
  sleep 10
done

# Simple health check
refinio ping && echo "✅ Healthy" || echo "❌ Down"
```

## Implementation

### 1. API Server Service

**Location**: `browser-ui/src/services/browser-api-server.ts`

```typescript
import { QuicVCServer } from '@refinio/refinio-api/server/QuicVCServer';
import { InstanceAuthManager } from '@refinio/refinio-api/auth/InstanceAuthManager';
import { ObjectHandler } from '@refinio/refinio-api/handlers/ObjectHandler';
import { RecipeHandler } from '@refinio/refinio-api/handlers/RecipeHandler';
import { ProfileHandler } from '@refinio/refinio-api/handlers/ProfileHandler';
import type Model from '../model/Model';

export class BrowserIntegratedAPI {
  private server: QuicVCServer | null = null;
  private model: Model;

  constructor(model: Model) {
    this.model = model;
  }

  async start(port: number = 49498) {
    if (!this.model.initialized) {
      throw new Error('Model must be initialized before starting API');
    }

    console.log('[BrowserAPI] Initializing API server...');

    // Reuse existing ONE.core Instance from Model
    const instance = this.model.one.getInstance();

    // Create authentication manager
    const authManager = new InstanceAuthManager(instance);

    // Create standard handlers
    const objectHandler = new ObjectHandler();
    await objectHandler.initialize(instance);

    const recipeHandler = new RecipeHandler();
    await recipeHandler.initialize(instance);

    const profileHandler = new ProfileHandler();
    await profileHandler.initialize(instance, this.model.leuteModel);

    // Create QuicVC server
    this.server = new QuicVCServer({
      instance,
      authManager,
      handlers: {
        object: objectHandler,
        recipe: recipeHandler,
        profile: profileHandler
      },
      config: {
        port,
        host: 'localhost' // Browser can only bind to localhost
      }
    });

    await this.server.start();
    console.log(`[BrowserAPI] ✅ API server listening on localhost:${port}`);
    console.log(`[BrowserAPI] 💡 Connect with: refinio connect quic://localhost:${port}`);
  }

  async stop() {
    if (this.server) {
      console.log('[BrowserAPI] Stopping API server...');
      await this.server.stop();
      this.server = null;
    }
  }

  isRunning(): boolean {
    return this.server !== null;
  }
}
```

### 2. Model Integration

**Location**: `browser-ui/src/model/Model.ts`

```typescript
import { BrowserIntegratedAPI } from '../services/browser-api-server';

export default class Model {
  // ... existing properties
  public apiServer: BrowserIntegratedAPI | null = null;

  constructor(commServerUrl: string) {
    // ... existing constructor code

    // Create API server (conditionally enabled)
    const enableApi = import.meta.env.VITE_ENABLE_API_SERVER === 'true' ||
                     localStorage.getItem('enableApiServer') === 'true';

    if (enableApi) {
      this.apiServer = new BrowserIntegratedAPI(this);
      console.log('[Model] 🔧 API server will be started after initialization');
    }
  }

  public async init(_instanceName: string, _secret: string): Promise<void> {
    try {
      // ... existing init code (leuteModel, channelManager, etc.)

      // Start API server after all models initialized
      if (this.apiServer) {
        const port = Number(import.meta.env.VITE_API_SERVER_PORT) || 49498;
        await this.apiServer.start(port);
      }

      // ... rest of init
    } catch (e) {
      console.error('[Model] Models init failed:', e);
      await this.shutdown();
      throw e;
    }
  }

  public async shutdown(): Promise<void> {
    console.log('[Model] Shutting down models...');

    // Stop API server first
    if (this.apiServer) {
      await this.apiServer.stop();
    }

    // ... existing shutdown code
  }
}
```

### 3. Environment Configuration

**Location**: `browser-ui/.env.development`

```bash
# Enable API server in development
VITE_ENABLE_API_SERVER=true
VITE_API_SERVER_PORT=49498
```

**Location**: `browser-ui/.env.production`

```bash
# Disable API server in production builds
VITE_ENABLE_API_SERVER=false
```

### 4. Runtime Control (Optional)

Enable/disable API server at runtime in browser console:

```javascript
// Enable API server
localStorage.setItem('enableApiServer', 'true');
location.reload();

// Disable API server
localStorage.removeItem('enableApiServer');
location.reload();
```

## Available Operations

### Standard Handlers (from refinio.api)

#### ObjectHandler
```bash
# Create objects
refinio create <type> --data <json>

# Read objects
refinio get <idHash>                    # By ID hash (latest version)
refinio get <hash>                      # By content hash (specific version)

# Update versioned objects
refinio update <idHash> --data <json>

# Query (requires reverse maps)
refinio query <type> --filter <json>
```

#### ProfileHandler
```bash
# Profile management
refinio profile create <nickname>
refinio profile get <personId>
refinio profile update <personId> --data <json>
refinio profile delete <personId>
refinio profile list
```

#### RecipeHandler
```bash
# Recipe management
refinio recipe register --file recipe.json
refinio recipe get <name>
refinio recipe list
refinio recipe list --type versioned
```

### Custom Audit Handler (Optional)

**Location**: `browser-ui/src/services/audit-handler.ts`

```typescript
import type Model from '../model/Model';

export class AuditHandler {
  constructor(private model: Model) {}

  /**
   * Get instance statistics
   */
  async getStats() {
    return {
      isInitialized: this.model.initialized,
      ownerId: this.model.ownerId,
      models: {
        leute: this.model.leuteModel.state?.currentState,
        channels: this.model.channelManager.state?.currentState,
        topics: this.model.topicModel.state?.currentState,
        connections: this.model.connections.state?.currentState
      },
      connections: {
        active: await this.getActiveConnections(),
        commServer: this.model.connections.getCommServerUrl()
      },
      api: {
        enabled: this.model.apiServer?.isRunning() || false
      }
    };
  }

  /**
   * Get active connections
   */
  private async getActiveConnections() {
    // Implementation depends on ConnectionsModel API
    return [];
  }

  /**
   * Verify data integrity
   */
  async verifyIntegrity() {
    // Check for orphaned objects, broken references, etc.
    const issues: string[] = [];

    // Example checks
    // - Verify all topic references are valid
    // - Check for orphaned messages
    // - Validate channel access rights

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Export diagnostic information
   */
  async exportDiagnostics() {
    return {
      stats: await this.getStats(),
      integrity: await this.verifyIntegrity(),
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      storage: await this.getStorageInfo()
    };
  }

  /**
   * Get storage information (IndexedDB)
   */
  private async getStorageInfo() {
    if (typeof indexedDB !== 'undefined' && 'databases' in indexedDB) {
      const dbs = await indexedDB.databases();
      return dbs.map(db => ({
        name: db.name,
        version: db.version
      }));
    }
    return [];
  }
}
```

Register in `BrowserIntegratedAPI`:

```typescript
import { AuditHandler } from './audit-handler';

// In BrowserIntegratedAPI.start()
const auditHandler = new AuditHandler(this.model);
await auditHandler.initialize(); // If needed

this.server = new QuicVCServer({
  // ... existing config
  handlers: {
    object: objectHandler,
    recipe: recipeHandler,
    profile: profileHandler,
    audit: auditHandler  // Custom handler
  }
});
```

## Security Considerations

### 1. Localhost Only

The API server **MUST** only bind to `localhost`:

```typescript
config: {
  host: 'localhost'  // NEVER '0.0.0.0' or public IP
}
```

### 2. Development Mode Only

Recommended to disable in production builds:

```typescript
// Only enable in dev or with explicit flag
const enableApi = (
  import.meta.env.DEV ||
  import.meta.env.VITE_ENABLE_API_SERVER === 'true' ||
  localStorage.getItem('enableApiServer') === 'true'
);
```

### 3. Authentication

Currently uses InstanceAuthManager - only instance owner can authenticate:

```bash
# Authentication required for most operations
refinio auth login <owner-email>
```

Future: Consider additional authentication for production debugging.

### 4. Browser Limitations

- **WebTransport API required**: Modern browsers only (Chrome 97+, Edge 97+)
- **Localhost restriction**: Cannot bind to external interfaces from browser
- **CORS restrictions**: May affect some operations

## Troubleshooting

### API Server Won't Start

**Symptoms**: API server fails to initialize, no connection possible

**Possible Causes**:
1. Model not initialized yet (Instance not created)
2. WebTransport API not available (old browser)
3. Port already in use

**Solutions**:
```typescript
// Check Model.initialized before starting
if (!this.model.initialized) {
  throw new Error('Model must be initialized first');
}

// Try alternative port
await this.apiServer.start(49499);

// Check WebTransport support
if (!('WebTransport' in window)) {
  console.warn('WebTransport not supported - API server unavailable');
}
```

### Connection Refused from refinio.cli

**Symptoms**: `refinio connect` fails with connection error

**Possible Causes**:
1. API server not running
2. Wrong port
3. Browser not started yet

**Solutions**:
```bash
# Check if browser is running
ps aux | grep vite

# Verify API server in browser console
window.model?.apiServer?.isRunning()

# Check connection with correct port
refinio connect quic://localhost:49498
```

### Operations Fail After Connection

**Symptoms**: Connected but operations return errors

**Possible Causes**:
1. Not authenticated
2. Instance not fully initialized
3. Handler not registered

**Solutions**:
```bash
# Authenticate first
refinio auth login <owner-email>

# Check instance status
refinio stats

# Verify handler availability
refinio recipe list  # Should return recipes
```

## Development Workflows

### Local Development Testing

```bash
# Terminal 1: Start browser with API
cd browser-ui
npm run dev

# Terminal 2: Connect and test
refinio connect quic://localhost:49498
refinio auth login test@lama.local
refinio create Topic --data '{"id":"test","name":"Test"}'

# Browser: Verify topic appears in UI
```

### Integration Testing

```bash
# Run integration tests
cd lama.browser
npm run test:integration

# Custom test script
./scripts/test-with-api.sh
```

### Production Debugging

```javascript
// 1. Enable API in production (browser console)
localStorage.setItem('enableApiServer', 'true');
location.reload();

// 2. Wait for reload, then connect
// Terminal:
refinio connect quic://localhost:49498
refinio stats
refinio get <problematic-object-id>
refinio connection list

// 3. Export diagnostics
refinio audit diagnostics > debug-dump.json

// 4. Disable API when done
localStorage.removeItem('enableApiServer');
location.reload();
```

## Implementation Checklist

- [ ] Install `@refinio/refinio-api` dependency in `browser-ui/package.json`
- [ ] Create `browser-ui/src/services/browser-api-server.ts`
- [ ] Integrate API server into `browser-ui/src/model/Model.ts`
- [ ] Add environment variables in `.env.development` and `.env.production`
- [ ] (Optional) Create `browser-ui/src/services/audit-handler.ts` for custom operations
- [ ] Add documentation to `browser-ui/README.md`
- [ ] Create integration test script
- [ ] Test with `refinio.cli`
- [ ] Document common orchestration patterns
- [ ] Add troubleshooting guide

## References

- **refinio.api Documentation**: `../lama/packages/refinio.api/README.md`
- **Integration Architecture**: `../lama/packages/refinio.api/INTEGRATION.md`
- **CLI Documentation**: `../lama/packages/refinio.api/cli.md`
- **Browser Platform Status**: `./BROWSER-PLATFORM-STATUS.md`
- **Handler Architecture**: `./HANDLER-ARCHITECTURE.md`

## Future Enhancements

### Phase 1: Basic Implementation (Current)
- Standard handlers (Object, Recipe, Profile)
- Localhost-only binding
- Development mode only
- Basic authentication (instance owner)

### Phase 2: Enhanced Audit (Future)
- Custom AuditHandler with diagnostics
- Integrity verification
- Performance monitoring
- Storage analysis

### Phase 3: Advanced Features (Future)
- State snapshots and restore
- Time-travel debugging
- Query optimization analysis
- Real-time event streaming

### Phase 4: Production Tooling (Future)
- Production-safe authentication
- Rate limiting
- Audit logging
- Remote monitoring support
