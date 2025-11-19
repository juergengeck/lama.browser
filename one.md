# ONE.core Architecture Documentation

## Overview

ONE.core is a TypeScript/JavaScript framework for building distributed, versioned data systems using a microdata-based object model. It provides cryptographic object hashing, versioning, access control, and synchronization capabilities.

## Core Concepts

### ONE Objects

ONE objects are structured data entities with:
- A `$type$` property identifying the object type
- Properties defined by recipes
- Automatic conversion between JavaScript objects and HTML microdata format
- SHA-256 hashing for content-addressable storage

**CRITICAL**: Microdata format is STRICTLY ordered and formatted:
- Properties MUST appear in recipe-defined order
- NO extra spaces or newlines (except in property values)
- One wrong character = different hash = invalid object

Example microdata representation:
```html
<div itemscope itemtype="//refin.io/Person"><span itemprop="email">user@example.com</span><span itemprop="name">John Doe</span></div>
```

(Human-readable version with indentation added for documentation only - actual storage has no whitespace)

### Object Types

#### Unversioned Objects
- Immutable objects without version tracking
- Examples: `Keys`, `VersionNode*` types
- Direct hash-based storage and retrieval

#### Versioned Objects
- Objects with ID properties (`isId: true` in recipe)
- Support multiple versions with same identity
- Examples: `Person`, `Instance`, `Group`, `Recipe`
- Version tracking through `VersionNode` structures

### Recipes

Recipes define the structure and validation rules for ONE object types:

```typescript
{
  $type$: 'Recipe',
  name: 'Person',  // Type name
  rule: [
    {
      itemprop: 'email',
      isId: true,  // This is an ID property
      itemtype: { type: 'string' }
    },
    {
      itemprop: 'name',
      optional: true
    }
  ]
}
```

#### Recipe Rules

Each rule defines a property with:
- `itemprop`: Property name
- `itemtype`: Value type specification
- `isId`: Whether it's part of object identity
- `optional`: Whether the property is optional
- `inheritFrom`: Inherit rule from another recipe

#### Value Types

Supported value types include:
- Primitives: `string`, `integer`, `number`, `boolean`
- References: `referenceToObj`, `referenceToId`, `referenceToClob`, `referenceToBlob`
- Collections: `array`, `set`, `bag` (multiset), `map`
- Complex: `object` (nested rules), `stringifiable` (JSON)

## Core Object Types

### Instance
Central configuration object for a ONE.core instance:
- `name`: Instance identifier
- `owner`: Reference to Person ID (instance owner)
- `recipe`: Set of Recipe objects defining known types
- `enabledReverseMapTypes`: Configuration for reverse mapping

### Person
Represents an identity in the system:
- `email`: Unique identifier (ID property)
- `name`: Optional display name

### Access/IdAccess
Access control objects:
- `Access`: Grants access to specific object versions
- `IdAccess`: Grants access to all versions of an object
- References to Person and Group objects define who has access

### Keys
Stores public cryptographic keys:
- `owner`: Instance or Person ID
- `publicKey`: Encryption public key
- `publicSignKey`: Signing public key

### Chum
Manages data synchronization between instances:
- Tracks exchanged objects between two instances
- Records transfer history (AtoBObjects, BtoAObjects, etc.)
- Maintains synchronization state

### Group
Collection of Person references for access control:
- `name`: Group identifier (ID property)
- `person`: Array of Person ID references

### Version Nodes
Track object version history:
- `VersionNodeEdge`: Initial version (no predecessor)
- `VersionNodeChange`: Sequential update from previous version
- `VersionNodeMerge`: Combines multiple version branches

## Storage Architecture

### Hash-Based Storage
- Objects stored by SHA-256 hash
- Content-addressable filesystem
- Separate storage for objects, ID objects, BLOBs, CLOBs

### ID Hashes

**Critical Distinction**: ID hashes vs object hashes serve different purposes:

