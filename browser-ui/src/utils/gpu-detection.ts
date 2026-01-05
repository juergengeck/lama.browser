/**
 * GPU Detection Utility for Browser
 *
 * Re-exports WebGPU management from @local/core for consistency
 * across the codebase. Call initWebGPU() during app startup.
 *
 * @deprecated Import directly from '@local/core' instead
 */

// Re-export everything from local.core
export {
  initWebGPU,
  isWebGPUReady,
  isWebGPUInitialized,
  getWebGPUStatus,
  getPreferredDevice,
  getGPUAdapter,
  getGPUDevice,
  resetWebGPU,
  createWebGPUStatusMessage,
} from '@local/core';

export type { GPUCapability, InferenceDevice, WebGPUStatusMessage } from '@local/core';

// Legacy aliases for backwards compatibility
// checkGPUCapability must be async (returns Promise) for ModelOnboarding
export { initWebGPU as checkGPUCapability } from '@local/core';
export { isWebGPUReady as isGPUAvailable } from '@local/core';

/**
 * @deprecated Use resetWebGPU() instead
 */
export function clearGPUCache(): void {
  // No-op for backwards compatibility - use resetWebGPU() instead
  console.warn('[gpu-detection] clearGPUCache() is deprecated, use resetWebGPU() from @local/core');
}
