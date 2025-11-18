/**
 * useSettings hook - Easy access to settings from components
 */

import { useOneContext } from '@src/providers/OneProvider';
import type { Settings, SettingsKey, SettingsCategoryKey } from '@settings/core';

export interface UseSettingsResult {
  settings: Settings | null;
  isLoading: boolean;

  /**
   * Update a single setting value
   */
  updateSetting: <K extends SettingsKey>(
    category: K,
    key: SettingsCategoryKey<K>,
    value: Settings[K][SettingsCategoryKey<K>]
  ) => Promise<boolean>;

  /**
   * Update an entire category
   */
  updateCategory: <K extends SettingsKey>(category: K, settings: Settings[K]) => Promise<boolean>;

  /**
   * Reset settings to defaults
   */
  reset: (category?: SettingsKey) => Promise<boolean>;
}

/**
 * Hook to access and modify settings
 */
export function useSettings(): UseSettingsResult {
  const { settingsPlan, settings } = useOneContext();

  const updateSetting = async <K extends SettingsKey>(
    category: K,
    key: SettingsCategoryKey<K>,
    value: Settings[K][SettingsCategoryKey<K>]
  ): Promise<boolean> => {
    if (!settingsPlan) {
      console.warn('[useSettings] Settings plan not initialized');
      return false;
    }

    try {
      const result = await settingsPlan.setSetting({ category, key, value });
      return result.success;
    } catch (error) {
      console.error('[useSettings] Failed to update setting:', error);
      return false;
    }
  };

  const updateCategory = async <K extends SettingsKey>(
    category: K,
    categorySettings: Settings[K]
  ): Promise<boolean> => {
    if (!settingsPlan) {
      console.warn('[useSettings] Settings plan not initialized');
      return false;
    }

    try {
      const result = await settingsPlan.setCategory({ category, settings: categorySettings });
      return result.success;
    } catch (error) {
      console.error('[useSettings] Failed to update category:', error);
      return false;
    }
  };

  const reset = async (category?: SettingsKey): Promise<boolean> => {
    if (!settingsPlan) {
      console.warn('[useSettings] Settings plan not initialized');
      return false;
    }

    try {
      const result = await settingsPlan.resetSettings({ category });
      return result.success;
    } catch (error) {
      console.error('[useSettings] Failed to reset settings:', error);
      return false;
    }
  };

  return {
    settings,
    isLoading: settings === null,
    updateSetting,
    updateCategory,
    reset,
  };
}
