#!/usr/bin/env node
/**
 * lama.code Server - Standalone code assistant server with ONE.core integration
 *
 * Runs a single ONE.core instance with code.core handlers.
 * Provides P2P access to code operations from mobile/browser via pairing.
 *
 * Usage: WORKSPACE=/path/to/code node server.js
 */

import '@refinio/one.core/lib/system/load-nodejs.js';
import { initInstance, getInstanceIdHash, closeInstance, getInstanceOwnerIdHash } from '@refinio/one.core/lib/instance.js';
import ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js';
import ConnectionsModel from '@refinio/one.models/lib/models/ConnectionsModel.js';
import RecipesStable from '@refinio/one.models/lib/recipes/recipes-stable.js';
import RecipesExperimental from '@refinio/one.models/lib/recipes/recipes-experimental.js';
import http from 'http';
import * as path from 'path';

import { NodeFileSystemAdapter } from './adapters/NodeFileSystemAdapter.js';
import { NodeCommandExecutor } from './adapters/NodeCommandExecutor.js';

// Configuration from environment
const config = {
    instanceName: process.env.INSTANCE_NAME || 'lama-code',
    instanceEmail: process.env.INSTANCE_EMAIL || 'code@lama.local',
    storageDir: process.env.STORAGE_DIR || './.lama-code-storage',
    commServerUrl: process.env.COMM_SERVER_URL || 'wss://comm.lama.one',
    workspaceRoot: process.env.WORKSPACE || process.cwd(),
    wipeStorage: process.env.WIPE_STORAGE === 'true',
    httpPort: parseInt(process.env.HTTP_PORT || '3001', 10)
};

let leuteModel: any = null;
let channelManager: any = null;
let connectionsModel: any = null;
let codeAssistant: any = null;
let httpServer: any = null;

/**
 * Start HTTP API server for local control
 */
async function startHttpApi() {
    return new Promise((resolve, reject) => {
        httpServer = http.createServer(async (req, res) => {
            // Set CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.setHeader('Content-Type', 'application/json');

            // Handle OPTIONS for CORS preflight
            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            try {
                const url = new URL(req.url!, `http://localhost`);
                const path = url.pathname;

                console.log(`[${config.instanceName}] HTTP ${req.method} ${path}`);

                // GET /identity - Get instance identity info
                if (path === '/identity' && req.method === 'GET') {
                    const me = leuteModel.me;
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        personId: me.personId,
                        name: config.instanceName,
                        email: config.instanceEmail,
                        workspaceRoot: config.workspaceRoot
                    }));
                    return;
                }

                // POST /connect - Create invitation or accept invitation
                if (path === '/connect' && req.method === 'POST') {
                    let body = '';
                    for await (const chunk of req) {
                        body += chunk;
                    }
                    const data = body ? JSON.parse(body) : {};

                    if (data.invitation) {
                        // Connect using invitation (initiates pairing)
                        console.log(`[${config.instanceName}] Connecting via invitation...`);
                        const result = await connectionsModel.pairing.connectUsingInvitation(data.invitation);
                        console.log(`[${config.instanceName}] Pairing complete:`, !!result);
                        res.writeHead(200);
                        res.end(JSON.stringify({ success: !!result }));
                    } else {
                        // Create an invitation
                        console.log(`[${config.instanceName}] Creating invitation...`);
                        const invitation = await connectionsModel.pairing.createInvitation();
                        console.log(`[${config.instanceName}] Invitation created`);
                        res.writeHead(200);
                        res.end(JSON.stringify({ success: true, invitation }));
                    }
                    return;
                }

                // GET /connections - List connections
                if (path === '/connections' && req.method === 'GET') {
                    const others = await leuteModel.others();
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        connections: others.map((p: any) => ({
                            personId: p.personId,
                            name: p.name || 'Unknown'
                        }))
                    }));
                    return;
                }

                // GET /tools - List available tools
                if (path === '/tools' && req.method === 'GET') {
                    const tools = codeAssistant.getTools();
                    res.writeHead(200);
                    res.end(JSON.stringify({ tools }));
                    return;
                }

                // POST /tools/:toolName - Execute tool
                if (path.startsWith('/tools/') && req.method === 'POST') {
                    const toolName = path.split('/')[2];

                    let body = '';
                    for await (const chunk of req) {
                        body += chunk;
                    }
                    const data = JSON.parse(body);

                    console.log(`[${config.instanceName}] Executing tool: ${toolName}`);

                    const result = await codeAssistant.executeTool({
                        name: toolName,
                        arguments: data.arguments || {}
                    });

                    res.writeHead(200);
                    res.end(JSON.stringify(result));
                    return;
                }

                // GET /workspace/info - Get workspace info
                if (path === '/workspace/info' && req.method === 'GET') {
                    const workspaceInfo = {
                        workspaceRoot: codeAssistant.getWorkspaceRoot(),
                        stats: codeAssistant.getWorkspaceStats()
                    };
                    res.writeHead(200);
                    res.end(JSON.stringify(workspaceInfo));
                    return;
                }

                // 404
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Not found' }));
            } catch (error) {
                console.error(`[${config.instanceName}] HTTP API error:`, error);
                res.writeHead(500);
                res.end(JSON.stringify({
                    error: error instanceof Error ? error.message : String(error)
                }));
            }
        });

        httpServer.listen(config.httpPort, () => {
            console.log(`[${config.instanceName}] HTTP API: http://localhost:${config.httpPort}`);
            resolve(undefined);
        });

        httpServer.on('error', reject);
    });
}

