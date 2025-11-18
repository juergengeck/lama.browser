# lama.code

Standalone Node.js server providing AI coding assistant capabilities via P2P.

## Overview

**lama.code** is a standalone service that runs **code.core** with full ONE.core integration, enabling P2P remote access to code operations from lama mobile/browser/desktop.

**Key Features**:
- 🚀 Standalone server (separate from lama)
- 🔐 P2P pairing protocol (secure remote access)
- 🛠️ 26 MCP tools (file, search, execution)
- 💾 AI memory via ONE.core storage
- 🌍 Access from mobile, browser, desktop
- 🔒 Security-first (sandboxed execution, path validation)

## Architecture

```
Desktop runs lama.code server
         ↓
    code.core library
    (file ops, indexing, search, execution)
         ↓
    ONE.core P2P infrastructure
         ↓
Mobile/Browser connects via pairing
```

## Installation

### From Source

```bash
cd lama.code
npm install
npm run build
```

### Global Installation (Future)

```bash
npm install -g @lama/code
```

## Usage

### Start Server

```bash
# Start in current directory
npm start

# Or with custom workspace
WORKSPACE=/path/to/project npm start

# With CLI (after global install)
lama-code start --workspace /path/to/project
```

Server starts on `http://localhost:3001` by default.

### CLI Commands

```bash
# Check status
lama-code status

# Generate pairing invitation for mobile
lama-code pair

# Execute tool directly
lama-code exec search_code --pattern="authenticate" --glob="**/*.ts"
lama-code exec read_file --path="src/index.ts"

# Stop server
lama-code stop
```

### Pairing with Mobile

1. **On Desktop**:
   ```bash
   lama-code pair
   ```
   This generates a pairing invitation code.

2. **On Mobile**:
   - Open lama app
   - Settings → Code Assistant → Connect to Desktop
   - Enter invitation code
   - Connected! ✅

3. **Use from Mobile**:
   ```
   User: "Show me the authentication code"
   AI: (Executes search_code tool on desktop via P2P)
       "Found in src/auth/handler.ts:..."
   ```

### HTTP API (Local Access)

#### GET /identity
Get server identity info.

```bash
curl http://localhost:3001/identity
```

Response:
```json
{
  "personId": "...",
  "name": "lama-code",
  "email": "code@lama.local",
  "workspaceRoot": "/path/to/workspace"
}
```

#### POST /connect
Create or accept pairing invitation.

Create invitation:
```bash
curl -X POST http://localhost:3001/connect
```

Accept invitation:
```bash
curl -X POST http://localhost:3001/connect \
  -H "Content-Type: application/json" \
  -d '{"invitation": "..."}'
```

#### GET /tools
List available tools.

```bash
curl http://localhost:3001/tools
```

#### POST /tools/:toolName
Execute tool.

```bash
curl -X POST http://localhost:3001/tools/search_code \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"pattern": "authenticate", "fileGlob": "**/*.ts"}}'
```

