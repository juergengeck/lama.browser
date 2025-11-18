#!/usr/bin/env node

/**
 * Verify that invitation URLs use the correct commserver
 */

import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const TEST_STORAGE = path.join(os.tmpdir(), 'lama-invitation-test');

console.log('\n🔍 Testing Invitation URL Fix\n');
console.log('==============================\n');

// Clean up test storage
try {
    await fs.rm(TEST_STORAGE, { recursive: true, force: true });
    console.log('✅ Cleaned test storage\n');
} catch (err) {
    // Ignore
}

// Set test config
global.lamaConfig = {
    commServer: { url: 'ws://localhost:8000' },
    instance: { directory: TEST_STORAGE }
};

console.log('📝 Configuration:');
console.log('   CommServer URL:', global.lamaConfig.commServer.url);
console.log('   Storage:', TEST_STORAGE);
console.log('');

// Import NodeOneCore
const { default: nodeOneCore } = await import('./lama.electron/dist/main/core/node-one-core.js');

// Initialize instance
console.log('🚀 Initializing NodeOneCore...');
const result = await nodeOneCore.initialize('test-user', 'test-password');

if (!result.success) {
    console.error('❌ Failed to initialize:', result.error);
    process.exit(1);
}

console.log('✅ NodeOneCore initialized');
console.log('   Owner ID:', result.ownerId?.substring(0, 8) + '...');
console.log('');

// Check if commServerUrl is set
console.log('🔍 Checking NodeOneCore.commServerUrl property:');
console.log('   nodeOneCore.commServerUrl =', nodeOneCore.commServerUrl);
console.log('');

if (nodeOneCore.commServerUrl === 'ws://localhost:8000') {
    console.log('✅ commServerUrl property is set correctly!');
} else {
    console.log('❌ commServerUrl property is NOT set correctly!');
    console.log('   Expected: ws://localhost:8000');
    console.log('   Got:', nodeOneCore.commServerUrl);
}
console.log('');

// Try to create an invitation
if (nodeOneCore.connectionsModel && nodeOneCore.connectionsModel.pairing) {
    console.log('🎫 Creating pairing invitation...');

    try {
        const invitation = await nodeOneCore.connectionsModel.pairing.createInvitation();

        console.log('✅ Invitation created!');
        console.log('   Token:', invitation.token?.substring(0, 20) + '...');
        console.log('   URL:', invitation.url);
        console.log('');

        if (invitation.url === 'ws://localhost:8000') {
            console.log('✅ SUCCESS! Invitation URL is correct: ws://localhost:8000');
        } else {
            console.log('❌ FAILURE! Invitation URL is wrong:');
            console.log('   Expected: ws://localhost:8000');
            console.log('   Got:', invitation.url);
        }
    } catch (error) {
        console.error('❌ Failed to create invitation:', error.message);
    }
} else {
    console.log('⚠️  Pairing module not available');
}
console.log('');

// Cleanup
await nodeOneCore.shutdown();
await fs.rm(TEST_STORAGE, { recursive: true, force: true });
console.log('✅ Cleanup complete\n');
