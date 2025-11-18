#!/usr/bin/env node
/**
 * Peer Worker Process
 *
 * Runs a single ONE.core peer instance for testing.
 * Each peer runs in its own dedicated process with its own storage folder.
 */

import fs from 'fs';
import http from 'http';
import { WebSocket } from 'ws';

// Polyfill WebSocket
global.WebSocket = WebSocket;

// Configuration from environment
const PEER_EMAIL = process.env.PEER_EMAIL;
const PEER_PORT = parseInt(process.env.PEER_PORT);
const COMM_SERVER_URL = process.env.COMM_SERVER_URL;
const STORAGE_DIR = process.env.STORAGE_DIR;

if (!PEER_EMAIL || !PEER_PORT || !COMM_SERVER_URL || !STORAGE_DIR) {
  console.error('ERROR: Missing required environment variables');
  console.error('Required: PEER_EMAIL, PEER_PORT, COMM_SERVER_URL, STORAGE_DIR');
  process.exit(1);
}

let oneInstance = null;
let server = null;

/**
 * Initialize ONE.core instance
 */
async function initializeInstance() {
  console.log(`[${PEER_EMAIL}] Initializing peer worker...`);

  // Ensure storage directory exists
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  // Import ONE.core
  await import('@refinio/one.core/lib/system/load-nodejs.js');
  const { initInstance } = await import('@refinio/one.core/lib/instance.js');
  const { default: One } = await import('@refinio/one.models/lib/api/One.js');
  const { createRandomString } = await import('@refinio/one.core/lib/system/crypto-helpers.js');

  // Import recipes
  const { default: RecipesStable } = await import('@refinio/one.models/lib/recipes/recipes-stable.js');
  const { default: RecipesExperimental } = await import('@refinio/one.models/lib/recipes/recipes-experimental.js');
  const { default: LeuteRecipes } = await import('@refinio/one.models/lib/recipes/Leute/recipes.js');
  const { default: CertificateRecipes } = await import('@refinio/one.models/lib/recipes/Certificates/CertificateRecipes.js');
  const { default: SignatureRecipes } = await import('@refinio/one.models/lib/recipes/SignatureRecipes.js');
  const { ReverseMapsExperimental } = await import('@refinio/one.models/lib/recipes/reversemaps-experimental.js');

  // Initialize instance with reverse maps enabled
  const secret = await createRandomString(32);
  await initInstance({
    name: PEER_EMAIL,
    email: `${PEER_EMAIL}@test.local`,
    secret,
    directory: STORAGE_DIR,
    encryptStorage: false,
    initialRecipes: [
      ...RecipesStable,
      ...RecipesExperimental,
      ...LeuteRecipes,
      ...CertificateRecipes,
      ...SignatureRecipes
    ],
    initiallyEnabledReverseMapTypes: new Map(ReverseMapsExperimental)
  });

  // Create object filter for Group certificate validation
  const objectFilter = async (hash, type) => {
    if (type === 'Group') {
      try {
        const models = oneInstance.getModels();
        const leuteModel = models.getLeuteModel();
        const trust = leuteModel.trust;

        const knownPeople = await leuteModel.others();
        const myId = await leuteModel.myMainIdentity();
        const trustedPeople = [myId, ...knownPeople];

        const affirmedBy = await trust.affirmedBy(hash);
        if (affirmedBy.length === 0) {
          return false;
        }

        for (const affirmerId of affirmedBy) {
          if (trustedPeople.includes(affirmerId)) {
            const isAffirmed = await trust.isAffirmedBy(hash, affirmerId);
            if (isAffirmed) {
              return true;
            }
          }
        }

        return false;
      } catch (error) {
        console.error(`[${PEER_EMAIL}] Error validating Group certificate:`, error);
        return false;
      }
    }
    return true;
  };

  // Create One API instance
  oneInstance = new One({
    commServerUrl: COMM_SERVER_URL,
    externalModels: {},
    connectionsModelConfig: {
      commServerUrl: COMM_SERVER_URL,
      objectFilter,
      importFilter: undefined
    }
  });

  await oneInstance.init();

  // Setup pairing callback for trust establishment
  const models = oneInstance.getModels();
  const connections = models.getConnectionsModel();
  const trustModel = models.getLeuteModel().trust;

  connections.pairing.onPairingSuccess((initiatedLocally, localPersonId, localInstanceId, remotePersonId, remoteInstanceId, token) => {
    console.log(`[${PEER_EMAIL}] Pairing success with ${String(remotePersonId).substring(0, 8)}...`);
    trustModel.trustPairingKeys(remotePersonId).catch(error => {
      console.error(`[${PEER_EMAIL}] Failed to establish trust:`, error);
    });
  });

  const leuteModel = models.getLeuteModel();
  const personId = await leuteModel.myMainIdentity();
  const instanceId = await leuteModel.me();

  console.log(`[${PEER_EMAIL}] Initialized - PersonID: ${personId.substring(0, 8)}...`);

  return { personId, instanceId };
}

/**
 * HTTP API for controlling this peer
 */
