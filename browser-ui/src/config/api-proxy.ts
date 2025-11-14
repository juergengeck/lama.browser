/**
 * API Proxy Configuration for Browser
 *
 * Anthropic and OpenAI APIs don't allow direct browser requests due to CORS.
 * Use a CORS proxy to enable browser-based API calls.
 *
 * Options:
 * 1. Public CORS proxies (development only):
 *    - https://cors-anywhere.herokuapp.com (rate limited, not for production)
 *    - https://corsproxy.io (free, community-run)
 *
 * 2. Self-hosted proxy (recommended for production):
 *    - Deploy your own CORS proxy
 *    - See: https://github.com/Rob--W/cors-anywhere
 *
 * 3. Backend API Gateway (best for production):
 *    - Your own backend that proxies API calls
 *    - Add authentication, rate limiting, usage tracking
 *    - Keep API keys secure on server side
 */

/**
 * Get CORS proxy URL from environment or configuration
 */
export function getCorsProxyUrl(): string | undefined {
  // Check environment variable first
  if (import.meta.env.VITE_CORS_PROXY_URL) {
    return import.meta.env.VITE_CORS_PROXY_URL;
  }

  // Default: Use corsproxy.io for development
  // WARNING: This is a public proxy - NOT suitable for production!
  // Deploy your own proxy or use a backend gateway for production.
  if (import.meta.env.DEV) {
    console.warn('[API Proxy] Using public CORS proxy for development. Deploy your own proxy for production!');
    return 'https://corsproxy.io';
  }

  // Production: No default proxy - users must configure their own
  console.error('[API Proxy] No CORS proxy configured! Set VITE_CORS_PROXY_URL in .env');
  return undefined;
}

/**
 * Check if we're in a browser environment that needs a proxy
 */
export function needsCorsProxy(): boolean {
  return typeof window !== 'undefined' && typeof process === 'undefined';
}
