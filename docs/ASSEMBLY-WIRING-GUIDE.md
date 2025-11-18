# Assembly System Wiring Guide

## Overview

This guide explains how to wire up the Assembly infrastructure to connect:
- **Journal** (conversations) → **Assemblies** (knowledge extraction)
- **Contacts** (trust relationships) → **Supply filtering** (information markets)
- **Assembly Supply View** → **Active supplies** (what you're sharing)

## Architecture

```
┌─────────────────┐
│  Journal/Chat   │  User has conversations
└────────┬────────┘
         │
         v
┌─────────────────┐
│ KnowledgeAssembly│ Extracts subjects, keywords
└────────┬────────┘
         │
         v
┌─────────────────┐
│ AssemblyManager │  Creates Assembly + Supply
└────────┬────────┘
         │
         ├──────────────────┐
         v                  v
┌──────────────┐    ┌──────────────┐
│   Supply     │    │   Demand     │
│  (offering)  │    │  (seeking)   │
└──────┬───────┘    └──────┬───────┘
       │                   │
       v                   v
┌─────────────────────────────┐
│  Trust-Based Matching       │
│  (contacts with trust level)│
└─────────────────────────────┘
```

## Components Created

### 1. Core Recipes (`packages/one.knowledge/src/recipes/`)

- **Supply.ts** - What you're offering to the network
  - Trust levels: `me`, `high`, `medium`, `low`
  - Contains: keywords, subjects, verifiable credentials
  - Helper: `canAccessSupply(supply, requesterId, trustLevel)`

- **Demand.ts** - What you're seeking from the network
  - Contains: keywords, subjects, trust requirements
  - Helper: `calculateMatchScore(demand, supply)`

- **Assembly.ts** (updated) - Now includes:
  - `supplyId?: SHA256IdHash<Supply>`
  - `demandIds?: SHA256IdHash<Demand>[]`
  - `storyRef?: string`

### 2. Manager Service (`packages/one.knowledge/src/models/`)

- **AssemblyManager.ts** - Orchestrates the flow:
  - Listens to `KnowledgeAssembly.onAssemblyComplete`
  - Auto-creates Supply objects from Assemblies
  - Manages trust levels per identity
  - Matches Demand to Supply
  - Enforces trust-based filtering

### 3. UI Components (`lama.ui/src/components/`)

- **journal/ConversationList.tsx** - Shows conversations
- **device/AssemblySupplyView.tsx** - Shows active supplies (updated import)
- **device/UnifiedDevicesView.tsx** - Shows contacts with trust levels

## Integration Steps

### Step 1: Initialize AssemblyManager

In your main application (e.g., `lama.cube`, `lama.browser`):

```typescript
import { KnowledgeAssembly, AssemblyManager } from '@refinio/one.knowledge'

// Initialize with your TopicModel and LeuteModel
const knowledgeAssembly = new KnowledgeAssembly(topicModel, leuteModel)
const assemblyManager = new AssemblyManager(
  knowledgeAssembly,
  myIdentityId,  // Your identity hash
  {
    defaultTrustLevel: 'medium',
    autoCreateSupply: true,
    minKeywordsForSupply: 3,
    matchScoreThreshold: 0.5
  }
)

await assemblyManager.init()
```

### Step 2: Set Up Trust Levels

When contacts are added or trust changes:

```typescript
// In your contact management code
assemblyManager.setTrustLevel(contactPersonId, 'trusted')

// Trust hierarchy: me > high > medium > low
// - 'me': Private, share settings (IoM - Internet of Me)
// - 'high': Trusted contacts
// - 'medium': Verified contacts
// - 'low': Public/unknown
```

### Step 3: Wire Journal to Assemblies

When a conversation happens in the Journal:

```typescript
// The KnowledgeAssembly is already listening to TopicModel
// It automatically processes new messages and emits events

// Listen for assembly creation
assemblyManager.onAssemblyCreated.listen((assembly) => {
  console.log('New assembly created:', assembly.assemblyId)
  console.log('Subjects:', assembly.currentState.subjectIds)
  console.log('Keywords:', assembly.currentState.keywordIds)
})

// Listen for supply creation
assemblyManager.onSupplyCreated.listen((supply) => {
  console.log('New supply created:', supply.domain)
  console.log('Trust level:', supply.trustLevel)
  console.log('Keywords:', supply.keywords.length)
})
```

### Step 4: Connect AssemblySupplyView

In your UI where you show supplies:

```typescript
import { AssemblySupplyView, type AssemblyWithSupply } from '@lama/lama.ui'

function MySuppliesPage() {
  const [assemblies, setAssemblies] = useState<AssemblyWithSupply[]>([])

  useEffect(() => {
    // Get all active supplies from AssemblyManager
    const supplies = assemblyManager.getActiveSupplies()

    // Convert to AssemblyWithSupply format
    const assemblySupplies = supplies.map(supply => ({
      id: supply.ownerId,  // or generate unique ID
      storyRef: '',  // if you have story reference
      supply,
      created: supply.createdAt.getTime(),
      matchScore: supply.reputationScore,
      status: supply.status
    }))

    setAssemblies(assemblySupplies)

    // Listen for updates
    const unsubscribe = assemblyManager.onMarketUpdate.listen(() => {
      // Reload supplies
      const updated = assemblyManager.getActiveSupplies()
      // ... update state
    })

    return () => unsubscribe()
  }, [])

  return (
    <AssemblySupplyView
      assemblies={assemblies}
      onEditSupply={(id) => {/* edit logic */}}
      onRevokeSupply={(id) => {/* revoke logic */}}
      resolveKeyword={async (hash) => {
        // Resolve keyword hash to human-readable term
        const keyword = await loadKeyword(hash)
        return keyword.keyword
      }}
      resolveSubject={async (hash) => {
        // Resolve subject hash to name
        const subject = await loadSubject(hash)
        return subject.title
      }}
    />
  )
}
```

### Step 5: Connect UnifiedDevicesView

In your devices/contacts view:

```typescript
import { UnifiedDevicesView, type DevicePlatformAdapter } from '@lama/lama.ui'

// Implement the adapter interface
const deviceAdapter: DevicePlatformAdapter = {
  getInstanceInfo: async () => {
    // Return current instance info
    return { success: true, instance: { ... } }
  },

  getContacts: async () => {
    // Get contacts from LeuteModel
    const contacts = await leuteModel.getContacts()
    return { success: true, contacts }
  },

  getTrustLevels: async () => {
    // Get trust levels from AssemblyManager
    const levels = {}
    for (const contact of contacts) {
      levels[contact.personId] = assemblyManager.getTrustLevel(contact.personId)
    }
    return { success: true, trustLevels: levels }
  },

  setTrustLevel: async (instanceId, trustLevel) => {
    // Update trust level in AssemblyManager
    assemblyManager.setTrustLevel(instanceId, trustLevel)
    return { success: true }
  },

  createInvitation: async () => {
    // Create invitation using your connection plan
    const invitation = await connectionPlan.createInvitation()
    return { success: true, invitation }
  },

  getDiscoveredDevices: async () => {
    // Get QuicVC discovered devices
    return { success: true, devices: [] }
  },

  scanForDevices: async (timeout) => {
    // Scan for devices
    return { success: true, devices: [] }
  }
}

function MyDevicesPage() {
  return <UnifiedDevicesView adapter={deviceAdapter} />
}
```

### Step 6: Create Demand Objects

When a user needs information:

```typescript
// User searching for something
const keywords = ['climate', 'policy', 'renewable']  // SHA256 hashes in real code
const demand = await assemblyManager.createDemand(
  keywords,
  {
    domain: 'environment',
    query: 'Looking for climate policy information',
    trustRequired: 'medium',
    urgency: 'high'
  }
)

// Listen for matches
assemblyManager.onDemandMatched.listen((demand, matches) => {
  console.log(`Found ${matches.length} matching supplies`)
  matches.forEach(match => {
    console.log(`Supply ${match.supplyId} - Score: ${match.score}`)
    console.log(`  Keywords matched: ${match.keywordMatches}`)
    console.log(`  Trust met: ${match.trustMet}`)
  })
})
```

## Data Flow Example

1. **User has a conversation** in the Journal about "climate policy"

2. **KnowledgeAssembly** processes the messages:
   - Extracts subjects: ["climate policy", "renewable energy"]
   - Extracts keywords: ["climate", "policy", "renewable", "energy", "carbon"]
   - Builds knowledge graph
   - Emits `onAssemblyComplete`

3. **AssemblyManager** receives the assembly:
   - Creates AssemblyData with construction history
   - Auto-creates Supply if >= 3 keywords
   - Supply has:
     - `trustLevel: 'medium'` (default)
     - `domain: 'general'`
     - `keywords: [hash1, hash2, ...]`
     - `subjects: [subjectHash1, ...]`

4. **Another user creates a Demand** for "climate information":
   - Keywords: ["climate", "policy"]
   - Trust required: "medium"
   - AssemblyManager matches against supplies

5. **Match calculation**:
   - Keyword overlap: 2/2 = 100% match
   - Trust check: supply is "medium", demand requires "medium" ✓
   - Match score: 0.7 (keyword weight)
   - Supply returned to requester

6. **UI updates**:
   - AssemblySupplyView shows the supply
   - UnifiedDevicesView shows requester with "medium" trust badge
   - Journal shows knowledge extracted

## Trust-Based Filtering

```typescript
// Trust hierarchy
const hierarchy = {
  me: 4,      // Private - only you can see
  high: 3,    // Trusted contacts
  medium: 2,  // Verified contacts
  low: 1      // Public/unknown
}

// Access rules:
// - Supply with trust "high" can be accessed by: me, high
// - Supply with trust "medium" can be accessed by: me, high, medium
// - Supply with trust "low" can be accessed by: everyone

// Example:
const supply = { trustLevel: 'high', ... }
const requester = { trustLevel: 'medium' }

canAccessSupply(supply, requesterId, requester.trustLevel)
// Returns: false (requester trust too low)
```

## Events to Listen To

```typescript
// Assembly events
assemblyManager.onAssemblyCreated.listen((assembly) => {
  // New assembly created from conversation
})

assemblyManager.onSupplyCreated.listen((supply) => {
  // New supply offering created
})

assemblyManager.onDemandMatched.listen((demand, matches) => {
  // Demand matched to supplies
})

assemblyManager.onMarketUpdate.listen(() => {
  // General market state changed - refresh UI
})

// Knowledge assembly events
knowledgeAssembly.onSubjectExtracted.listen((subject) => {
  // New subject discovered
})

knowledgeAssembly.onKeywordExtracted.listen((keyword) => {
  // New keyword extracted
})

knowledgeAssembly.onKnowledgeGraphUpdated.listen((graph) => {
  // Knowledge graph structure changed
})
```

## Next Steps

1. **Persistence**: Store Assemblies, Supplies, Demands in ONE storage
2. **Network Sync**: Replicate supplies across federation based on trust
3. **UI Polish**: Add filters, search, visualization to AssemblySupplyView
4. **Matching Algorithm**: Enhance with semantic similarity, embeddings
5. **Reputation System**: Calculate reputation scores from verified interactions
6. **Story Integration**: Connect to Story objects for Plan/Story memoization

## Platform-Specific Integration

### lama.cube (Electron)
- Initialize AssemblyManager in main process
- Expose via IPC to renderer
- Store in local SQLite database

### lama.browser (Web)
- Initialize in service worker
- Use IndexedDB for storage
- Sync via WebRTC/WebSocket

### lama (Mobile)
- Initialize in native module
- Use SQLite for storage
- Background sync when online

## File Locations

```
packages/one.knowledge/
├── src/
│   ├── recipes/
│   │   ├── Supply.ts        ✓ Created
│   │   ├── Demand.ts        ✓ Created
│   │   ├── Assembly.ts      ✓ Updated
│   │   ├── Subject.ts       ✓ Existing
│   │   └── Keyword.ts       ✓ Existing
│   ├── models/
│   │   ├── AssemblyManager.ts    ✓ Created
│   │   └── KnowledgeAssembly.ts  ✓ Existing
│   └── index.ts             ✓ Updated (exports)

lama.ui/src/components/
├── journal/
│   ├── ConversationList.tsx ✓ Existing
│   └── ConversationCard.tsx ✓ Existing
└── device/
    ├── AssemblySupplyView.tsx     ✓ Updated imports
    └── UnifiedDevicesView.tsx     ✓ Existing

docs/
└── ASSEMBLY-WIRING-GUIDE.md       ✓ This file
```

## Testing the Flow

```typescript
// 1. Create a test conversation
const topic = await topicModel.createTopic({ name: 'Climate Discussion' })
const room = await topicModel.enterTopicRoom(topic.id)

await room.sendMessage({
  content: 'We should focus on renewable energy and climate policy changes.'
})

await room.sendMessage({
  content: 'The new carbon tax policy will impact industrial emissions significantly.'
})

// 2. Wait for assembly (should auto-trigger)
assemblyManager.onSupplyCreated.listen((supply) => {
  console.log('Supply created!')
  console.log('Keywords:', supply.keywords.length)
  console.log('Trust level:', supply.trustLevel)

  // Supply should contain keywords like:
  // - renewable, energy, climate, policy, carbon, tax, emissions
})

// 3. Create a demand
const demand = await assemblyManager.createDemand(
  [/* keyword hashes for 'climate', 'policy' */],
  { trustRequired: 'medium', urgency: 'high' }
)

// 4. Should match!
// onDemandMatched will fire with the supply as a match
```

## Troubleshooting

**Supply not created:**
- Check keyword count >= minKeywordsForSupply (default: 3)
- Verify autoCreateSupply is true in config
- Check console for KnowledgeAssembly errors

**Demand not matching:**
- Verify trust levels: supply.trustLevel vs demand.trustRequired
- Check keyword overlap (need >= matchScoreThreshold)
- Ensure supply status is 'active'

**UI not updating:**
- Check event listeners are connected
- Verify AssemblyManager.init() was called
- Check adapter implementations

---

**Status**: Infrastructure complete. Ready for platform-specific integration.
