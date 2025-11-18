/**
 * @lama/connection.btle-node
 *
 * Node.js/Electron BTLE transport implementation for lama connection packages
 * Uses @abandonware/noble for central role and @abandonware/bleno for peripheral role
 */

export { NodeBTLETransport } from './NodeBTLETransport.js';
export type {
  IBTLETransport,
  BTLEDevice,
  BTLEService,
  BTLECharacteristic,
  BTLEScanOptions,
  BTLEConnectionOptions,
  BTLEWriteOptions,
  BTLEAdvertisingOptions,
  BTLEServiceDef,
  BTLECharacteristicDef,
  BTLEDescriptorDef,
  BTLEState,
  BTLEStats
} from './types.js';
