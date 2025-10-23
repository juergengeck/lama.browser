/**
 * Electron API Stub for Browser
 *
 * Provides compile-time compatibility but throws at runtime
 */

const stub = {
  invoke: async () => {
    throw new Error('electronAPI not available in browser');
  },
  on: () => {
    console.warn('electronAPI.on not available in browser');
  },
  off: () => {
    console.warn('electronAPI.off not available in browser');
  },
  removeListener: () => {
    console.warn('electronAPI.removeListener not available in browser');
  }
};

// Install stub on window
if (typeof window !== 'undefined') {
  (window as any).electronAPI = stub;
}

export {};
