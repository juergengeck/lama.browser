/**
 * API Logger Service
 *
 * Captures console logs and sends them to the Vite dev server API
 * for test automation and debugging.
 */

class APILogger {
  private enabled: boolean = false;
  private apiUrl: string = '/api/logs/add';
  private buffer: any[] = [];
  private flushInterval: number = 1000; // ms
  private maxBufferSize: number = 50;
  private flushTimer: NodeJS.Timeout | null = null;

  // Store original console methods
  private originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug
  };

  constructor() {
    // Only enable in development mode
    if (import.meta.env.DEV) {
      this.enable();
    }
  }

  enable() {
    if (this.enabled) return;

    this.enabled = true;
    this.interceptConsole();
    this.startFlushTimer();

    console.log('[APILogger] Enabled - logs will be sent to', this.apiUrl);
  }

  disable() {
    if (!this.enabled) return;

    this.enabled = false;
    this.restoreConsole();
    this.stopFlushTimer();
    this.flush();
  }

  private interceptConsole() {
    const createInterceptor = (level: string, original: Function) => {
      return (...args: any[]) => {
        // Call original first
        original.apply(console, args);

        // Format message
        const message = args.map(arg => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        }).join(' ');

        // Add to buffer
        this.addLog(level, message);
      };
    };

    console.log = createInterceptor('log', this.originalConsole.log);
    console.info = createInterceptor('info', this.originalConsole.info);
    console.warn = createInterceptor('warn', this.originalConsole.warn);
    console.error = createInterceptor('error', this.originalConsole.error);
    console.debug = createInterceptor('debug', this.originalConsole.debug);
  }

  private restoreConsole() {
    console.log = this.originalConsole.log;
    console.info = this.originalConsole.info;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.debug = this.originalConsole.debug;
  }

  private addLog(level: string, message: string) {
    if (!this.enabled) return;

    this.buffer.push({
      timestamp: Date.now(),
      level,
      message
    });

    // Flush if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  private startFlushTimer() {
    this.stopFlushTimer();
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private async flush() {
    if (this.buffer.length === 0) return;

    const logsToSend = this.buffer.splice(0, this.buffer.length);

    try {
      // Send all buffered logs
      for (const log of logsToSend) {
        await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(log)
        });
      }
    } catch (error) {
      // Silently fail - don't pollute console if API is unavailable
      // This allows the app to work even if the API plugin is disabled
    }
  }
}

// Create singleton instance
export const apiLogger = new APILogger();

// Clean up on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    apiLogger.disable();
  });
}
