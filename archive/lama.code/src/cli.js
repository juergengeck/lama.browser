#!/usr/bin/env node
/**
 * lama.code CLI - Command-line interface for lama.code server
 *
 * Commands:
 *   lama-code start --workspace <path>    Start server
 *   lama-code stop                        Stop server
 *   lama-code status                      Check server status
 *   lama-code pair                        Generate pairing invitation
 *   lama-code exec <tool> [args]          Execute tool directly
 */
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
const CONFIG_DIR = path.join(process.env.HOME || '/tmp', '.lama-code');
const PID_FILE = path.join(CONFIG_DIR, 'server.pid');
const PORT_FILE = path.join(CONFIG_DIR, 'server.port');
// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
}
/**
 * Make HTTP request to server
 */
async function httpRequest(method, path, data) {
    const port = getServerPort();
    if (!port) {
        console.error('Server not running');
        process.exit(1);
    }
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port,
            path,
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                }
                catch {
                    resolve(body);
                }
            });
        });
        req.on('error', reject);
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}
/**
 * Get server PID if running
 */
function getServerPid() {
    try {
        const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
        // Check if process is actually running
        try {
            process.kill(pid, 0); // Signal 0 = check existence
            return pid;
        }
        catch {
            // Process not running, clean up stale PID file
            fs.unlinkSync(PID_FILE);
            return null;
        }
    }
    catch {
        return null;
    }
}
/**
 * Get server port if running
 */
function getServerPort() {
    try {
        return parseInt(fs.readFileSync(PORT_FILE, 'utf-8').trim(), 10);
    }
    catch {
        return null;
    }
}
/**
 * Start server
 */
function startServer(workspace) {
    const pid = getServerPid();
    if (pid) {
        console.log(`Server already running (PID: ${pid})`);
        process.exit(1);
    }
    const workspaceRoot = workspace || process.cwd();
    console.log('Starting lama.code server...');
    console.log(`Workspace: ${workspaceRoot}`);
    const serverPath = path.join(__dirname, 'server.js');
    const env = {
        ...process.env,
        WORKSPACE: workspaceRoot,
        HTTP_PORT: '3001'
    };
    const child = spawn('node', [serverPath], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env
    });
    // Save PID
    fs.writeFileSync(PID_FILE, child.pid.toString());
    // Wait for server to start
    let output = '';
    child.stdout.on('data', (data) => {
        output += data.toString();
        process.stdout.write(data);
        // Check if server is ready
        if (output.includes('READY')) {
            // Save port
            const portMatch = output.match(/HTTP API: http:\/\/localhost:(\d+)/);
            if (portMatch) {
                fs.writeFileSync(PORT_FILE, portMatch[1]);
            }
            console.log('✅ Server started successfully');
            console.log(`PID: ${child.pid}`);
            child.unref();
            process.exit(0);
        }
    });
    child.stderr.on('data', (data) => {
        process.stderr.write(data);
    });
    child.on('error', (err) => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
    child.on('exit', (code) => {
        if (code !== 0) {
            console.error(`Server exited with code ${code}`);
            process.exit(1);
        }
    });
    // Timeout after 30 seconds
    setTimeout(() => {
        console.error('Server failed to start (timeout)');
        child.kill();
        process.exit(1);
    }, 30000);
}
/**
 * Stop server
 */
function stopServer() {
    const pid = getServerPid();
    if (!pid) {
        console.log('Server not running');
        process.exit(0);
    }
    console.log(`Stopping server (PID: ${pid})...`);
    try {
        process.kill(pid, 'SIGTERM');
        // Wait for graceful shutdown
        let attempts = 0;
        const checkInterval = setInterval(() => {
            try {
                process.kill(pid, 0);
                attempts++;
                if (attempts > 10) {
                    // Force kill after 5 seconds
                    console.log('Force killing server...');
                    process.kill(pid, 'SIGKILL');
                    clearInterval(checkInterval);
                    cleanup();
                }
            }
            catch {
                // Process stopped
                clearInterval(checkInterval);
                cleanup();
            }
        }, 500);
    }
    catch (err) {
        console.error('Failed to stop server:', err);
        process.exit(1);
    }
    function cleanup() {
        try {
            fs.unlinkSync(PID_FILE);
        }
        catch { }
        try {
            fs.unlinkSync(PORT_FILE);
        }
        catch { }
        console.log('✅ Server stopped');
        process.exit(0);
    }
}
/**
 * Check server status
 */
async function checkStatus() {
    const pid = getServerPid();
    const port = getServerPort();
    if (!pid) {
        console.log('Status: Not running');
        process.exit(0);
    }
    console.log('Status: Running');
    console.log(`PID: ${pid}`);
    console.log(`Port: ${port}`);
    try {
        const identity = await httpRequest('GET', '/identity');
        console.log(`Instance: ${identity.name}`);
        console.log(`Workspace: ${identity.workspaceRoot}`);
        const connections = await httpRequest('GET', '/connections');
        console.log(`Connections: ${connections.connections.length}`);
    }
    catch (err) {
        console.error('Failed to get server info:', err);
    }
}
/**
 * Generate pairing invitation
 */
async function generatePairingInvitation() {
    try {
        const result = await httpRequest('POST', '/connect', {});
        console.log('Pairing invitation:');
        console.log(result.invitation);
        console.log('\nShare this invitation code with the device you want to pair.');
        console.log('The invitation expires in 15 minutes.');
    }
    catch (err) {
        console.error('Failed to generate invitation:', err);
        process.exit(1);
    }
}
/**
 * Execute tool
 */
async function executeTool(toolName, args) {
    try {
        const result = await httpRequest('POST', `/tools/${toolName}`, { arguments: args });
        if (result.success) {
            console.log(JSON.stringify(result.data, null, 2));
        }
        else {
            console.error('Tool execution failed:', result.error);
            process.exit(1);
        }
    }
    catch (err) {
        console.error('Failed to execute tool:', err);
        process.exit(1);
    }
}
/**
 * Main CLI entry point
 */
function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    if (!command || command === 'help') {
        console.log(`
lama.code - AI coding assistant server

Commands:
  start [--workspace <path>]    Start server (default: current directory)
  stop                          Stop server
  status                        Check server status
  pair                          Generate pairing invitation
  exec <tool> [--arg=value]     Execute tool directly

Examples:
  lama-code start --workspace ~/projects/myapp
  lama-code pair
  lama-code exec search_code --pattern="authenticate" --glob="**/*.ts"
  lama-code exec read_file --path="src/index.ts"
  lama-code stop
        `);
        process.exit(0);
    }
    switch (command) {
        case 'start': {
            const workspaceIdx = args.indexOf('--workspace');
            const workspace = workspaceIdx >= 0 ? args[workspaceIdx + 1] : undefined;
            startServer(workspace);
            break;
        }
        case 'stop':
            stopServer();
            break;
        case 'status':
            checkStatus();
            break;
        case 'pair':
            generatePairingInvitation();
            break;
        case 'exec': {
            const toolName = args[1];
            if (!toolName) {
                console.error('Tool name required');
                process.exit(1);
            }
            // Parse --arg=value arguments
            const toolArgs = {};
            for (let i = 2; i < args.length; i++) {
                const arg = args[i];
                if (arg.startsWith('--')) {
                    const [key, value] = arg.substring(2).split('=');
                    toolArgs[key] = value || true;
                }
            }
            executeTool(toolName, toolArgs);
            break;
        }
        default:
            console.error(`Unknown command: ${command}`);
            console.log('Run "lama-code help" for usage');
            process.exit(1);
    }
}
main();
//# sourceMappingURL=cli.js.map