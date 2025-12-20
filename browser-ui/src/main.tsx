/**
 * LAMA Browser Platform Entry Point
 * Main thread ONE.core platform (following one.leute pattern)
 */

// ============================================================================
// WARMUP: Pre-import dependencies that workers use to prevent Vite reload
// This forces Vite to optimize these before workers discover them
// ============================================================================
import '@huggingface/transformers';

// Initialize API logger for test automation (dev mode only)
import './services/api-logger';

// ============================================================================
// CRITICAL: Load ONE.core browser platform FIRST (before any other imports)
// ============================================================================
console.log('[main.tsx] INSTANCE CHECK: Loading ONE.core platform modules...');
import '@refinio/one.core/lib/system/load-browser.js';

// Load browser platform modules (side effects)
import '@refinio/one.core/lib/system/browser/crypto-helpers.js';
import '@refinio/one.core/lib/system/browser/crypto-scrypt.js';
import '@refinio/one.core/lib/system/browser/settings-store.js';
import '@refinio/one.core/lib/system/browser/storage-base.js';
import '@refinio/one.core/lib/system/browser/storage-base-delete-file.js';
import '@refinio/one.core/lib/system/browser/storage-streams.js';

// DIAGNOSTIC: Check versionedObjects after platform load
import { DEBUG_versionedObjects as versionedObjects } from '@refinio/one.core/lib/object-recipes.js';
if (!(versionedObjects as any).__INSTANCE_ID) {
  (versionedObjects as any).__INSTANCE_ID = 'MAIN_TX_' + Date.now();
  console.log('[main.tsx] INSTANCE CHECK: Created instance ID:', (versionedObjects as any).__INSTANCE_ID);
  console.log('[main.tsx] INSTANCE CHECK: versionedObjects initial size:', versionedObjects.size);
} else {
  console.log('[main.tsx] INSTANCE CHECK: Found existing instance ID:', (versionedObjects as any).__INSTANCE_ID);
}

// ============================================================================
// React and UI imports (AFTER platform loading)
// ============================================================================
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Model initialization (following one.leute pattern)
import Model, { setGlobalModel } from '@/model/Model.js'
import { sessionStorage } from '@/services/session-storage'

/**
 * Initialize browser storage and request persistent storage.
 * Following one.leute pattern - this MUST happen before any storage operations.
 */
async function initializeStorage(): Promise<void> {
  try {
    // Request persistent storage to prevent browser eviction
    const isPersisted = await navigator.storage.persist();
    if (isPersisted) {
      console.log('[LAMA] ✅ Storage persisted successfully');
    } else {
      console.warn('[LAMA] ⚠️ Storage persistence not granted - data may be evicted');
    }
  } catch (error) {
    console.error('[LAMA] Failed to request persistent storage:', error);
    // Don't throw - storage can still work without persistence guarantee
  }
}

/**
 * Start LAMA Browser application
 * CRITICAL: Initialize storage BEFORE any storage operations
 */
async function startLama(): Promise<void> {
  console.log('[LAMA] Starting application...');

  // CRITICAL: Initialize storage FIRST (following one.leute pattern)
  // This ensures IndexedDB is ready before we check credentials
  await initializeStorage();

  // Read comm server URL from environment or use default
  const COMM_SERVER_URL = import.meta.env.VITE_COMM_SERVER_URL || 'wss://comm10.dev.refinio.one';
  console.log('[LAMA] Using CommServer:', COMM_SERVER_URL);

  // Read web URL for invite links (NOT the commServer URL)
  const WEB_URL = import.meta.env.VITE_WEB_URL || 'https://lama.one';
  console.log('[LAMA] Using Web URL for invites:', WEB_URL);

  // Create model instance
  console.log('[LAMA] Creating Model...');
  const model = new Model(COMM_SERVER_URL, WEB_URL);
  setGlobalModel(model);

  // Auto-login if credentials are stored (one.leute pattern for seamless reload)
  const storedCredentials = sessionStorage.getCredentials();
  if (storedCredentials) {
    console.log('[LAMA] Found stored credentials, attempting auto-login...');
    try {
      await model.one.loginOrRegister(
        storedCredentials.email,
        storedCredentials.secret,
        storedCredentials.instanceName
      );
      console.log('[LAMA] Auto-login successful');
    } catch (error) {
      console.error('[LAMA] Auto-login failed, clearing credentials:', error);
      sessionStorage.clearCredentials();
    }
  }

  // Expose model on window for debugging (dev mode only)
  if (import.meta.env.DEV) {
    (window as any).__model = model;
    console.log('[LAMA] Model exposed on window.__model for debugging');
  }

  // Add page reload detection for debugging persistence issues
  window.addEventListener('beforeunload', (event) => {
    console.log('[LAMA] 🔍 PERSISTENCE DEBUG: Page is about to reload/close!');
    console.log('[LAMA] 🔍 Event:', event);
    console.log('[LAMA] 🔍 This should NOT happen during normal operation');
    console.trace('[LAMA] 🔍 Stack trace at beforeunload');
  });

  // Log any unhandled errors that might cause reloads
  window.addEventListener('error', (event) => {
    console.error('[LAMA] 🔍 UNHANDLED ERROR:', event.error);
    console.error('[LAMA] 🔍 Message:', event.message);
    console.error('[LAMA] 🔍 Filename:', event.filename);
    console.error('[LAMA] 🔍 This error might trigger a page reload');
  });

  // Render UI - login screen will handle authentication
  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      // StrictMode disabled temporarily to debug restart issues
      // <React.StrictMode>
        <App model={model} />
      // </React.StrictMode>
    );
    console.log('[LAMA] Application rendered');
  }
}

// Start the application
startLama().catch(err => console.error('[LAMA] Startup failed:', err));
