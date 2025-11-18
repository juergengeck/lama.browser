#!/usr/bin/env node
/**
 * Test ConnectionPlan pairing between two instances
 *
 * This test validates that connection.core's ConnectionPlan
 * works correctly for cross-platform pairing (as used in lama.cube and lama.browser).
 *
 * Flow:
 * 1. Start CommServer
 * 2. Create two instances (Alice, Bob) using refinio.api
 * 3. Alice creates invitation via ConnectionPlan
 * 4. Bob accepts invitation via ConnectionPlan
 * 5. Verify onPairingSuccess callbacks fire on both sides
 * 6. Verify connections established
 * 7. Cleanup
 */

// Load Node.js platform from packages
import '../packages/one.core/lib/system/load-nodejs.js';
import { startApiServer } from '../packages/refinio.api/dist/index.js';
import { ConnectionPlan } from '../connection.core/dist/esm/plans/ConnectionPlan.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const COMM_SERVER_URL = 'ws://localhost:8100';
const TEST_STORAGE = path.join(os.tmpdir(), 'test-connection-plan-pairing');

let commServer = null;
let aliceServer = null;
let bobServer = null;
let alicePlan = null;
let bobPlan = null;
let pairingCallbacks = { alice: false, bob: false };

/**
 * Clean storage
 */