async function startServer() {
    try {
        console.log(`[${config.instanceName}] Starting lama.code server...`);
        console.log(`[${config.instanceName}]   Email: ${config.instanceEmail}`);
        console.log(`[${config.instanceName}]   Storage: ${config.storageDir}`);
        console.log(`[${config.instanceName}]   CommServer: ${config.commServerUrl}`);
        console.log(`[${config.instanceName}]   Workspace: ${config.workspaceRoot}`);

        // Initialize ONE.core with recipes
        await initInstance({
            name: config.instanceName,
            email: config.instanceEmail,
            secret: 'lama-code-secret',
            wipeStorage: config.wipeStorage,
            directory: config.storageDir,
            initialRecipes: [...RecipesStable, ...RecipesExperimental]
        });

        const instanceId = getInstanceIdHash();
        console.log(`[${config.instanceName}] ✅ ONE.core initialized: ${instanceId}`);

        // Initialize LeuteModel
        const LeuteModel = (await import('@refinio/one.models/lib/models/Leute/LeuteModel.js')).default;
        leuteModel = new LeuteModel();
        await leuteModel.init();
        console.log(`[${config.instanceName}] ✅ LeuteModel initialized`);

        // Create ChannelManager
        channelManager = new ChannelManager();
        await channelManager.init();
        console.log(`[${config.instanceName}] ✅ ChannelManager initialized`);

        // Initialize ConnectionsModel
        connectionsModel = new ConnectionsModel(leuteModel, {
            commServerUrl: config.commServerUrl,
            acceptIncomingConnections: true,
            acceptUnknownInstances: true,       // Accept new instances via pairing
            acceptUnknownPersons: false,        // Require pairing for new persons
            allowPairing: true,                 // Enable pairing protocol
            establishOutgoingConnections: true,
            allowDebugRequests: true,
            pairingTokenExpirationDuration: 60000 * 15  // 15 minutes
        });

        await connectionsModel.init(null);
        console.log(`[${config.instanceName}] ✅ ConnectionsModel initialized`);

        // Get owner ID
        const ownerIdHash = getInstanceOwnerIdHash();

        // Create nodeOneCore-like object (for future integration with lama.core)
        const nodeOneCore = {
            initialized: true,
            channelManager: channelManager,
            leuteModel: leuteModel,
            ownerId: ownerIdHash
        };

        // Initialize code.core handlers
        const { CodeAssistantHandler } = await import('@code/core/handlers/CodeAssistantHandler.js');

        const fsAdapter = new NodeFileSystemAdapter();
        await fsAdapter.setWorkspaceRoot(config.workspaceRoot);

        const commandExecutor = new NodeCommandExecutor();

        const securityPolicy = {
            allowedCommands: ['npm', 'yarn', 'pnpm', 'git', 'node', 'tsc', 'eslint', 'prettier', 'jest', 'mocha'],
            allowedPaths: [config.workspaceRoot],
            maxExecutionTime: 120000, // 2 minutes
            allowNetwork: false,
            allowFileWrite: true,
            allowFileDelete: true,
            allowCommandExecution: true
        };

        codeAssistant = new CodeAssistantHandler(
            fsAdapter,
            commandExecutor,
            config.workspaceRoot,
            securityPolicy
        );

        await codeAssistant.init((progress: any) => {
            console.log(`[${config.instanceName}] Indexing: ${progress.message}`);
        });

        console.log(`[${config.instanceName}] ✅ code.core initialized`);

        // Start HTTP API server
        await startHttpApi();

        console.log(`[${config.instanceName}] 🚀 lama.code server ready!`);
        console.log(`[${config.instanceName}] READY`);

        // Keep process alive
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

    } catch (error) {
        console.error(`[${config.instanceName}] ❌ Failed to start:`, error);
        process.exit(1);
    }
}

async function shutdown() {
    console.log(`[${config.instanceName}] Shutting down...`);

    if (httpServer) {
        httpServer.close();
    }

    if (connectionsModel) {
        await connectionsModel.shutdown();
    }

    if (leuteModel) {
        await leuteModel.shutdown();
    }

    if (channelManager) {
        await channelManager.shutdown();
    }

    closeInstance();
    console.log(`[${config.instanceName}] ✅ Shutdown complete`);
    process.exit(0);
}

startServer().catch(error => {
    console.error(`[${config.instanceName}] Fatal error:`, error);
    process.exit(1);
});
