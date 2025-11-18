/**
 * lama.code Integration Test
 *
 * Tests that lama.code server starts correctly and can execute tools.
 *
 * Flow:
 * 1. Start lama.code server with test workspace
 * 2. Verify server identity
 * 3. Execute file tools (read, write, edit)
 * 4. Execute search tools
 * 5. Cleanup
 */

import { spawn } from 'child_process';
import * as chai from 'chai';
const { expect } = chai;
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SERVER_STARTUP_TIMEOUT = 30000;
const TEST_WORKSPACE = path.join(__dirname, '../../test-workspace');
const STORAGE_DIR = path.join(__dirname, '../../test-storage');

// Process handle
let serverProcess = null;
let serverPort = null;

/**
 * Make HTTP request to server API
 */
async function apiRequest(path, method = 'GET', body = null) {
    const options = {
        hostname: 'localhost',
        port: serverPort,
        path,
        method,
        headers: { 'Content-Type': 'application/json' }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${data}`));
                }
            });
        });

        req.on('error', reject);
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

/**
 * Wait for server to be ready
 */
function waitForServerReady(process, timeout = SERVER_STARTUP_TIMEOUT) {
    return new Promise((resolve, reject) => {
        let output = '';
        const timeoutHandle = setTimeout(() => {
            reject(new Error('Server startup timeout'));
        }, timeout);

        const onData = (data) => {
            output += data.toString();
            process.stdout.write(data);

            // Extract port from output
            const portMatch = output.match(/HTTP API: http:\/\/localhost:(\d+)/);
            if (portMatch) {
                serverPort = parseInt(portMatch[1], 10);
            }

            // Check if ready
            if (output.includes('READY')) {
                clearTimeout(timeoutHandle);
                process.stdout.removeListener('data', onData);
                resolve();
            }
        };

        process.stdout.on('data', onData);

        process.stderr.on('data', (data) => {
            process.stderr.write(data);
        });

        process.on('error', (err) => {
            clearTimeout(timeoutHandle);
            reject(err);
        });

        process.on('exit', (code) => {
            if (code !== 0) {
                clearTimeout(timeoutHandle);
                reject(new Error(`Server exited with code ${code}`));
            }
        });
    });
}

/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create test workspace with sample files
 */
function createTestWorkspace() {
    // Create workspace directory
    if (fs.existsSync(TEST_WORKSPACE)) {
        fs.rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_WORKSPACE, { recursive: true });

    // Create sample files
    fs.writeFileSync(
        path.join(TEST_WORKSPACE, 'index.ts'),
        `// Sample TypeScript file
export function authenticate(username: string, password: string): boolean {
    return username === 'admin' && password === 'secret';
}

export function logout(): void {
    console.log('User logged out');
}
`
    );

    fs.writeFileSync(
        path.join(TEST_WORKSPACE, 'package.json'),
        JSON.stringify({
            name: 'test-app',
            version: '1.0.0',
            description: 'Test application'
        }, null, 2)
    );

    // Create src directory
    fs.mkdirSync(path.join(TEST_WORKSPACE, 'src'), { recursive: true });

    fs.writeFileSync(
        path.join(TEST_WORKSPACE, 'src', 'utils.ts'),
        `export function formatDate(date: Date): string {
    return date.toISOString();
}
`
    );
}

describe('lama.code Server Integration', function() {
    this.timeout(60000); // 60 second timeout

    before(async function() {
        console.log('\n🚀 Starting lama.code Integration Test\n');

        // Create test workspace
        createTestWorkspace();
        console.log('✅ Test workspace created');

        // Build server
        console.log('Building server...');
        const buildProcess = spawn('npm', ['run', 'build'], {
            cwd: path.join(__dirname, '../..'),
            stdio: 'inherit'
        });

        await new Promise((resolve, reject) => {
            buildProcess.on('exit', (code) => {
                if (code === 0) {
                    console.log('✅ Server built');
                    resolve();
                } else {
                    reject(new Error(`Build failed with code ${code}`));
                }
            });
            buildProcess.on('error', reject);
        });

        // Start server
        console.log('Starting server...');
        const serverPath = path.join(__dirname, '../../src/server.js');

        serverProcess = spawn('node', [serverPath], {
            env: {
                ...process.env,
                WORKSPACE: TEST_WORKSPACE,
                STORAGE_DIR: STORAGE_DIR,
                COMM_SERVER_URL: 'ws://localhost:8000', // Use local comm server (not running, but OK for this test)
                HTTP_PORT: '0', // Random port
                WIPE_STORAGE: 'true'
            },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        await waitForServerReady(serverProcess);
        console.log(`✅ Server started on port ${serverPort}`);
    });

    after(async function() {
        console.log('\n🧹 Cleaning up...');

        // Kill server
        if (serverProcess) {
            serverProcess.kill('SIGTERM');
            await sleep(2000);
            if (!serverProcess.killed) {
                serverProcess.kill('SIGKILL');
            }
            console.log('✅ Server stopped');
        }

        // Clean up workspace
        if (fs.existsSync(TEST_WORKSPACE)) {
            fs.rmSync(TEST_WORKSPACE, { recursive: true, force: true });
            console.log('✅ Test workspace cleaned');
        }

        // Clean up storage
        if (fs.existsSync(STORAGE_DIR)) {
            fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
            console.log('✅ Test storage cleaned');
        }
    });

    it('should return server identity', async function() {
        const identity = await apiRequest('/identity', 'GET');

        expect(identity).to.have.property('personId');
        expect(identity).to.have.property('name');
        expect(identity).to.have.property('email');
        expect(identity).to.have.property('workspaceRoot');
        expect(identity.workspaceRoot).to.equal(TEST_WORKSPACE);

        console.log(`✅ Server identity: ${identity.name}`);
    });

    it('should list available tools', async function() {
        const result = await apiRequest('/tools', 'GET');

        expect(result).to.have.property('tools');
        expect(result.tools).to.be.an('array');
        expect(result.tools.length).to.be.at.least(20); // Should have 26 tools

        // Check for key tools
        const toolNames = result.tools.map(t => t.name);
        expect(toolNames).to.include('read_file');
        expect(toolNames).to.include('write_file');
        expect(toolNames).to.include('search_code');

        console.log(`✅ Found ${result.tools.length} tools`);
    });

    it('should read existing file', async function() {
        const result = await apiRequest('/tools/read_file', 'POST', {
            arguments: { path: 'index.ts' }
        });

        expect(result.success).to.be.true;
        expect(result.data).to.have.property('content');
        expect(result.data.content).to.include('authenticate');

        console.log('✅ Read file successfully');
    });

    it('should write new file', async function() {
        const result = await apiRequest('/tools/write_file', 'POST', {
            arguments: {
                path: 'test.ts',
                content: 'export const TEST = "hello";'
            }
        });

        expect(result.success).to.be.true;

        // Verify file was created
        const readResult = await apiRequest('/tools/read_file', 'POST', {
            arguments: { path: 'test.ts' }
        });

        expect(readResult.success).to.be.true;
        expect(readResult.data.content).to.include('TEST');

        console.log('✅ Write file successfully');
    });

    it('should edit existing file', async function() {
        const result = await apiRequest('/tools/edit_file', 'POST', {
            arguments: {
                path: 'test.ts',
                oldString: 'hello',
                newString: 'world'
            }
        });

        expect(result.success).to.be.true;

        // Verify edit was applied
        const readResult = await apiRequest('/tools/read_file', 'POST', {
            arguments: { path: 'test.ts' }
        });

        expect(readResult.data.content).to.include('world');
        expect(readResult.data.content).to.not.include('hello');

        console.log('✅ Edit file successfully');
    });

    it('should search code', async function() {
        const result = await apiRequest('/tools/search_code', 'POST', {
            arguments: {
                pattern: 'authenticate',
                fileGlob: '**/*.ts'
            }
        });

        expect(result.success).to.be.true;
        expect(result.data).to.have.property('results');
        expect(result.data.results).to.be.an('array');
        expect(result.data.results.length).to.be.at.least(1);

        const firstResult = result.data.results[0];
        expect(firstResult).to.have.property('file');
        expect(firstResult).to.have.property('matches');

        console.log(`✅ Found ${result.data.results.length} search results`);
    });

    it('should list files', async function() {
        const result = await apiRequest('/tools/list_files', 'POST', {
            arguments: {
                glob: '**/*.ts'
            }
        });

        expect(result.success).to.be.true;
        expect(result.data).to.have.property('files');
        expect(result.data.files).to.be.an('array');
        expect(result.data.files.length).to.be.at.least(2); // index.ts, test.ts, src/utils.ts

        console.log(`✅ Found ${result.data.files.length} files`);
    });

    it('should get workspace info', async function() {
        const result = await apiRequest('/workspace/info', 'GET');

        expect(result).to.have.property('workspaceRoot');
        expect(result).to.have.property('fileCount');
        expect(result.workspaceRoot).to.equal(TEST_WORKSPACE);

        console.log(`✅ Workspace has ${result.fileCount} indexed files`);
    });

    it('should handle tool errors gracefully', async function() {
        // Try to read non-existent file
        const result = await apiRequest('/tools/read_file', 'POST', {
            arguments: { path: 'nonexistent.ts' }
        });

        expect(result.success).to.be.false;
        expect(result).to.have.property('error');

        console.log('✅ Tool error handled gracefully');
    });
});
