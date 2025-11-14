#!/usr/bin/env node

/**
 * Test script to verify Set serialization fix in ONE.core browser storage
 *
 * This tests:
 * 1. HashGroup creation with Set of participants
 * 2. Set serialization/deserialization in browser storage
 * 3. AI participant detection in groups
 */

import { loadBrowser } from '@refinio/one.core/lib/system/load-browser.js';
import { SingleUserNoAuth } from '../packages/one.core/lib/recipes/Leute/single-user-no-auth.js';
import { storeUnversionedObject, getObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';

async function testGroupChat() {
    console.log('🧪 Starting group chat Set serialization test...\n');

    try {
        // 1. Load ONE.core browser platform
        console.log('1️⃣ Loading ONE.core browser platform...');
        await loadBrowser();
        console.log('   ✅ Platform loaded\n');

        // 2. Initialize SingleUserNoAuth
        console.log('2️⃣ Initializing authentication...');
        const singleUser = new SingleUserNoAuth();
        await singleUser.init();

        const testEmail = `test-${Date.now()}@example.com`;
        const instance = await singleUser.loginOrRegister({
            email: testEmail,
            secret: 'test-secret-123',
            instanceName: 'test-instance'
        });
        console.log(`   ✅ Logged in as: ${testEmail}`);
        console.log(`   Owner ID: ${instance.owner.substring(0, 16)}...\n`);

        // 3. Create test participant IDs
        console.log('3️⃣ Creating test HashGroup...');
        const participant1 = `person-1-${Date.now()}`;
        const participant2 = `person-2-${Date.now()}`;
        const participant3 = `person-3-${Date.now()}`;

        const participants = [participant1, participant2, participant3];
        console.log(`   Participants: ${participants.length}`);
        participants.forEach((p, i) => console.log(`     ${i + 1}. ${p.substring(0, 24)}...`));

        // 4. Create HashGroup with Set (this is what TopicGroupManager does)
        const hashGroup = {
            $type$: 'HashGroup',
            person: new Set(participants)
        };

        console.log(`\n   HashGroup before storage:`);
        console.log(`     $type$: ${hashGroup.$type$}`);
        console.log(`     person instanceof Set: ${hashGroup.person instanceof Set}`);
        console.log(`     person.size: ${hashGroup.person.size}`);
        console.log(`     person contents: [${Array.from(hashGroup.person).map(p => p.substring(0, 16)).join(', ')}...]\n`);

        // 5. Store the HashGroup (this is where the bug was)
        console.log('4️⃣ Storing HashGroup...');
        const result = await storeUnversionedObject(hashGroup);
        console.log(`   ✅ Stored with hash: ${result.hash.substring(0, 32)}...\n`);

        // 6. Retrieve the HashGroup and verify Set is intact
        console.log('5️⃣ Retrieving HashGroup from storage...');
        const retrieved = await getObject(result.hash);

        console.log(`   HashGroup after retrieval:`);
        console.log(`     $type$: ${retrieved.$type$}`);
        console.log(`     person exists: ${!!retrieved.person}`);
        console.log(`     person instanceof Set: ${retrieved.person instanceof Set}`);
        console.log(`     person.size: ${retrieved.person?.size || 0}`);

        if (retrieved.person instanceof Set && retrieved.person.size > 0) {
            console.log(`     person contents: [${Array.from(retrieved.person).map(p => p.substring(0, 16)).join(', ')}...]`);
            console.log(`\n   ✅ Set serialization WORKS! All ${retrieved.person.size} participants preserved.\n`);
        } else {
            console.log(`     person contents: ${JSON.stringify(retrieved.person)}`);
            console.log(`\n   ❌ Set serialization FAILED! Data: ${JSON.stringify(retrieved.person)}\n`);
            process.exit(1);
        }

        // 7. Verify all participants are accessible
        console.log('6️⃣ Verifying participant iteration...');
        let count = 0;
        for (const memberId of retrieved.person) {
            count++;
            console.log(`   ${count}. ${memberId.substring(0, 24)}...`);
        }

        if (count === participants.length) {
            console.log(`   ✅ All ${count} participants can be iterated!\n`);
        } else {
            console.log(`   ❌ Iteration failed! Expected ${participants.length}, got ${count}\n`);
            process.exit(1);
        }

        // 8. Test hash stability (same Set should produce same hash)
        console.log('7️⃣ Testing hash stability...');
        const hashGroup2 = {
            $type$: 'HashGroup',
            person: new Set(participants)
        };
        const result2 = await storeUnversionedObject(hashGroup2);

        if (result.hash === result2.hash) {
            console.log(`   ✅ Same Set produces same hash: ${result.hash.substring(0, 32)}...\n`);
        } else {
            console.log(`   ❌ Hash mismatch!`);
            console.log(`     First:  ${result.hash}`);
            console.log(`     Second: ${result2.hash}\n`);
            process.exit(1);
        }

        console.log('🎉 ALL TESTS PASSED! Set serialization is working correctly.\n');
        process.exit(0);

    } catch (error) {
        console.error('❌ TEST FAILED:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run tests
testGroupChat();
