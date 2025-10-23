/**
 * LAMA Browser Platform Entry Point
 * Main thread ONE.core platform (following one.leute pattern)
 */

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

// Imported for the side effect of loading these certificate types
import '@refinio/one.models/lib/recipes/Certificates/AffirmationCertificate.js';
import '@refinio/one.models/lib/recipes/Certificates/TrustKeysCertificate.js';
import '@refinio/one.models/lib/recipes/Certificates/RightToDeclareTrustedKeysForEverybodyCertificate.js';
import '@refinio/one.models/lib/recipes/Certificates/RightToDeclareTrustedKeysForSelfCertificate.js';

// ============================================================================
// React and UI imports (AFTER platform loading)
// ============================================================================
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Model initialization (following one.leute pattern)
import Model, { setGlobalModel } from '@/model/Model.js'

/**
 * Start LAMA Browser application
 * CRITICAL: Do NOT call any storage methods before login
 * Storage is owner-specific and only available after login
 */
async function startLama(): Promise<void> {
  console.log('[LAMA] Starting application...');

  // Default comm server URL (can be made configurable later)
  const COMM_SERVER_URL = 'wss://comm10.dev.refinio.one';

  // Create model instance
  console.log('[LAMA] Creating Model...');
  const model = new Model(COMM_SERVER_URL);
  setGlobalModel(model);

  // Render UI - login screen will handle authentication
  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App model={model} />
      </React.StrictMode>
    );
    console.log('[LAMA] Application rendered');
  }
}

// Start the application
startLama().catch(err => console.error('[LAMA] Startup failed:', err));
