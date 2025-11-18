# Testing Guide

## Integration Tests

Located in `test/integration/`, organized by feature specs.

### Running Tests

```bash
# Run all integration tests
npm test

# Run specific test
node test/integration/003-group-chat-attestation-test/test-group-chat-attestation.js

# Watch mode
npm run test:watch
```

### Test Pattern

Multi-peer scenarios using isolated ONE.core instances:

1. **Setup**: Spawn CommServer for relay
2. **Isolation**: Create temporary directories per peer
3. **Connect**: Establish P2P connections via CHUM
4. **Verify**: Check data sync across all peers
5. **Cleanup**: Remove temporary storage

### Example Structure

```javascript
// test/integration/003-group-chat-attestation-test/test-group-chat-attestation.js
import { setupPeer, createTempDir, cleanupPeer } from '../test-utils.js';

async function testGroupChat() {
  const peer1Dir = await createTempDir();
  const peer2Dir = await createTempDir();

  const peer1 = await setupPeer(peer1Dir);
  const peer2 = await setupPeer(peer2Dir);

  try {
    // Test logic here
    await peer1.sendMessage('Hello');
    await verifyMessageReceived(peer2, 'Hello');
  } finally {
    await cleanupPeer(peer1, peer1Dir);
    await cleanupPeer(peer2, peer2Dir);
  }
}
```

## Unit Tests (Future)

Core libraries should have unit tests with mocked dependencies.

### Platform-Specific Tests

#### lama.cube (Electron)

```bash
cd electron-ui
npm test                  # All tests
npm run test:watch        # Watch mode
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:coverage     # Coverage report
npm run test:ci           # CI mode
```

#### *.core/ Libraries

```bash
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:integration  # Integration tests
```

## Test Utilities

Common test helpers in `test/utils/`:

- `setupPeer()` - Create isolated peer instance
- `createTempDir()` - Generate temporary storage
- `cleanupPeer()` - Shutdown and cleanup
- `waitForSync()` - Wait for CHUM sync
- `verifyMessageReceived()` - Check message delivery

## Best Practices

1. **Isolation**: Each test gets isolated storage
2. **Cleanup**: Always cleanup in `finally` blocks
3. **Async**: Use proper async/await patterns
4. **Fail Fast**: No retries - if test fails, fix the bug
5. **Real Instances**: Use actual ONE.core, not mocks (for integration tests)

## CI/CD

Tests run in CI via:
```bash
npm run test:ci
```

Ensures:
- No interactive prompts
- Clear pass/fail status
- Proper exit codes
- Test coverage reporting
