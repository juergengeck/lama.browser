# lama.browser Plan Registry Integration

**Keep ONE.core, add PlanRegistry for consistency**

## Key Point

lama.browser is **fully self-contained** - it runs ONE.core in the browser via IndexedDB. This is intentional and correct!

What we're adding: **PlanRegistry pattern** for internal architecture consistency, not to become a thin client.

## Architecture

```
┌──────────────────────────────────────────┐
│         lama.browser (Standalone)        │
│                                          │
│  React UI                                │
│       ↓                                  │
│  PlanRegistry (local)                    │
│    - one.storage                         │
│    - one.leute                           │
│    - lama.memory                         │
│    - lama.chatMemory                     │
│       ↓                                  │
│  ONE.core (IndexedDB)                    │
│  ONE.models                              │
└──────────────────────────────────────────┘
```

## Why Use PlanRegistry in Browser?

1. **Consistency** - Same API pattern as electron/worker
2. **Story objects** - Transaction audit trail
3. **Easy migration** - Components work across platforms
4. **Type safety** - Same typed interfaces everywhere
5. **Future flexibility** - Can optionally connect to remote later

## Implementation

### Step 1: Initialize PlanRegistry in Browser

**src/services/browser-plan-registry.ts**:
```typescript
import { createPlanRegistry } from 'refinio.api/registry/PlanRegistry';
import { initializeOnePlans } from 'refinio.api/registry/initialize-one-handlers';
import { OneStoragePlan, OneLeutePlan, OneChannelsPlan } from 'refinio.api/handlers';
// Import LAMA plans
import { LamaMemoryPlan, LamaChatMemoryPlan } from 'lama.core/plans';

/**
 * Initialize Plan Registry with browser ONE.core instance
 */
export async function initBrowserPlans(leuteModel: any, channelManager: any) {
  const registry = createPlanRegistry();

  // Register ONE Plans (using browser ONE.core)
  registry.register('one.storage', new OneStoragePlan());
  registry.register('one.leute', new OneLeutePlan(leuteModel));
  registry.register('one.channels', new OneChannelsPlan(channelManager));
  registry.register('one.crypto', new OneCryptoPlan());
  registry.register('one.instance', new OneInstancePlan());

  // Register LAMA Plans
  registry.register('lama.memory', new LamaMemoryPlan(/* deps */));
  registry.register('lama.chatMemory', new LamaChatMemoryPlan(/* deps */));
  // ... other LAMA plans

  return registry;
}

// Export singleton
let browserRegistry: any = null;

export async function getBrowserRegistry() {
  if (!browserRegistry) {
    // Initialize ONE.core first (existing browser init)
    const { leuteModel, channelManager } = await initBrowserOneCore();
    browserRegistry = await initBrowserPlans(leuteModel, channelManager);
  }
  return browserRegistry;
}
```

### Step 2: Update Components to Use Plans

**Before** (direct ONE.core calls):
```typescript
// src/components/ContactList.tsx
import { getContacts } from '@refinio/one.models/lib/models/Leute';

function ContactList() {
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    const loadContacts = async () => {
      const leuteModel = await getLeuteModel();
      const contactList = await leuteModel.getContacts();
      setContacts(contactList);
    };
    loadContacts();
  }, []);
}
```

**After** (Plan registry):
```typescript
// src/components/ContactList.tsx
import { getBrowserRegistry } from '../services/browser-plan-registry';

function ContactList() {
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    const loadContacts = async () => {
      const registry = await getBrowserRegistry();
      const story = await registry.execute('one.leute', 'getContacts');
      setContacts(story.data);
    };
    loadContacts();
  }, []);
}
```

### Step 3: Create React Hook

**src/hooks/usePlan.ts**:
```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { getBrowserRegistry } from '../services/browser-plan-registry';

/**
 * Execute a Plan (read operation)
 */
export function usePlan<T = any>(
  plan: string,
  method: string,
  params?: any,
  options?: any
) {
  return useQuery({
    queryKey: [plan, method, params],
    queryFn: async () => {
      const registry = await getBrowserRegistry();
      const story = await registry.execute<T>(plan, method, params);
      if (!story.success) {
        throw new Error(story.error?.message);
      }
      return story.data;
    },
    ...options
  });
}

/**
 * Execute a Plan (write operation)
 */
export function usePlanMutation<T = any>(
  plan: string,
  method: string
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: any) => {
      const registry = await getBrowserRegistry();
      const story = await registry.execute<T>(plan, method, params);
      if (!story.success) {
        throw new Error(story.error?.message);
      }
      return story.data;
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries([plan]);
    }
  });
}
```

**Usage in components**:
```typescript
// Read operation
function ContactList() {
  const { data: contacts, isLoading } = usePlan(
    'one.leute',
    'getContacts'
  );

  if (isLoading) return <Spinner />;

  return (
    <ul>
      {contacts.map(c => <li key={c.idHash}>{c.name}</li>)}
    </ul>
  );
}

// Write operation
function CreateContact() {
  const createContact = usePlanMutation('one.leute', 'createContact');

  const handleSubmit = async (data) => {
    await createContact.mutateAsync(data);
  };

  return <ContactForm onSubmit={handleSubmit} />;
}
```