function cleanStorage() {
  if (fs.existsSync(TEST_STORAGE)) {
    fs.rmSync(TEST_STORAGE, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_STORAGE, { recursive: true });
}

/**
 * Start CommServer
 */
async function startCommServer() {
  console.log('\n📡 Starting CommServer...');

  const ONE_MODELS_PATH = path.resolve(process.cwd(), 'packages/one.models');
  const commServerPath = path.join(ONE_MODELS_PATH, 'lib/misc/ConnectionEstablishment/communicationServer/CommunicationServer.js');

  if (!fs.existsSync(commServerPath)) {
    throw new Error(`CommServer not found at ${commServerPath}`);
  }

  const fileUrl = `file://${commServerPath}`;
  const CommunicationServerModule = await import(fileUrl);
  const CommunicationServer = CommunicationServerModule.default;

  commServer = new CommunicationServer();
  await commServer.start('localhost', 8100);

  console.log('✅ CommServer started\n');
}

/**
 * Create instance with ConnectionPlan
 */
async function createInstance(name, email) {
  console.log(`\n👤 Creating ${name} instance...`);

  const storageDir = path.join(TEST_STORAGE, name);

  // Override config for this instance
  process.env.REFINIO_INSTANCE_NAME = name;
  process.env.REFINIO_INSTANCE_EMAIL = email;
  process.env.REFINIO_INSTANCE_SECRET = `test-secret-${name}`;
  process.env.REFINIO_INSTANCE_DIRECTORY = storageDir;
  process.env.REFINIO_COMM_SERVER_URL = COMM_SERVER_URL;
  process.env.REFINIO_INSTANCE_WIPE_STORAGE = 'true';
  process.env.REFINIO_API_PORT = name === 'alice' ? '49401' : '49402';

  // Start API server (this initializes ONE.core + models)
  const server = await startApiServer();

  console.log(`   Instance ID: ${server.instanceIdHash.substring(0, 16)}...`);
  console.log(`   Owner ID: ${server.leuteModel.ownerId?.substring(0, 16)}...`);

  // Create pseudo-NodeOneCore for ConnectionPlan
  const nodeOneCore = {
    initialized: true,
    ownerId: server.leuteModel.ownerId,
    instanceId: server.instanceIdHash,
    connectionsModel: server.connectionsModel,
    leuteModel: server.leuteModel,
    channelManager: server.channelManager
  };

  // Create ConnectionPlan (mimicking lama.cube/browser)
  const connectionPlan = new ConnectionPlan(
    nodeOneCore,
    undefined, // No storage provider
    COMM_SERVER_URL // THIS is the key parameter!
  );

  // Register onPairingSuccess handler
  server.connectionsModel.pairing.onPairingSuccess(
    async (initiatedLocally, localPersonId, localInstanceId, remotePersonId, remoteInstanceId, token) => {
      console.log(`\n🎉 ${name} - PAIRING SUCCESS!`);
      console.log(`   Initiated locally: ${initiatedLocally}`);
      console.log(`   Local person: ${localPersonId?.substring(0, 16)}...`);
      console.log(`   Remote person: ${remotePersonId?.substring(0, 16)}...`);
      pairingCallbacks[name] = true;
    }
  );

  console.log(`✅ ${name} instance ready\n`);

  return {
    name,
    server,
    connectionPlan,
    nodeOneCore
  };
}

/**
 * Main test
 */
async function runTest() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🧪 ConnectionPlan Pairing Test');
  console.log('═══════════════════════════════════════════════════════');

  try {
    // Setup
    cleanStorage();
    await startCommServer();

    // Create instances
    const alice = await createInstance('alice', 'alice@pairing.test');
    const bob = await createInstance('bob', 'bob@pairing.test');

    aliceServer = alice.server;
    bobServer = bob.server;
    alicePlan = alice.connectionPlan;
    bobPlan = bob.connectionPlan;

    // Step 1: Alice creates invitation
    console.log('\n📨 Alice creating invitation...');
    const inviteResult = await alicePlan.createPairingInvitation({ mode: 'IoP' });

    if (!inviteResult.success) {
      throw new Error(`Alice failed to create invitation: ${inviteResult.error}`);
    }

    console.log('✅ Invitation created');
    console.log(`   URL: ${inviteResult.invitation.url.substring(0, 100)}...`);
    console.log(`   Mode: ${inviteResult.invitation.mode}`);

    // Step 2: Bob accepts invitation
    console.log('\n📬 Bob accepting invitation...');
    const acceptResult = await bobPlan.acceptPairingInvitation({
      invitationUrl: inviteResult.invitation.url
    });

    if (!acceptResult.success) {
      throw new Error(`Bob failed to accept invitation: ${acceptResult.error}`);
    }

    console.log('✅ Bob accepted invitation');

    // Step 3: Wait for callbacks
    console.log('\n⏳ Waiting for onPairingSuccess callbacks...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 4: Verify
    console.log('\n📊 Verifying results...');
    console.log(`   Alice callback fired: ${pairingCallbacks.alice ? '✅' : '❌'}`);
    console.log(`   Bob callback fired: ${pairingCallbacks.bob ? '✅' : '❌'}`);

    if (!pairingCallbacks.alice || !pairingCallbacks.bob) {
      throw new Error('onPairingSuccess callbacks did not fire on both sides');
    }

    // Check connections
    const aliceConnections = alice.nodeOneCore.connectionsModel.connectionsInfo();
    const bobConnections = bob.nodeOneCore.connectionsModel.connectionsInfo();

    console.log(`   Alice connections: ${aliceConnections.length}`);
    console.log(`   Bob connections: ${bobConnections.length}`);

    if (aliceConnections.length === 0 || bobConnections.length === 0) {
      throw new Error('Connections not established');
    }

    console.log('\n✅ ✅ ✅ TEST PASSED ✅ ✅ ✅');
    console.log('ConnectionPlan pairing works correctly!\n');

    return true;

  } catch (error) {
    console.error('\n❌ ❌ ❌ TEST FAILED ❌ ❌ ❌');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    return false;

  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');

    if (aliceServer) {
      try {
        await aliceServer.connectionsModel.shutdown();
        await aliceServer.channelManager.shutdown();
        await aliceServer.leuteModel.shutdown();
      } catch (e) {
        console.error('Alice cleanup error:', e.message);
      }
    }

    if (bobServer) {
      try {
        await bobServer.connectionsModel.shutdown();
        await bobServer.channelManager.shutdown();
        await bobServer.leuteModel.shutdown();
      } catch (e) {
        console.error('Bob cleanup error:', e.message);
      }
    }

    if (commServer) {
      await commServer.stop();
    }

    // Clean storage
    if (fs.existsSync(TEST_STORAGE)) {
      fs.rmSync(TEST_STORAGE, { recursive: true, force: true });
    }

    console.log('✅ Cleanup complete\n');
  }
}

// Run test
runTest()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
