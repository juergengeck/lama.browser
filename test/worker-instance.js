#!/usr/bin/env node
/**
 * Worker script - runs a single ONE.core instance in its own process
 * Communicates with parent via stdio
 */

import '@refinio/one.core/lib/system/load-nodejs.js';
import { initInstance, getInstanceIdHash, getInstanceOwnerIdHash, closeInstance } from '@refinio/one.core/lib/instance.js';
import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { getAllEntries } from '@refinio/one.core/lib/reverse-map-query.js';
import { getObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js';
import ProfileModel from '@refinio/one.models/lib/models/Leute/ProfileModel.js';
import ConnectionsModel from '@refinio/one.models/lib/models/ConnectionsModel.js';
import RecipesStable from '@refinio/one.models/lib/recipes/recipes-stable.js';
import RecipesExperimental from '@refinio/one.models/lib/recipes/recipes-experimental.js';
import { ConnectionPlan } from '../connection.core/dist/esm/plans/ConnectionPlan.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';

// Parse command line args
const workerName = process.argv[2]; // "alice" or "bob"
const commServerPort = process.argv[3] || '8100';

if (!workerName) {
  console.error('Usage: worker-instance.js <name> [commServerPort]');
  process.exit(1);
}

// Message protocol: send/receive JSON over stdio
function send(type, data = {}) {
  console.log(JSON.stringify({ type, data, from: workerName }));
}

function sendError(error) {
  send('error', { message: error.message, stack: error.stack });
}

// State
let instance;
let connectionPlan;
let leuteModel;
let connectionsModel;

// Command handlers
const commands = {
  async init(params) {
    const baseDir = path.join(os.tmpdir(), `lama-test-${workerName}-${Date.now()}`);

    // Clean up any existing directory
    if (fs.existsSync(baseDir)) {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }

    // Initialize instance with custom directory
    instance = await initInstance({
      name: workerName,
      email: `${workerName}@test.local`,
      secret: `secret-${workerName}`,
      directory: baseDir,
      initialRecipes: [...RecipesStable, ...RecipesExperimental],
      wipeStorage: true
    });

    // Initialize models
    leuteModel = new LeuteModel(`ws://localhost:${commServerPort}`, true);
    await leuteModel.init();

    connectionsModel = new ConnectionsModel(leuteModel, {
      commServerUrl: `ws://localhost:${commServerPort}`,
      acceptIncomingConnections: true,
      acceptUnknownInstances: true,
      acceptUnknownPersons: false,
      allowPairing: true,
      establishOutgoingConnections: true
    });
    await connectionsModel.init();

    const instanceId = await getInstanceIdHash();
    const ownerId = await getInstanceOwnerIdHash();

    // Create nodeOneCore object (mimicking lama.cube NodeOneCore interface)
    const nodeOneCore = {
      initialized: true,
      ownerId,
      instanceId,
      connectionsModel,
      leuteModel,
      // Provide platform-specific access rights setup
      async setupPairingAccessRights(remotePersonId, localPersonId) {
        console.error(`[${workerName}]   Setting up access rights...`);

        // 1. Get remote person's Keys object
        const keys = await getAllEntries(remotePersonId, 'Keys');
        if (keys.length === 0) {
          throw new Error('No Keys found for remote person');
        }

        const key = await getObject(keys[0]);

        // 2. Create Profile with sign key
        const signKey = {
          $type$: 'SignKey',
          key: key.publicSignKey
        };

        const profile = await ProfileModel.constructWithNewProfile(
          remotePersonId,
          localPersonId,
          'default',
          [],
          [signKey]
        );

        if (profile.loadedVersion === undefined) {
          throw new Error('Profile model has no hash for profile with sign key');
        }

        // 3. Certify with TrustKeysCertificate to grant access rights
        await leuteModel.trust.certify('TrustKeysCertificate', {profile: profile.loadedVersion});
        await leuteModel.trust.refreshCaches();

        console.error(`[${workerName}]   ✅ Access rights configured - CHUM can now sync`);
      }
    };

    // Initialize ConnectionPlan with nodeOneCore and CommServer URL
    connectionPlan = new ConnectionPlan(
      nodeOneCore,
      undefined, // No storage provider needed
      `ws://localhost:${commServerPort}`
    );

    // Register onPairingSuccess handler to forward event to main process
    // Note: ConnectionPlan now automatically handles access rights setup!
    connectionsModel.pairing.onPairingSuccess(async (initiatedLocally, localPersonId, localInstanceId, remotePersonId, remoteInstanceId, token) => {
      console.error(`[${workerName}] 🎉 PAIRING SUCCESS!`);
      console.error(`[${workerName}]   Initiated locally: ${initiatedLocally}`);
      console.error(`[${workerName}]   Remote person: ${remotePersonId?.substring(0, 16)}...`);
      console.error(`[${workerName}]   ✅ Access rights configured automatically by ConnectionPlan`);

      send('pairing-success', {
        initiatedLocally,
        localPersonId,
        localInstanceId,
        remotePersonId,
        remoteInstanceId
      });
    });

    // Register onConnectionsChange handler to track when CHUM connection establishes
    connectionsModel.onConnectionsChange(() => {
      const connections = connectionsModel.connectionsInfo();
      console.error(`[${workerName}] 🔄 Connections changed: ${connections.length} connection(s)`);
      send('connections-changed', { count: connections.length });
    });

    send('ready', {
      baseDir,
      instanceId,
      ownerId
    });
  },

  async createInvite(params) {
    const result = await connectionPlan.createPairingInvitation({ mode: 'IoP' });
    send('invite-created', {
      success: result.success,
      inviteCode: result.invitation?.token,
      url: result.invitation?.url
    });
  },

  async acceptInvite(params) {
    const { invitationUrl } = params;
    const result = await connectionPlan.acceptPairingInvitation({ invitationUrl });
    send('invite-accepted', result);
  },

  async getConnections(params) {
    const connections = connectionsModel.connectionsInfo();
    console.error(`[${workerName}] connectionsInfo():`, JSON.stringify(connections, null, 2));
    send('connections', { connections });
  },

  async cleanup(params) {
    if (instance) {
      await closeInstance(instance);
    }
    send('cleaned-up', {});
    process.exit(0);
  }
};

// Set up readline interface to receive commands
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  try {
    const message = JSON.parse(line);
    const { command, params = {} } = message;

    if (!commands[command]) {
      throw new Error(`Unknown command: ${command}`);
    }

    await commands[command](params);
  } catch (error) {
    sendError(error);
  }
});

// Handle process termination
process.on('SIGTERM', async () => {
  if (instance) {
    await closeInstance(instance);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  if (instance) {
    await closeInstance(instance);
  }
  process.exit(0);
});

// Signal ready to receive commands
send('worker-ready', { name: workerName });
