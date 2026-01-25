/**
 * GPU Detection Utility for Browser
 *
 * Re-exports WebGPU management from @refinio/local.core for consistency
 * across the codebase. Call initWebGPU() during app startup.
 *
 * @deprecated Import directly from '@refinio/local.core' instead
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
} from '@refinio/local.core';

export type { GPUCapability, InferenceDevice, WebGPUStatusMessage } from '@refinio/local.core';

// Legacy aliases for backwards compatibility
// checkGPUCapability must be async (returns Promise) for ModelOnboarding
export { initWebGPU as checkGPUCapability } from '@refinio/local.core';
export { isWebGPUReady as isGPUAvailable } from '@refinio/local.core';

/**
 * @deprecated Use resetWebGPU() instead
 */
export function clearGPUCache(): void {
  // No-op for backwards compatibility - use resetWebGPU() instead
  console.warn('[gpu-detection] clearGPUCache() is deprecated, use resetWebGPU() from @refinio/local.core');
}
