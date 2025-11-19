/**
 * useAvatarPreference - React hook for managing avatar preferences
 *
 * Loads and caches avatar configurations from ONE.core AvatarPreference objects
 */

import { useState, useEffect } from 'react';
import { loadDefaultAvatar, renderLamaAvatar } from '@/utils/avatar-helpers';
import type { AvatarPreference } from '@OneObjectInterfaces';

interface UseAvatarPreferenceResult {
    avatarUrl: string | null;
    avatarPref: AvatarPreference | null;
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
}

/**
 * Load avatar preference and render custom lama avatar if config exists
 */
export function useAvatarPreference(personId: string | null): UseAvatarPreferenceResult {
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarPref, setAvatarPref] = useState<AvatarPreference | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const loadAvatar = async () => {
        if (!personId) {
            setAvatarUrl(null);
            setAvatarPref(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const pref = await loadDefaultAvatar(personId);
            setAvatarPref(pref);

            if (pref?.lamaConfig) {
                // Render custom lama avatar
                const dataUrl = await renderLamaAvatar(pref.lamaConfig, 200);
                setAvatarUrl(dataUrl);
            } else {
                setAvatarUrl(null);
            }
        } catch (err) {
            console.warn('[useAvatarPreference] Failed to load:', err);
            setError(err instanceof Error ? err : new Error(String(err)));
            setAvatarUrl(null);
            setAvatarPref(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAvatar();
    }, [personId]);

    return {
        avatarUrl,
        avatarPref,
        loading,
        error,
        refresh: loadAvatar,
    };
}

/**
 * Simple version that just returns the rendered avatar URL
 */
export function useCustomAvatar(personId: string | null): string | null {
    const { avatarUrl } = useAvatarPreference(personId);
    return avatarUrl;
}
