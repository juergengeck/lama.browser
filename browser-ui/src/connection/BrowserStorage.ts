/**
 * Browser Storage Adapter for connection.core
 *
 * Uses IndexedDB for persistent storage (owner-specific after login).
 */

import type { StorageAdapter, PeerIdentity, VersionedCredential } from '@lama/connection.core';

const DB_NAME = 'lama-connection';
const DB_VERSION = 1;
const PEERS_STORE = 'peers';
const CREDENTIALS_STORE = 'credentials';
const GROUPS_STORE = 'groups';

export class BrowserIndexedDBStorage implements StorageAdapter {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) {
      return; // Already initialized
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains(PEERS_STORE)) {
          db.createObjectStore(PEERS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(CREDENTIALS_STORE)) {
          const credStore = db.createObjectStore(CREDENTIALS_STORE, { keyPath: 'id' });
          credStore.createIndex('subjectId', 'credentialSubject.id', { unique: false });
        }
        if (!db.objectStoreNames.contains(GROUPS_STORE)) {
          db.createObjectStore(GROUPS_STORE, { keyPath: 'groupId' });
        }
      };
    });
  }

  async storePeer(peer: PeerIdentity): Promise<void> {
    await this.ensureDB();
    return this.put(PEERS_STORE, peer);
  }

  async getPeer(peerId: string): Promise<PeerIdentity | null> {
    await this.ensureDB();
    return this.get(PEERS_STORE, peerId);
  }

  async listPeers(): Promise<PeerIdentity[]> {
    await this.ensureDB();
    return this.getAll(PEERS_STORE);
  }

  async removePeer(peerId: string): Promise<void> {
    await this.ensureDB();
    return this.delete(PEERS_STORE, peerId);
  }

  async storeCredential(credential: VersionedCredential): Promise<void> {
    await this.ensureDB();
    return this.put(CREDENTIALS_STORE, credential);
  }

  async getCredential(credentialId: string): Promise<VersionedCredential | null> {
    await this.ensureDB();
    return this.get(CREDENTIALS_STORE, credentialId);
  }

  async listCredentials(subjectId: string): Promise<VersionedCredential[]> {
    await this.ensureDB();
    return this.getByIndex(CREDENTIALS_STORE, 'subjectId', subjectId);
  }

  async storeGroup(groupId: string, memberIds: string[]): Promise<void> {
    await this.ensureDB();
    return this.put(GROUPS_STORE, { groupId, memberIds });
  }

  async getGroup(groupId: string): Promise<string[] | null> {
    await this.ensureDB();
    const result = await this.get(GROUPS_STORE, groupId);
    return result ? result.memberIds : null;
  }

  private async ensureDB(): Promise<void> {
    if (!this.db) {
      await this.init();
    }
  }

  private put<T>(storeName: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private get<T>(storeName: string, key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  private getAll<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  private getByIndex<T>(storeName: string, indexName: string, key: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  private delete(storeName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}
