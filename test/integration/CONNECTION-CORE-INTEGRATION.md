# Connection.core Integration Complete

## What We Built

Multi-instance test infrastructure using **connection.core** for connection management:

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Test Infrastructure                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Instance   │  │   Instance   │  │   Instance   │     │
│  │    Alice     │  │     Bob      │  │   Charlie    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │             │
│         └──────────────────┴──────────────────┘             │
│                           │                                 │
│                  ┌────────▼────────┐                        │
│                  │  CommServer     │                        │
│                  │  (port 8100)    │                        │
│                  └─────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Components

**1. lama-api-server.js** - Spawnable API server per instance
   - ONE.core instance with separate storage
   - LeuteModel (direct instantiation, not ONE.models API)
   - ChannelManager for channel operations
   - ConnectionsModel (ONE.models) for pairing/CHUM
   - **PairingHandler (connection.core)** for P2P vs group detection
   - chat.core ChatHandler
   - HTTP API for test control

**2. connection.core Integration**
   - Uses `handlePairingCompletion()` from connection.core
   - Detects invitation type (P2P vs group chat)
   - Creates appropriate channels based on type
   - Platform-agnostic business logic

**3. HTTP API Endpoints**
   - `GET /identity` - Get instance identity
   - `POST /connect` - Create or accept invitation
   - `GET /connections` - List paired connections

### Key Patterns

**Following lama.electron Pattern:**
```javascript
// Create LeuteModel directly (not via ONE.models API)
leuteModel = new LeuteModel(commServerUrl, true);
leuteModel.appId = 'one.leute';
await leuteModel.init();

// ConnectionsModel with LeuteModel that has event emitters
connectionsModel = new ConnectionsModel(leuteModel, {
  commServerUrl,
  acceptIncomingConnections: true,
  acceptUnknownInstances: true,
  allowPairing: true,
  // ...
});
await connectionsModel.init(null);

// Listen to pairing events and use connection.core
connectionsModel.on('pairingCompleted', async (event) => {
  const result = await handlePairingCompletion({
    leuteModel,
    channelManager,
    localPersonId,
    remotePersonId,
    initiatedLocally
  });
  // result.type = 'p2p' | 'group'
});
```

**Separation of Concerns:**
- **ONE.models/ConnectionsModel**: Transport layer (CHUM, WebSocket, pairing protocol)
- **connection.core/PairingHandler**: Business logic (P2P vs group detection, channel setup)
- **chat.core/ChatHandler**: Message handling and conversation logic

### What's Working

✅ Multi-instance framework spawns 3 separate ONE.core instances
✅ Each instance has unique storage directory
✅ CommServer coordination (port 8100)
✅ HTTP API for test control
✅ ConnectionsModel initialization with proper LeuteModel
✅ connection.core PairingHandler integration
✅ Pairing event handling with P2P vs group detection

### Next Steps

1. **Test Pairing Flow**: Create invitation in Alice → Accept in Bob → Verify connection
2. **Test P2P Chat**: Send message Alice → Bob → Verify received
3. **Test Group Chat**: Create 3-way chat → Verify all see messages
4. **Integration Test**: Full end-to-end test with assertions

### Usage

```bash
# Start CommServer (in separate terminal)
cd test/integration
node start-comm-server.js

# Start instance manually
INSTANCE_NAME=alice \
INSTANCE_EMAIL=alice@test.local \
COMM_SERVER_URL=ws://localhost:8100 \
node lama-api-server.js

# Or run full test suite
npm test
```

### Files

- `test/integration/lama-api-server.js` - Main API server
- `test/integration/group-chat-test.js` - Mocha test suite
- `test/integration/platform/` - Node.js platform adapters (future use)
- `connection.core/` - Platform-agnostic connection management
- `chat.core/` - Chat message handling
- `trust.core/` - Trust/credential management (future)

## Summary

We successfully integrated connection.core into the test infrastructure following the lama.electron pattern. The key insight was creating LeuteModel directly instead of using ONE.models API, which provides the event emitters that ConnectionsModel needs. connection.core's PairingHandler now handles the business logic for detecting P2P vs group invitations.
