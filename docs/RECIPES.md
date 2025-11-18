# ONE.core Recipe System

Complete guide to creating and using ONE.core recipes for custom versioned objects.

## Overview

Recipes define schemas for ONE object types. They specify structure, validation, and relationships.

## Creating Versioned Objects

### 1. Define Interface

```typescript
interface Subject {
  $type$: 'Subject';
  id: string;  // ID property
  topic: SHA256IdHash<Topic>;
  keywords: SHA256IdHash<Keyword>[];
}
```

### 2. Extend Type System

```typescript
declare module '@OneObjectInterfaces' {
  export interface OneVersionedObjectInterfaces {
    Subject: Subject;
  }
}
```

### 3. Create Recipe

```typescript
const SubjectRecipe: Recipe = {
  $type$: 'Recipe',
  name: 'Subject',
  rule: [
    { itemprop: 'id', isId: true },  // Mark ID properties
    {
      itemprop: 'topic',
      itemtype: {
        type: 'referenceToId',
        allowedTypes: new Set(['Topic'])
      }
    },
    {
      itemprop: 'keywords',
      itemtype: {
        type: 'bag',
        item: {
          type: 'referenceToId',
          allowedTypes: new Set(['Keyword'])
        }
      }
    }
  ]
};
```

### 4. Register Recipe

```typescript
import { registerRecipes } from '@refinio/one.core/lib/recipes.js';
await registerRecipes([SubjectRecipe]);
```

### 5. Store and Sync

```typescript
import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';

const result = await storeVersionedObject(subject);
// Returns: { hash, idHash, versionHash }

await channelManager.postToChannel(topicId, subject);
```

## Common Pitfalls

### 1. Missing `rules: []` in Arrays

**WRONG**:
```typescript
{
  itemprop: 'devices',
  itemtype: {
    type: 'array',
    item: { type: 'object' }  // ❌ Missing rules
  }
}
```

**CORRECT**:
```typescript
{
  itemprop: 'devices',
  itemtype: {
    type: 'array',
    item: {
      type: 'object',
      rules: []  // ✅ Required!
    }
  }
}
```

### 2. Using `postToChannel()` Without Storing First

**WRONG**:
```typescript
await channelManager.postToChannel(topicId, subject);  // ❌ Not stored yet
```

**CORRECT**:
```typescript
await storeVersionedObject(subject);  // ✅ Store first
await channelManager.postToChannel(topicId, subject);  // ✅ Then post
```

### 3. Hash Type Confusion

```typescript
// SHA256Hash<T> - hash of complete object (specific version)
const objectHash: SHA256Hash<Subject> = result.hash;

// SHA256IdHash<T> - hash of only ID properties (all versions)
const idHash: SHA256IdHash<Subject> = result.idHash;

// Don't mix them!
```

## Object Categories

- **Unversioned**: No version tracking (Keys, VersionNode*)
- **Versioned**: ID properties support versioning (Person, Group, Recipe)
- **Virtual**: Binary/text data (BLOB, CLOB)

## Storage Patterns

```typescript
// Versioned objects (creates version DAG)
const result = await storeVersionedObject(subject);

// Unversioned objects
const hash = await storeUnversionedObject(keys);

// BLOB storage
import { storeArrayBufferAsBlob, readBlobAsArrayBuffer } from '@refinio/one.core/lib/storage-blob.js';
const blobHash = await storeArrayBufferAsBlob(arrayBuffer);
const data = await readBlobAsArrayBuffer(blobHash);
```

## Type Imports

Use `type` imports for ONE.core types (erased at runtime):

```typescript
import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Recipe } from '@refinio/one.core/lib/recipes.js';
```

## Reference

- Full documentation: `docs/one-core-fundamentals.md`
- Examples: `lama.core/recipes/`