**Object Hash** (`SHA256Hash<T>`):
- Hash of the COMPLETE object with ALL properties
- Uniquely identifies ONE SPECIFIC version
- Returned by `calculateHashOfObj(obj)`

**ID Hash** (`SHA256IdHash<T>`):
- Hash of ONLY the `isId: true` properties
- Identifies ALL VERSIONS of the same logical object
- Includes virtual `data-id-object="true"` attribute in microdata
- Returned by `calculateIdHashOfObj(obj)`

Example Person object:
```typescript
const person = {
  $type$: 'Person',
  email: 'foo@bar.com',  // isId: true
  name: 'John Doe'        // not an ID property
};

// Object hash: e2912ff8... (includes name)
// ID hash: 400d6354... (only email + data-id-object attribute)
```

**Why the difference matters**:
- Changing `name` creates NEW object hash but SAME ID hash
- Version maps stored under ID hash track all versions
- `getObjectByIdHash()` returns LATEST version
- `getObject()` returns SPECIFIC version by object hash

### Reverse Mapping

**Critical for Queries**: Reverse maps enable finding references UP the tree (from referenced to referencing objects).

**Storage Format**: `reverse-maps/[hash].[H|I].to.[type]`
- `H` = object hash, `I` = ID hash
- Content: `targetHash,referencingIdHash,referencingHash` (one per line)

**Configuration**: Set during instance init via `initiallyEnabledReverseMapTypes`:
```typescript
await initInstance({
  // ... other options
  initiallyEnabledReverseMapTypes: new Map([
    ['ChatMessage', new Set(['topic', 'author'])],
    ['ChatAttachment', new Set(['message'])]
  ])
});
```

**Why This Matters**:
- WITHOUT reverse maps: Cannot query "find all messages in topic X"
- WITH reverse maps: Can efficiently traverse from Topic → Messages
- Reverse maps are OPTIONAL and configurable per type/property
- **Discovery/Package visibility issues**: Often caused by missing reverse map configuration

## Instance Initialization

```typescript
await initInstance({
  name: 'MyInstance',
  email: 'user@example.com',
  secret: 'password',
  directory: '/path/to/storage',
  initialRecipes: [...],
  encryptStorage: true
});
```

Key initialization steps:
1. Calculate instance ID hash from name + email
2. Initialize storage system
3. Create or load Instance object
4. Load and register recipes
5. Configure reverse mapping
6. Unlock keychain with secret

## Recipe Registration

Recipes must be registered before use:

```typescript
addRecipeToRuntime({
  $type$: 'Recipe',
  name: 'MyType',
  rule: [
    { itemprop: 'id', isId: true },
    { itemprop: 'data', itemtype: { type: 'string' } }
  ]
});
```

## Object Operations

### Creating Objects
```typescript
const obj = {
  $type$: 'Person',
  email: 'user@example.com',
  name: 'John Doe'
};
```

### Calculating Hashes
```typescript
// Regular object hash
const hash = await calculateHashOfObj(obj);

// ID hash for versioned objects
const idHash = await calculateIdHashOfObj(obj);
```

### Storage Strategies
- `STORE_AS.CHANGE`: Normal sequential update (default)
- `STORE_AS.MERGE`: Combine changes from multiple sources
- `STORE_AS.NO_VERSION_MAP`: Store without version tracking

## Type System

### TypeScript Integration
ONE.core uses declaration merging for extensible typing:

1. Core types in `@OneObjectInterfaces` module
2. Applications extend with their own types
3. Automatic union types for all registered types

Example extension:
```typescript
declare module '@OneObjectInterfaces' {
  export interface OneVersionedObjectInterfaces {
    MyCustomType: MyCustomType;
  }
}
```

## Key Features

### Cryptographic Security
- All objects are SHA-256 hashed
- Content integrity verification
- Public key infrastructure for encryption/signing

### Versioning
- Automatic version tracking for ID objects
- Version trees with merge capabilities
- Immutable version history

### Distribution
- Chum-based synchronization between instances
- Access control propagation
- Conflict-free replicated data types (CRDT) support

