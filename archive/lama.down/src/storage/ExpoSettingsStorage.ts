/**
 * ExpoSettingsStorage - React Native storage adapter for settings.core
 *
 * Uses Expo SecureStore for encrypted, persistent storage
 */

import * as SecureStore from 'expo-secure-store';
import type {
  SettingsStorage,
  Settings,
  SettingsKey,
  SettingsCategoryKey,
} from '@settings/core';

export class ExpoSettingsStorage implements SettingsStorage {
  private readonly keyPrefix = 'lama.settings';

  /**
   * Get storage key for a category
   */
  private getCategoryKey(category: SettingsKey): string {
    return `${this.keyPrefix}.${category}`;
  }

  /**
   * Get storage key for all settings
   */
  private getAllKey(): string {
    return `${this.keyPrefix}.all`;
  }

  /**
   * Get a single setting value
   */
  async get<K extends SettingsKey>(
    category: K,
    key: SettingsCategoryKey<K>
  ): Promise<Settings[K][SettingsCategoryKey<K>] | null> {
    try {
      const stored = await SecureStore.getItemAsync(this.getCategoryKey(category));

      if (stored) {
        const parsed = JSON.parse(stored) as Settings[K];
        return parsed[key] ?? null;
      }

      return null;
    } catch (error) {
      console.error('[ExpoSettingsStorage] Error getting setting:', error);
      return null;
    }
  }

  /**
   * Set a single setting value
   */
  async set<K extends SettingsKey>(
    category: K,
    key: SettingsCategoryKey<K>,
    value: Settings[K][SettingsCategoryKey<K>]
  ): Promise<void> {
    try {
      // Get current category settings
      const stored = await SecureStore.getItemAsync(this.getCategoryKey(category));
      const current: Settings[K] = stored ? JSON.parse(stored) : {} as Settings[K];

      // Update the specific key
      current[key] = value;

      // Save back
      await SecureStore.setItemAsync(
        this.getCategoryKey(category),
        JSON.stringify(current)
      );

      console.log(`[ExpoSettingsStorage] Set ${String(category)}.${String(key)}`);
    } catch (error) {
      console.error('[ExpoSettingsStorage] Error setting value:', error);
      throw error;
    }
  }

  /**
   * Get all settings for a category
   */
  async getCategory<K extends SettingsKey>(category: K): Promise<Settings[K] | null> {
    try {
      const stored = await SecureStore.getItemAsync(this.getCategoryKey(category));

      if (stored) {
        return JSON.parse(stored) as Settings[K];
      }

      return null;
    } catch (error) {
      console.error('[ExpoSettingsStorage] Error getting category:', error);
      return null;
    }
  }

  /**
   * Set all settings for a category
   */
  async setCategory<K extends SettingsKey>(category: K, settings: Settings[K]): Promise<void> {
    try {
      await SecureStore.setItemAsync(
        this.getCategoryKey(category),
        JSON.stringify(settings)
      );

      console.log(`[ExpoSettingsStorage] Set category ${String(category)}`);
    } catch (error) {
      console.error('[ExpoSettingsStorage] Error setting category:', error);
      throw error;
    }
  }

  /**
   * Get all settings
   */
  async getAll(): Promise<Settings | null> {
    try {
      const stored = await SecureStore.getItemAsync(this.getAllKey());

      if (stored) {
        return JSON.parse(stored) as Settings;
      }

      return null;
    } catch (error) {
      console.error('[ExpoSettingsStorage] Error getting all settings:', error);
      return null;
    }
  }

  /**
   * Set all settings
   */
  async setAll(settings: Settings): Promise<void> {
    try {
      // Save to single key for atomic updates
      await SecureStore.setItemAsync(this.getAllKey(), JSON.stringify(settings));

      // Also save individual categories for partial access
      await Promise.all([
        SecureStore.setItemAsync(this.getCategoryKey('app'), JSON.stringify(settings.app)),
        SecureStore.setItemAsync(this.getCategoryKey('device'), JSON.stringify(settings.device)),
        SecureStore.setItemAsync(this.getCategoryKey('network'), JSON.stringify(settings.network)),
        SecureStore.setItemAsync(this.getCategoryKey('ai'), JSON.stringify(settings.ai)),
        SecureStore.setItemAsync(this.getCategoryKey('privacy'), JSON.stringify(settings.privacy)),
        SecureStore.setItemAsync(this.getCategoryKey('chat'), JSON.stringify(settings.chat)),
      ]);

      console.log('[ExpoSettingsStorage] Set all settings');
    } catch (error) {
      console.error('[ExpoSettingsStorage] Error setting all settings:', error);
      throw error;
    }
  }

  /**
   * Clear all settings
   */
  async clear(): Promise<void> {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(this.getAllKey()),
        SecureStore.deleteItemAsync(this.getCategoryKey('app')),
        SecureStore.deleteItemAsync(this.getCategoryKey('device')),
        SecureStore.deleteItemAsync(this.getCategoryKey('network')),
        SecureStore.deleteItemAsync(this.getCategoryKey('ai')),
        SecureStore.deleteItemAsync(this.getCategoryKey('privacy')),
        SecureStore.deleteItemAsync(this.getCategoryKey('chat')),
      ]);

      console.log('[ExpoSettingsStorage] Cleared all settings');
    } catch (error) {
      console.error('[ExpoSettingsStorage] Error clearing settings:', error);
      throw error;
    }
  }
}
