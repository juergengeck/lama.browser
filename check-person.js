// Quick script to inspect a Person object
import '@refinio/one.core/lib/system/load-browser.js';
import { getIdObject } from '@refinio/one.core/lib/storage-versioned-objects.js';

const personIdPrefix = '63ba24e2'; // The truncated ID from the warning

console.log('This would check the Person object, but we need the full hash');
console.log('The warning shows: Person 63ba24e2... (truncated)');
console.log('This is likely an old Person from storage without name/email fields');
