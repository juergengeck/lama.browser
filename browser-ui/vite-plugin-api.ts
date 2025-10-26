/**
 * Vite Plugin: Refinio API
 *
 * Exposes API endpoints for test automation and debugging.
 * Accessible at http://localhost:5175/api/*
 */

import type { Plugin, ViteDevServer } from 'vite';

interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
  data?: any;
}

// Global log buffer (shared across the dev server)
const logBuffer: LogEntry[] = [];
const MAX_LOG_ENTRIES = 1000;

export function apiPlugin(): Plugin {
  return {
    name: 'refinio-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api', (req, res, next) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);

        // Enable CORS for test access
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        // Handle API routes
        if (url.pathname === '/api/logs') {
          handleGetLogs(req, res, url);
        } else if (url.pathname === '/api/logs/add') {
          handleAddLog(req, res);
        } else if (url.pathname === '/api/status') {
          handleGetStatus(req, res);
        } else if (url.pathname === '/api/logs/clear') {
          handleClearLogs(req, res);
        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      });
    }
  };
}

function handleGetLogs(req: any, res: any, url: URL) {
  const filter = url.searchParams.get('filter');
  const limit = parseInt(url.searchParams.get('limit') || '100', 10);
  const since = parseInt(url.searchParams.get('since') || '0', 10);

  let logs = logBuffer;

  // Filter by timestamp
  if (since > 0) {
    logs = logs.filter(log => log.timestamp >= since);
  }

  // Filter by search term
  if (filter) {
    const filterLower = filter.toLowerCase();
    logs = logs.filter(log =>
      log.message.toLowerCase().includes(filterLower) ||
      log.level.toLowerCase().includes(filterLower)
    );
  }

  // Apply limit
  logs = logs.slice(-limit);

  res.statusCode = 200;
  res.end(JSON.stringify({
    count: logs.length,
    total: logBuffer.length,
    logs
  }));
}

function handleAddLog(req: any, res: any) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const logEntry = JSON.parse(body);

      // Add timestamp if not present
      if (!logEntry.timestamp) {
        logEntry.timestamp = Date.now();
      }

      // Add to buffer
      logBuffer.push(logEntry);

      // Trim buffer if too large
      if (logBuffer.length > MAX_LOG_ENTRIES) {
        logBuffer.splice(0, logBuffer.length - MAX_LOG_ENTRIES);
      }

      res.statusCode = 201;
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
}

function handleGetStatus(req: any, res: any) {
  res.statusCode = 200;
  res.end(JSON.stringify({
    status: 'running',
    logCount: logBuffer.length,
    uptime: process.uptime(),
    timestamp: Date.now()
  }));
}

function handleClearLogs(req: any, res: any) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const clearedCount = logBuffer.length;
  logBuffer.length = 0;

  res.statusCode = 200;
  res.end(JSON.stringify({
    success: true,
    clearedCount
  }));
}