Response:
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "file": "src/auth/handler.ts",
        "line": 42,
        "content": "function authenticate(user) {"
      }
    ]
  }
}
```

#### GET /workspace/info
Get workspace information.

```bash
curl http://localhost:3001/workspace/info
```

## Available Tools

### File Tools (8)
- `read_file` - Read file contents
- `write_file` - Write or create file
- `edit_file` - Edit existing file
- `delete_file` - Delete file
- `list_files` - List files matching pattern
- `create_directory` - Create directory
- `rename_file` - Rename or move file
- `file_exists` - Check if file exists

### Search Tools (9)
- `search_code` - Search codebase for pattern
- `find_definition` - Find symbol definition
- `find_references` - Find symbol references
- `find_files` - Find files by name pattern
- `find_imports` - Find imports of module
- `get_file_structure` - Get directory tree
- `get_file_symbols` - Get symbols in file
- `search_symbols` - Search for symbol by name
- `get_workspace_info` - Get workspace stats

### Execution Tools (9)
- `run_command` - Execute command (sandboxed)
- `run_tests` - Run test suite
- `run_build` - Run build script
- `run_lint` - Run linter
- `npm_install` - Install npm packages
- `git_status` - Get git status
- `git_diff` - Get git diff
- `git_log` - Get git log
- `check_syntax` - Check file syntax

## Configuration

### Environment Variables

- `WORKSPACE` - Workspace root directory (default: current directory)
- `INSTANCE_NAME` - Instance name (default: "lama-code")
- `INSTANCE_EMAIL` - Instance email (default: "code@lama.local")
- `STORAGE_DIR` - ONE.core storage directory (default: "./.lama-code-storage")
- `COMM_SERVER_URL` - Communication server URL (default: "wss://comm.lama.one")
- `HTTP_PORT` - HTTP API port (default: 3001)
- `WIPE_STORAGE` - Wipe storage on start (default: false)

### Security Policy

The default security policy allows:
- **Commands**: npm, yarn, pnpm, git, node, tsc, eslint, prettier, jest, mocha
- **Paths**: Workspace directory only
- **Timeout**: 2 minutes per command
- **File Operations**: Read, write, delete within workspace
- **Network**: Disabled

You can customize the security policy by modifying `src/server.ts`.

## Development

### Build

```bash
npm run build      # Compile TypeScript
npm run watch      # Watch mode
npm run clean      # Remove compiled files
```

### Testing

```bash
npm test           # Run integration tests
```

### Project Structure

```
lama.code/
├── src/
│   ├── server.ts                    # Main server
│   ├── cli.ts                       # CLI interface
│   └── adapters/
│       ├── NodeFileSystemAdapter.ts # Node.js fs implementation
│       └── NodeCommandExecutor.ts   # Node.js child_process
├── test/
│   └── integration/
│       └── code-server.test.js      # Integration tests
├── package.json
├── tsconfig.json
└── README.md
```

## Integration with lama

### Mobile (lama app)

1. Discover code servers via P2P
2. Pair with desktop (QR code or invitation)
3. Send tool requests via MCP over P2P
4. Display results in chat UI

### Browser (lama.browser)

1. Discover via local network (mDNS) or P2P
2. Connect to server
3. Execute tools via HTTP or P2P
4. Display results in UI

### Desktop (lama.electron)

1. Discover lama.code on localhost
2. Connect automatically (same machine)
3. Proxy requests from mobile/browser
4. Or execute tools directly

## Security

### Pairing Protocol

- QR code-based pairing
- Invitation expires after 15 minutes
- Only paired devices can execute tools
- Based on lama's trust.core

### Command Execution

- Whitelist-based validation
- No shell execution (uses spawn)
- Timeout enforcement
- Resource limits
- Path restrictions (workspace only)

### File Operations

- Workspace-relative paths only
- No directory traversal
- File size limits
- Operation confirmations

## Comparison with Alternatives

| Feature | lama.code | VSCode Extension | Cloud Service |
|---------|-----------|------------------|---------------|
| **Access** | Mobile, browser, desktop | Desktop only | Any device |
| **Network** | P2P (local-first) | Local only | Requires internet |
| **Privacy** | All local | All local | Code sent to cloud |
| **Setup** | One-time pairing | Extension install | Account signup |
| **Cost** | Free (self-hosted) | Free | Subscription |
| **AI Memory** | Yes (ONE.core) | No | Maybe |
| **Offline** | Yes (if desktop running) | Yes | No |

## Troubleshooting

### Server won't start

1. Check if port 3001 is available:
   ```bash
   lsof -i :3001
   ```

2. Try a different port:
   ```bash
   HTTP_PORT=3002 npm start
   ```

3. Check logs in storage directory:
   ```bash
   cat .lama-code-storage/logs/server.log
   ```

### Pairing fails

1. Ensure both devices are connected to internet
2. Check comm server URL is correct
3. Try generating a new invitation
4. Check firewall settings

### Tool execution fails

1. Verify workspace path is correct
2. Check command is in security policy whitelist
3. Verify file paths are within workspace
4. Check timeout settings

## Contributing

See main lama repository for contribution guidelines.

## License

MIT - See LICENSE file

## Authors

lama.one Team

## Related Projects

- **code.core** - Platform-agnostic code assistant library
- **lama.core** - AI/LLM infrastructure
- **chat.core** - Chat/messaging business logic
- **trust.core** - Trust and identity management
- **connection.core** - P2P connection management