### Platform Support
- Node.js (filesystem storage)
- Browser (IndexedDB storage)
- React Native (mobile storage)

## Reading Objects vs Reading Blobs

**CRITICAL CONCEPT**: References in ONE.core are layers of indirection. Reading an object that contains a reference does NOT automatically read the referenced data.

### Example: ChatMessage with Attachments

```typescript
interface ChatMessage {
  $type$: 'ChatMessage';
  content: string;
  attachments?: SHA256Hash<ChatAttachment>[];  // Array of REFERENCES
}

interface ChatAttachment {
  $type$: 'ChatAttachment';
  type: 'BlobDescriptor';  // Type indicator
  blobDescriptor: SHA256Hash<BlobDescriptor>;  // Reference to descriptor
}

interface BlobDescriptor {
  $type$: 'BlobDescriptor';
  blob: SHA256Hash<BLOB>;  // Reference to actual file
  fileName: string;
  mimeType: string;
  size: number;
}
```

### The Indirection Chain

To get from message → actual file requires **3 separate fetches**:

```typescript
// 1. Read message (gives you attachment HASHES)
const message = await getObject(messageHash);
const attachmentHash = message.attachments[0];

// 2. Read attachment object (gives you BlobDescriptor HASH)
const attachment = await getObject(attachmentHash);
const blobDescHash = attachment.blobDescriptor;

// 3. Read blob descriptor (gives you BLOB HASH + metadata)
const blobDesc = await getObject(blobDescHash);
const blobHash = blobDesc.blob;

// 4. FINALLY read the actual file data
const fileData = await readBlobAsArrayBuffer(blobHash);
```

### Key Principle

**Reading a reference gives you the REFERENCED OBJECT, not the data it points to.**

This is intentional:
- Objects are metadata/structure
- BLOBs are raw data
- Separation allows efficient querying without loading all file data
- Each layer has different caching/access patterns

### Recipe Pattern

When defining attachment arrays in recipes:

```typescript
{
  itemprop: 'attachments',
  itemtype: {
    type: 'array',
    item: {
      type: 'referenceToObj',
      allowedTypes: new Set(['ChatAttachment'])
    }
  }
}
```

**NOT**:
```typescript
// ❌ WRONG - Don't try to embed metadata structure
{
  itemprop: 'attachments',
  itemtype: {
    type: 'array',
    item: {
      type: 'object',
      rules: [
        { itemprop: 'hash', itemtype: { type: 'string' } },
        { itemprop: 'type', itemtype: { type: 'string' } }
      ]
    }
  }
}
```

The metadata IS the ChatAttachment object. Fetch it by hash.

## Best Practices

1. **Recipe Design**
   - Mark identifying properties with `isId: true`
   - Use appropriate value types for validation
   - Consider inheritance for common patterns

2. **Storage**
   - Enable encryption for sensitive data
   - Configure appropriate reverse mapping
   - Use hierarchical storage for large deployments

3. **Versioning**
   - Use CHANGE for normal updates
   - Use MERGE for distributed changes
   - Maintain version history for audit trails

4. **Type Safety**
   - Define TypeScript interfaces for all object types
   - Use type guards and validators
   - Leverage declaration merging for extensibility

## Common Patterns

### Creating a Versioned Object Type
1. Define the TypeScript interface
2. Create and register the Recipe
3. Configure reverse mapping if needed
4. Implement creation and storage logic

### Access Control
1. Create Access/IdAccess objects
2. Reference Person/Group IDs
3. Store with appropriate object references
4. Propagate through Chum synchronization

### Instance Communication
1. Establish Chum relationship
2. Exchange Person credentials
3. Synchronize objects based on access rights
4. Track transfer history

## Error Handling

ONE.core uses coded errors with specific prefixes:
- `IN-*`: Instance errors
- `OR-*`: Object/Recipe errors
- `UO-*`: Utility/Object errors

Always handle storage and network operations with appropriate error catching.
