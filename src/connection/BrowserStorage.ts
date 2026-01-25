/**
 * BrowserStorage - IndexedDB-based storage for browser platform
 *
 * Example implementation of StorageAdapter interface using IndexedDB.
 * Demonstrates how platforms should implement persistent storage.
 */

import type { StorageAdapter, PeerIdentity, VersionedCredential } from '@refinio/connection.core';

export class BrowserIndexedDBStorage implements StorageAdapter {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'lama-connection-core';
  private readonly dbVersion = 1;

  constructor() {
    void this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(new Error('Failed to open IndexedDB'));

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('peers')) {
          db.createObjectStore('peers', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('credentials')) {
          db.createObjectStore('credentials', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('groups')) {
          db.createObjectStore('groups', { keyPath: 'id' });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initDB();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  async storePeer(peer: PeerIdentity): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction(['peers'], 'readwrite');
    const store = tx.objectStore('peers');
    store.put(peer);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPeer(peerId: string): Promise<PeerIdentity | null> {
    const db = await this.ensureDB();
    const tx = db.transaction(['peers'], 'readonly');
    const store = tx.objectStore('peers');
    const request = store.get(peerId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async listPeers(): Promise<PeerIdentity[]> {
    const db = await this.ensureDB();
    const tx = db.transaction(['peers'], 'readonly');
    const store = tx.objectStore('peers');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removePeer(peerId: string): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction(['peers'], 'readwrite');
    const store = tx.objectStore('peers');
    store.delete(peerId);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async storeCredential(credential: VersionedCredential): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction(['credentials'], 'readwrite');
    const store = tx.objectStore('credentials');
    store.put(credential);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCredential(credentialId: string): Promise<VersionedCredential | null> {
    const db = await this.ensureDB();
    const tx = db.transaction(['credentials'], 'readonly');
    const store = tx.objectStore('credentials');
    const request = store.get(credentialId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async listCredentials(subjectId: string): Promise<VersionedCredential[]> {
    const db = await this.ensureDB();
    const tx = db.transaction(['credentials'], 'readonly');
    const store = tx.objectStore('credentials');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const all = request.result as VersionedCredential[];
        const filtered = all.filter((c) => c.credentialSubject.id === subjectId);
        resolve(filtered);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async storeGroup(groupId: string, memberIds: string[]): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction(['groups'], 'readwrite');
    const store = tx.objectStore('groups');
    store.put({ id: groupId, memberIds });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getGroup(groupId: string): Promise<string[] | null> {
    const db = await this.ensureDB();
    const tx = db.transaction(['groups'], 'readonly');
    const store = tx.objectStore('groups');
    const request = store.get(groupId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result as { id: string; memberIds: string[] } | undefined;
        resolve(result ? result.memberIds : null);
      };
      request.onerror = () => reject(request.error);
    });
  }
}