### Step 4: Type-Safe Proxy (Optional)

**src/services/typed-browser-plans.ts**:
```typescript
import { getBrowserRegistry } from './browser-plan-registry';
import type { IOneLeutePlan, ILamaMemoryPlan } from 'refinio.api/client';

/**
 * Get type-safe Plan proxy
 */
export async function getBrowserPlan<T>(planName: string): Promise<T> {
  const registry = await getBrowserRegistry();
  return registry.proxy<T>(planName);
}

// Pre-configured proxies
export async function getOneLeutePlan(): Promise<IOneLeutePlan> {
  return getBrowserPlan<IOneLeutePlan>('one.leute');
}

export async function getLamaMemoryPlan(): Promise<ILamaMemoryPlan> {
  return getBrowserPlan<ILamaMemoryPlan>('lama.memory');
}
```

**Usage**:
```typescript
import { getOneLeutePlan } from '../services/typed-browser-plans';

async function createContact() {
  const leute = await getOneLeutePlan();
  const result = await leute.createContact({
    name: 'John',
    email: 'john@example.com'
  });
  // Full TypeScript types!
}
```

## Benefits

### 1. Consistency Across Platforms

Same component code works in browser AND electron:

```typescript
// This component works in:
// - lama.browser (Plans → local ONE.core)
// - lama.electron renderer (Plans → main process)
// - lama.thin (Plans → remote server)

function ContactList() {
  const { data: contacts } = usePlan('one.leute', 'getContacts');
  return <ul>{contacts.map(c => <li>{c.name}</li>)}</ul>;
}
```

### 2. Transaction Audit (Story Objects)

Every operation creates a Story:

```typescript
const story = await registry.execute('one.storage', 'storeVersionedObject', doc);

// Story contains:
{
  success: true,
  plan: {
    plan: 'one.storage',
    method: 'storeVersionedObject',
    params: { ... }
  },
  data: { hash: '...', idHash: '...' },
  timestamp: 1234567890,
  executionTime: 42
}

// Store Story for audit
await storeStory(story);
```

### 3. Easy Testing

```typescript
// Mock the registry
vi.mock('../services/browser-plan-registry', () => ({
  getBrowserRegistry: () => ({
    execute: vi.fn().mockResolvedValue({
      success: true,
      data: []
    })
  })
}));

test('loads contacts', async () => {
  render(<ContactList />);
  expect(await screen.findByText('No contacts')).toBeInTheDocument();
});
```

### 4. Future Flexibility

Can optionally connect to remote Plans:

```typescript
// browser-plan-registry.ts
export async function getBrowserRegistry(options?: { remote?: string }) {
  if (options?.remote) {
    // Connect to remote server
    return createRemotePlanClient(options.remote);
  }

  // Use local ONE.core (default)
  return await initLocalRegistry();
}

// Usage
const registry = await getBrowserRegistry({
  remote: 'http://localhost:3000' // Optional remote mode
});
```

## Migration Strategy

### Phase 1: Add Registry (No Breaking Changes)

1. Install refinio.api
2. Create browser-plan-registry.ts
3. Keep existing code working
4. Test registry in parallel

### Phase 2: Gradual Component Migration

1. Migrate one component at a time
2. Use feature flag: `USE_PLAN_REGISTRY`
3. Monitor performance
4. Keep old code as fallback

### Phase 3: Complete Migration

1. All components use Plans
2. Remove direct ONE.core calls from components
3. ONE.core only accessed via Plans
4. Story objects for audit trail

## What Stays the Same

- ✅ ONE.core runs in browser (IndexedDB)
- ✅ Fully self-contained
- ✅ No server required
- ✅ Offline capable
- ✅ Same bundle size

## What Changes

- 🔄 Internal architecture (Plans)
- 🔄 Component data fetching (usePlan hook)
- 🔄 Transaction audit (Story objects)
- 🔄 Type safety (typed Plan interfaces)

## Comparison: lama.browser vs lama.thin

| Feature | lama.browser | lama.thin |
|---------|--------------|-----------|
| ONE.core | ✅ Local (IndexedDB) | ❌ None |
| Server required | ❌ No | ✅ Yes |
| Bundle size | ~15MB | ~2MB |
| Offline | ✅ Full | ❌ Limited |
| Use case | Standalone browser app | Thin client to server |
| Plan source | Local registry | Remote registry |
| Storage | IndexedDB | None (server) |

## Summary

lama.browser **keeps** ONE.core (self-contained, standalone).

lama.browser **adds** PlanRegistry for:
- Consistent architecture
- Transaction audit (Story objects)
- Type safety
- Component portability
- Future flexibility

This is about **internal architecture**, not changing the deployment model!
