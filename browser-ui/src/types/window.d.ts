/**
 * Browser Window Type Extensions
 *
 * electronAPI stub - all methods throw "Not available in browser"
 */

interface ElectronAPIStub {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, callback: (...args: any[]) => void) => void;
  off: (channel: string, callback: (...args: any[]) => void) => void;
  removeListener: (channel: string, callback: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPIStub;
  }
}

export {};
