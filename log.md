# Browser Logging API

## Overview

The browser logging API captures console output from the browser instance and exposes it via HTTP endpoints for test automation and debugging.

**Key Components:**
1. **Vite Plugin** - HTTP API server (runs in Vite dev server, Node.js)
2. **Browser Logger** - Console interceptor (runs in browser, captures logs)
3. **Test Integration** - HTTP client (test scripts fetch logs)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Browser (http://localhost:5175)                             │
│                                                              │
│  ┌──────────────────────────────────────┐                  │
│  │ api-logger.ts                         │                  │
│  │ - Intercepts console.log/info/warn... │                  │
│  │ - Buffers log entries                 │                  │
│  │ - POSTs to /api/logs/add every 1s     │                  │
│  └──────────────────────────────────────┘                  │
│                   │                                          │
│                   │ HTTP POST                                │
│                   ▼                                          │
└───────────────────┼──────────────────────────────────────────┘
                    │
┌───────────────────┼──────────────────────────────────────────┐
│ Vite Dev Server (Node.js)                                    │
│                   │                                           │
│  ┌────────────────▼─────────────────────┐                   │
│  │ vite-plugin-api.ts                    │                   │
│  │ - Middleware at /api/*                │                   │
│  │ - Stores logs in memory buffer        │                   │
│  │ - Serves GET /api/logs                │                   │
│  └───────────────────────────────────────┘                   │
│                   │                                           │
│                   │ HTTP GET                                  │
│                   ▼                                           │
└───────────────────┼───────────────────────────────────────────┘
                    │
┌───────────────────┼───────────────────────────────────────────┐
│ Test Script (Node.js)                                         │
│                   │                                            │
│  ┌────────────────▼─────────────────────┐                    │
│  │ test-lama-connection.js               │                    │
│  │ - fetchBrowserLogs(filter, limit)     │                    │
│  │ - showBrowserLogs(filter, limit)      │                    │
│  └───────────────────────────────────────┘                    │
└───────────────────────────────────────────────────────────────┘
```

## API Endpoints

All endpoints are served by the Vite dev server at `http://localhost:5175/api/*`

### GET /api/logs

Retrieve browser console logs.

**Query Parameters:**
- `filter` (optional) - Search term to filter logs by message or level
- `limit` (optional) - Maximum number of logs to return (default: 100)
- `since` (optional) - Unix timestamp, only return logs after this time

**Response:**
```json
{
  "count": 25,
  "total": 157,
  "logs": [
    {
      "timestamp": 1730000000000,
      "level": "log",
      "message": "[Model] Initializing..."
    }
  ]
}
```

**Example:**
```bash
curl "http://localhost:5175/api/logs?filter=pairing&limit=50"
```

### POST /api/logs/add

Add a log entry (used internally by browser logger).

**Request Body:**
```json
{
  "timestamp": 1730000000000,
  "level": "log",
  "message": "Log message here"
}
```

**Response:**
```json
{
  "success": true
}
```

### GET /api/status

Get server status and log count.

**Response:**
```json
{
  "status": "running",
  "logCount": 157,
  "uptime": 3600.5,
  "timestamp": 1730000000000
}
```

### POST /api/logs/clear

Clear all logs from the buffer.

**Response:**
```json
{
  "success": true,
  "clearedCount": 157
}
```

## Usage from Test Scripts

### Basic Usage

```javascript
import http from 'http';

async function fetchBrowserLogs(filter = '', limit = 100) {
    return new Promise((resolve, reject) => {
        const url = `http://localhost:5175/api/logs?filter=${encodeURIComponent(filter)}&limit=${limit}`;

        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

// Get all logs
const allLogs = await fetchBrowserLogs();

// Get pairing-related logs
const pairingLogs = await fetchBrowserLogs('pairing', 50);

// Get error logs
const errorLogs = await fetchBrowserLogs('error', 100);
```

### Display Logs

```javascript
async function showBrowserLogs(filter = '', limit = 50) {
    const result = await fetchBrowserLogs(filter, limit);

    console.log(`\n📋 Browser Logs (${result.count} of ${result.total} total):`);
    console.log('═══════════════════════════════════════════════════════');

    for (const log of result.logs) {
        const timestamp = new Date(log.timestamp).toISOString().substring(11, 23);
        const level = log.level.toUpperCase().padEnd(5);
        console.log(`[${timestamp}] [${level}] ${log.message}`);
    }

    console.log('═══════════════════════════════════════════════════════\n');
}

// Show last 30 logs
await showBrowserLogs('', 30);

// Show P2P-related logs
await showBrowserLogs('P2P', 50);
```

## Configuration

### Browser Logger (browser-ui/src/services/api-logger.ts)

```typescript
class APILogger {
  private apiUrl = '/api/logs/add';
  private flushInterval = 1000;      // Flush every 1 second
  private maxBufferSize = 50;        // Flush when buffer reaches 50 entries
}
```

### Vite Plugin (browser-ui/vite-plugin-api.ts)

```typescript
const MAX_LOG_ENTRIES = 1000;  // Maximum logs stored in memory
```

## Log Levels

The logger captures all console methods:

- `console.log()` → level: "log"
- `console.info()` → level: "info"
- `console.warn()` → level: "warn"
- `console.error()` → level: "error"
- `console.debug()` → level: "debug"

## Filtering Examples

```javascript
// Get all initialization logs
await showBrowserLogs('Initializing', 100);

// Get all Model-related logs
await showBrowserLogs('[Model]', 50);

// Get all pairing success logs
await showBrowserLogs('PAIRING SUCCESS', 20);

// Get all P2P topic logs
await showBrowserLogs('P2PTopicService', 50);

// Get error logs
await showBrowserLogs('error', 100);
```

## Debugging Workflow

1. **Start the test:**
   ```bash
   node test-lama-connection.js
   ```

2. **Test script automatically shows browser logs after initialization**

3. **Query logs during test execution:**
   ```bash
   curl "http://localhost:5175/api/logs?filter=pairing&limit=100" | jq
   ```

4. **Check for specific errors:**
   ```bash
   curl "http://localhost:5175/api/logs?filter=error" | jq '.logs[].message'
   ```

5. **Monitor real-time:**
   ```bash
   # In a separate terminal, poll every 2 seconds
   while true; do
     curl -s "http://localhost:5175/api/logs?limit=5" | jq '.logs[-1]'
     sleep 2
   done
   ```

## Implementation Details

### Browser Side (api-logger.ts)

1. **Initialization:**
   - Automatically starts in DEV mode (`import.meta.env.DEV`)
   - Intercepts console methods on load

2. **Buffering:**
   - Logs stored in memory array
   - Flushed every 1 second OR when 50 entries accumulated
   - Flush on page unload (`beforeunload` event)

3. **Format:**
   - Objects are JSON.stringify'd
   - Multiple args joined with spaces
   - Timestamp added automatically

### Server Side (vite-plugin-api.ts)

1. **Storage:**
   - In-memory array (survives Vite HMR)
   - FIFO when exceeding MAX_LOG_ENTRIES (1000)

2. **Middleware:**
   - Runs on `/api/*` routes
   - CORS enabled for test scripts
   - JSON responses

3. **Filtering:**
   - Case-insensitive string matching
   - Searches both message and level
   - Applied after timestamp filtering

## Limitations

- **Dev Mode Only:** Logger only runs when `import.meta.env.DEV === true`
- **Memory Storage:** Logs lost on Vite server restart
- **Max Entries:** Only last 1000 logs kept in memory
- **No Persistence:** Logs not saved to disk
- **Single Instance:** One buffer shared across all browser connections

## Security Considerations

- **CORS Enabled:** API accessible from any origin (dev only)
- **No Authentication:** Endpoints are public (dev only)
- **Local Only:** Vite server binds to localhost by default
- **Dev Mode Only:** Entire feature disabled in production builds

## Future Enhancements

Potential improvements:

1. **Structured Logging:**
   ```typescript
   interface LogEntry {
     timestamp: number;
     level: string;
     message: string;
     data?: any;        // Structured data
     source?: string;   // Module/component name
     stack?: string;    // Error stack trace
   }
   ```

2. **WebSocket Streaming:**
   - Real-time log streaming instead of polling
   - Lower latency for test debugging

3. **Log Levels:**
   - Filter by log level (GET /api/logs?level=error)
   - Severity-based filtering

4. **Persistence:**
   - Optional file-based storage
   - Configurable retention policy

5. **Performance Metrics:**
   - Track timing of key operations
   - Expose via /api/metrics

## Troubleshooting

### Logs not appearing

**Problem:** Browser logs not showing in test script

**Check:**
1. Is Vite dev server running? (`http://localhost:5175`)
2. Is browser page loaded? (open in browser manually)
3. Is logger initialized? (check console for "[APILogger] Enabled")
4. Check API status: `curl http://localhost:5175/api/status`

### CORS errors

**Problem:** Cannot fetch logs from test script

**Solution:**
- Ensure Vite dev server is running
- Check that vite-plugin-api.ts is loaded in vite.config.ts
- CORS headers should be set automatically

### Empty log buffer

**Problem:** `/api/logs` returns empty array

**Check:**
1. Wait 1 second for initial flush
2. Verify browser is actually logging (check browser console)
3. Check if logger is enabled: `import.meta.env.DEV`

### Missing logs

**Problem:** Some logs missing from buffer

**Causes:**
- Buffer exceeded 1000 entries (oldest logs dropped)
- Logs occurred before logger initialized
- Logs happened after page unload

**Solution:**
- Increase MAX_LOG_ENTRIES in vite-plugin-api.ts
- Query logs more frequently during tests
- Add timestamps to identify gaps
