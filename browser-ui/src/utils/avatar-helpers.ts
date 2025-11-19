/**
 * Avatar Helper Functions
 *
 * Utilities for managing AvatarPreference objects and rendering custom lama avatars
 */

import { storeVersionedObject, getObjectByIdHash, getVersionsHashes } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { getObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js';
import type { SHA256IdHash, SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';
import type { AvatarPreference } from '@OneObjectInterfaces';
import type { AvatarConfig } from '../components/LamaAvatarComposer';

/**
 * Save avatar preference to ONE.core
 * Automatically increments generation number
 */
export async function saveAvatarPreference(
    personId: string,
    name: string,
    lamaConfig: AvatarConfig
): Promise<SHA256IdHash<AvatarPreference>> {
    const now = Date.now();

    // Get current avatar to determine next generation
    const currentAvatar = await loadAvatarByName(personId, name);
    const generation = currentAvatar ? currentAvatar.generation + 1 : 1;

    const avatarPref: AvatarPreference = {
        $type$: 'AvatarPreference',
        personId,
        name,
        generation,
        lamaConfig,
        createdAt: currentAvatar?.createdAt || now,
        updatedAt: now
    };

    const result = await storeVersionedObject(avatarPref);
    console.log('[AvatarHelpers] Saved avatar:', name, 'generation:', generation, result.idHash.substring(0, 16));
    return result.idHash as SHA256IdHash<AvatarPreference>;
}

/**
 * Load specific avatar by name (returns latest generation)
 */
export async function loadAvatarByName(
    personId: string,
    name: string
): Promise<AvatarPreference | null> {
    try {
        const idObj: Pick<AvatarPreference, '$type$' | 'personId' | 'name'> = {
            $type$: 'AvatarPreference',
            personId,
            name
        };

        const avatarPref = await getObjectByIdHash<AvatarPreference>(idObj);
        if (avatarPref) {
            console.log('[AvatarHelpers] Loaded avatar:', avatarPref.name, 'generation:', avatarPref.generation);
            return avatarPref;
        }
        return null;
    } catch (err) {
        console.warn('[AvatarHelpers] Avatar not found:', name);
        return null;
    }
}

/**
 * Load default LAMA avatar for a person
 */
export async function loadDefaultAvatar(
    personId: string
): Promise<AvatarPreference | null> {
    return loadAvatarByName(personId, 'LAMA');
}

/**
 * Get all versions of an avatar (for undo/redo navigation)
 * Returns sorted by generation descending (newest first)
 */
export async function getAllAvatarVersions(
    personId: string,
    name: string
): Promise<AvatarPreference[]> {
    try {
        const idObj: Pick<AvatarPreference, '$type$' | 'personId' | 'name'> = {
            $type$: 'AvatarPreference',
            personId,
            name
        };

        // Get ID hash
        const idHash = await calculateIdHashOfObj(idObj);

        // Get all version hashes
        const versions = await getVersionsHashes(idHash as SHA256IdHash<AvatarPreference>);

        // Load all versions
        const avatars = await Promise.all(
            Array.from(versions).map(async (versionHash) => {
                return await getObject<AvatarPreference>(versionHash);
            })
        );

        // Sort by generation descending (newest first)
        return avatars.sort((a, b) => b.generation - a.generation);
    } catch (err) {
        console.warn('[AvatarHelpers] Failed to load avatar versions:', err);
        return [];
    }
}

/**
 * Load previous generation (undo)
 */
export async function loadPreviousGeneration(
    personId: string,
    name: string,
    currentGeneration: number
): Promise<AvatarPreference | null> {
    const versions = await getAllAvatarVersions(personId, name);
    // Find first version with generation < current
    return versions.find(v => v.generation < currentGeneration) || null;
}

/**
 * Load next generation (redo)
 */
export async function loadNextGeneration(
    personId: string,
    name: string,
    currentGeneration: number
): Promise<AvatarPreference | null> {
    const versions = await getAllAvatarVersions(personId, name);
    // Find version with generation > current (sorted descending, so we need the last match)
    const nextVersions = versions.filter(v => v.generation > currentGeneration);
    return nextVersions[nextVersions.length - 1] || null;
}

/**
 * Render lama avatar config to canvas and return data URL
 */
export async function renderLamaAvatar(
    config: AvatarConfig,
    size: number = 200
): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    // Avatar parts in render order
    const AVATAR_PARTS: Record<string, string> = {
        outline: '/avatar/outline.svg',
        fell: '/avatar/fell.svg',
        hufen: '/avatar/hufen.svg',
        schwanz: '/avatar/schwanz.svg',
        ohren: '/avatar/ohren.svg',
        augen: '/avatar/augen.svg',
        krawatte: '/avatar/krawatte.svg',
        hut: '/avatar/hut.svg',
        punk: '/avatar/punk.svg',
    };

    // Determine which layers to render
    const layersToRender: string[] = ['outline']; // Always render base
    if (config.fell) layersToRender.push('fell');
    if (config.hufen) layersToRender.push('hufen');
    if (config.schwanz) layersToRender.push('schwanz');
    if (config.ohren) layersToRender.push('ohren');
    if (config.augen) layersToRender.push('augen');
    if (config.krawatte) layersToRender.push('krawatte');
    if (config.hut) layersToRender.push('hut');
    if (config.punk) layersToRender.push('punk');

    // Load and render each layer
    for (const key of layersToRender) {
        const path = AVATAR_PARTS[key];
        if (!path) continue;

        await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                ctx.drawImage(img, 0, 0, size, size);
                resolve();
            };
            img.onerror = () => {
                console.warn(`[AvatarHelpers] Failed to load ${key}`);
                resolve(); // Continue even if layer fails
            };
            img.src = path;
        });
    }

    return canvas.toDataURL('image/png');
}

/**
 * Convert data URL to File object for upload
 */
export function dataUrlToFile(dataUrl: string, filename: string = 'avatar.png'): File {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

/**
 * Get default avatar config (all standard parts enabled)
 */
export function getDefaultAvatarConfig(): AvatarConfig {
    return {
        fell: true,
        hufen: true,
        schwanz: true,
        ohren: true,
        augen: true,
        krawatte: false,
        hut: false,
        punk: false,
    };
}
