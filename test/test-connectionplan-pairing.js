#!/usr/bin/env node
/**
 * Test ConnectionPlan pairing between two instances
 * NO SHORTCUTS - using actual installed packages
 */

import '../packages/one.core/lib/system/load-nodejs.js';
import { initInstance, getInstanceIdHash, getInstanceOwnerIdHash, closeInstance } from '../packages/one.core/lib/instance.js';
import { setBaseDirOrName } from '../packages/one.core/lib/system/storage-base.js';
import LeuteModel from '../packages/one.models/lib/models/Leute/LeuteModel.js';
import ChannelManager from '../packages/one.models/lib/models/ChannelManager.js';
import ConnectionsModel from '../packages/one.models/lib/models/ConnectionsModel.js';
import TopicModel from '../packages/one.models/lib/models/Chat/TopicModel.js';
import { CORE_RECIPES } from '../packages/one.core/lib/recipes.js';
import RecipesStable from '../packages/one.models/lib/recipes/recipes-stable.js';
import RecipesExperimental from '../packages/one.models/lib/recipes/recipes-experimental.js';
import { ConnectionPlan } from '../connection.core/dist/esm/plans/ConnectionPlan.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const COMM_SERVER_URL = 'ws://localhost:8100';
const TEST_STORAGE = path.join(os.tmpdir(), 'test-connectionplan-pairing');

let commServer = null;
let alicePairingSuccess = false;
let bobPairingSuccess = false;

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

  const CommunicationServerModule = await import('../packages/one.models/lib/misc/ConnectionEstablishment/communicationServer/CommunicationServer.js');
  const CommunicationServer = CommunicationServerModule.default;

  commServer = new CommunicationServer();
  await commServer.start('localhost', 8100);

  console.log('✅ CommServer started on localhost:8100\n');
}

/**
 * Create instance with ConnectionPlan
 */
async function createInstance(name, email) {
  console.log(`\n👤 Creating ${name}...`);

  const storageDir = path.join(TEST_STORAGE, name);
  setBaseDirOrName(storageDir);

  // Initialize ONE.core
  await initInstance({
    name,
    email,
    secret: `test-secret-${name}`,
    directory: storageDir,
    initialRecipes: [...CORE_RECIPES, ...RecipesStable, ...RecipesExperimental],
    wipeStorage: true
  });

  const ownerId = getInstanceOwnerIdHash();
  const instanceId = getInstanceIdHash();

  console.log(`   Owner: ${ownerId.substring(0, 16)}...`);
  console.log(`   Instance: ${instanceId.substring(0, 16)}...`);

  // Create models
  const leuteModel = new LeuteModel(COMM_SERVER_URL, true);
  await leuteModel.init();

  const connectionsModel = new ConnectionsModel(leuteModel, {
    commServerUrl: COMM_SERVER_URL,
    acceptIncomingConnections: true,
    acceptUnknownInstances: true,
    acceptUnknownPersons: false,
    allowPairing: true,
    establishOutgoingConnections: true,
    allowDebugRequests: true,
    pairingTokenExpirationDuration: 60000 * 15,
    noImport: false,
    noExport: false
  });
  await connectionsModel.init();

  const channelManager = new ChannelManager(leuteModel);
  await channelManager.init();

  const topicModel = new TopicModel(channelManager, leuteModel);
  await topicModel.init();

  // Create pseudo-NodeOneCore
  const nodeOneCore = {
    initialized: true,
    ownerId,
    instanceId,
    connectionsModel,
    leuteModel,
    channelManager,
    topicModel
  };

  // Create ConnectionPlan
  const connectionPlan = new ConnectionPlan(nodeOneCore, undefined, COMM_SERVER_URL);

  // Register pairing success handler
  connectionsModel.pairing.onPairingSuccess(
    async (initiatedLocally, localPersonId, localInstanceId, remotePersonId, remoteInstanceId, token) => {
      console.log(`\n🎉 ${name} PAIRING SUCCESS!`);
      console.log(`   Initiated locally: ${initiatedLocally}`);
      console.log(`   Remote person: ${remotePersonId?.substring(0, 16)}...`);

      if (name === 'alice') alicePairingSuccess = true;
      if (name === 'bob') bobPairingSuccess = true;
    }
  );

  console.log(`✅ ${name} ready\n`);

  return { name, nodeOneCore, connectionPlan, leuteModel, connectionsModel, channelManager };
}

/**
 * Main test
 */
async function runTest() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🧪 ConnectionPlan Pairing Test');
  console.log('═══════════════════════════════════════════════════════');

  let alice = null;
  let bob = null;

  try {
    cleanStorage();
    await startCommServer();

    // Create Alice
    alice = await createInstance('alice', 'alice@test.local');

    // Create Bob
    bob = await createInstance('bob', 'bob@test.local');

    // Alice creates invitation
    console.log('\n📨 Alice creating invitation...');
    const inviteResult = await alice.connectionPlan.createPairingInvitation({ mode: 'IoP' });

    if (!inviteResult.success) {
      throw new Error(`Failed to create invitation: ${inviteResult.error}`);
    }

    console.log('✅ Invitation created');
    console.log(`   URL length: ${inviteResult.invitation.url.length}`);
    console.log(`   Mode: ${inviteResult.invitation.mode}`);

    // Bob accepts invitation
    console.log('\n📬 Bob accepting invitation...');
    const acceptResult = await bob.connectionPlan.acceptPairingInvitation({
      invitationUrl: inviteResult.invitation.url
    });

    if (!acceptResult.success) {
      throw new Error(`Failed to accept invitation: ${acceptResult.error}`);
    }

    console.log('✅ Bob accepted');

    // Wait for callbacks
    console.log('\n⏳ Waiting for pairing callbacks...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify
    console.log('\n📊 Results:');
    console.log(`   Alice callback: ${alicePairingSuccess ? '✅' : '❌'}`);
    console.log(`   Bob callback: ${bobPairingSuccess ? '✅' : '❌'}`);

    const aliceConns = alice.nodeOneCore.connectionsModel.connectionsInfo();
    const bobConns = bob.nodeOneCore.connectionsModel.connectionsInfo();

    console.log(`   Alice connections: ${aliceConns.length}`);
    console.log(`   Bob connections: ${bobConns.length}`);

    if (!alicePairingSuccess || !bobPairingSuccess) {
      throw new Error('Pairing callbacks did not fire');
    }

    if (aliceConns.length === 0 || bobConns.length === 0) {
      throw new Error('No connections established');
    }

    console.log('\n✅ ✅ ✅ TEST PASSED ✅ ✅ ✅\n');
    return true;

  } catch (error) {
    console.error('\n❌ ❌ ❌ TEST FAILED ❌ ❌ ❌');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    return false;

  } finally {
    // Cleanup
    console.log('\n🧹 Cleanup...');

    if (bob) {
      await bob.connectionsModel.shutdown();
      await bob.channelManager.shutdown();
      await bob.leuteModel.shutdown();
      await closeInstance();
    }

    if (alice) {
      await alice.connectionsModel.shutdown();
      await alice.channelManager.shutdown();
      await alice.leuteModel.shutdown();
      await closeInstance();
    }

    if (commServer) {
      await commServer.stop();
    }

    cleanStorage();
    console.log('✅ Done\n');
  }
}

runTest()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Fatal:', error);
    process.exit(1);
  });