function createHttpServer(personId, instanceId) {
  server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    try {
      if (req.method === 'GET' && req.url === '/info') {
        // Get peer info
        res.writeHead(200);
        res.end(JSON.stringify({
          email: PEER_EMAIL,
          personId,
          instanceId
        }));

      } else if (req.method === 'GET' && req.url === '/create-invitation') {
        // Create connection invitation
        const models = oneInstance.getModels();
        const connections = models.getConnectionsModel();
        const invitation = await connections.pairing.createInvitation();

        res.writeHead(200);
        res.end(JSON.stringify({ invitation }));

      } else if (req.method === 'POST' && req.url === '/connect-using-invitation') {
        // Accept connection invitation
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          const { invitation } = JSON.parse(body);
          const models = oneInstance.getModels();
          const connections = models.getConnectionsModel();
          await connections.pairing.connectUsingInvitation(invitation);

          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        });

      } else if (req.method === 'GET' && req.url === '/contacts') {
        // Get list of contacts
        const models = oneInstance.getModels();
        const leuteModel = models.getLeuteModel();
        const others = await leuteModel.others();

        res.writeHead(200);
        res.end(JSON.stringify({ contacts: others }));

      } else if (req.method === 'POST' && req.url === '/create-group') {
        // Create group with members
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          const { groupName, memberPersonIds } = JSON.parse(body);
          const models = oneInstance.getModels();
          const leuteModel = models.getLeuteModel();

          const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
          const { storeUnversionedObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
          const { calculateIdHashOfObj } = await import('@refinio/one.core/lib/util/object.js');

          // First create HashGroup (unversioned)
          const hashGroup = {
            $type$: 'HashGroup',
            person: memberPersonIds
          };
          const hashGroupResult = await storeUnversionedObject(hashGroup);
          const hashGroupHash = hashGroupResult.hash;

          // Now create Group object with reference to HashGroup
          // Note: Group only has name and hashGroup reference - members are in HashGroup
          const group = {
            $type$: 'Group',
            name: groupName,
            hashGroup: hashGroupHash
          };

          const result = await storeVersionedObject(group);
          const groupIdHash = await calculateIdHashOfObj(group);

          res.writeHead(200);
          res.end(JSON.stringify({
            hashGroupHash: hashGroupHash,
            groupHash: result.hash,
            groupIdHash: groupIdHash
          }));
        });

      } else if (req.method === 'POST' && req.url === '/create-group-certificate') {
        // Create attestation certificate for group
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          const { groupIdHash } = JSON.parse(body);
          const models = oneInstance.getModels();
          const leuteModel = models.getLeuteModel();
          const trust = leuteModel.trust;

          // Create affirmation certificate using TrustedKeysManager.certify()
          // This creates an AffirmationCertificate that attests to the Group
          // certify() returns {license, certificate, signature} with .hash properties
          const certResult = await trust.certify('AffirmationCertificate', {
            data: groupIdHash
          });

          console.log(`[${PEER_EMAIL}] Created AffirmationCertificate cert=${certResult.certificate.hash.substring(0, 8)}, sig=${certResult.signature.hash.substring(0, 8)}, lic=${certResult.license.hash.substring(0, 8)} for Group ${groupIdHash.substring(0, 8)}`);

          res.writeHead(200);
          res.end(JSON.stringify({
            certificateHash: certResult.certificate.hash,
            signatureHash: certResult.signature.hash,
            licenseHash: certResult.license.hash
          }));
        });

      } else if (req.method === 'POST' && req.url === '/grant-group-access') {
        // Grant access to group and certificate for specified persons
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          const { groupIdHash, hashGroupHash, certificateHash, personIds } = JSON.parse(body);
          const { grantReadAccess } = await import('@refinio/one.core/lib/access-control/access-control-api.js');

          // Grant access to HashGroup (unversioned object)
          for (const personId of personIds) {
            await grantReadAccess(hashGroupHash, personId);
          }

          // Grant access to Group
          for (const personId of personIds) {
            await grantReadAccess(groupIdHash, personId);
          }

          // Grant access to certificate
          for (const personId of personIds) {
            await grantReadAccess(certificateHash, personId);
          }

          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        });

      } else if (req.method === 'POST' && req.url === '/has-group') {
        // Check if group object is available
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          const { groupIdHash } = JSON.parse(body);
          const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');

          try {
            const group = await getObjectByIdHash(groupIdHash);
            res.writeHead(200);
            res.end(JSON.stringify({
              hasGroup: !!group,
              group: group || null
            }));
          } catch (error) {
            res.writeHead(200);
            res.end(JSON.stringify({
              hasGroup: false,
              group: null
            }));
          }
        });

      } else if (req.method === 'POST' && req.url === '/shutdown') {
        // Shutdown this peer
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));

        console.log(`[${PEER_EMAIL}] Shutdown requested`);
        setTimeout(() => process.exit(0), 100);

      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
      }

    } catch (error) {
      console.error(`[${PEER_EMAIL}] HTTP request error:`, error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  });

  server.listen(PEER_PORT, () => {
    console.log(`[${PEER_EMAIL}] HTTP API listening on port ${PEER_PORT}`);
  });
}

/**
 * Main
 */
async function main() {
  try {
    const { personId, instanceId } = await initializeInstance();
    createHttpServer(personId, instanceId);
    console.log(`[${PEER_EMAIL}] Ready`);

  } catch (error) {
    console.error(`[${PEER_EMAIL}] Initialization failed:`, error);
    process.exit(1);
  }
}

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log(`[${PEER_EMAIL}] Shutting down...`);
  if (oneInstance) {
    await oneInstance.shutdown();
  }
  if (server) {
    server.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(`[${PEER_EMAIL}] Shutting down...`);
  if (oneInstance) {
    await oneInstance.shutdown();
  }
  if (server) {
    server.close();
  }
  process.exit(0);
});

main();
