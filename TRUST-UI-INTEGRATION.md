# Trust Level UI Integration Guide

## Overview

This guide explains how to integrate the new trust.core trust level system with the existing browser UI components.

## Current State

### ✅ Already Built
1. **HorizontalTreeView** - Generic horizontal tree component (`browser-ui/src/components/ui/HorizontalTreeView.tsx`)
2. **ChainOfTrustView** - Trust chain visualization component (needs update to use new API)
3. **ContactTrustStatus** - Contact list with trust status badges

### ⚠️ Needs Integration
1. **trust.core** - Not yet added as dependency
2. **TrustPlan/TrustModel** - Not yet initialized in Model.ts
3. **ChainOfTrustView** - Currently shows connection status; needs to show trust levels
4. **Trust Level Badges** - Need to map new levels (self/high/medium/low) to UI

## Integration Steps

### Step 1: Add trust.core Dependency

```bash
cd /Users/gecko/src/lama/lama.browser/browser-ui
npm install file:../../trust.core --save
```

**File**: `/Users/gecko/src/lama/lama.browser/browser-ui/package.json`
```json
{
  "dependencies": {
    "@trust/core": "file:../../trust.core",
    // ... existing dependencies
  }
}
```

### Step 2: Initialize TrustModel and TrustPlan in Model.ts

**File**: `/Users/gecko/src/lama/lama.browser/browser-ui/src/model/Model.ts`

Add imports at the top:
```typescript
import { TrustModel } from '@trust/core/models/TrustModel.js';
import { TrustPlan } from '@trust/core/plans/TrustPlan.js';
import type { TrustLevel, TrustChain } from '@trust/core/types/trust-types.js';
```

Add properties to the Model class:
```typescript
export class Model implements OneCoreInstance {
  // ... existing properties

  public trustModel: TrustModel;
  public trustPlan: TrustPlan;

  // ... rest of class
}
```

Initialize in constructor (after leuteModel, before connectionPlan):
```typescript
constructor(commServerUrl?: string) {
  // ... existing initialization

  this.leuteModel = new LeuteModel(this);
  this.channelManager = new ChannelManager(
    this,
    {
      storeVersionedObject,
      storeUnversionedObject,
      createAccessObject,
      storeIdObject,
    },
    this.leuteModel
  );

  // Initialize TrustModel and TrustPlan
  this.trustModel = new TrustModel(this, this.leuteModel);
  this.trustPlan = new TrustPlan(this.trustModel);

  // ... rest of initialization

  // Pass trustPlan to ConnectionPlan (7th parameter)
  this.connectionPlan = new ConnectionPlan(
    this as any,
    undefined,     // No storage provider for browser
    commServerUrl,
    undefined,     // No discovery config for browser
    trustDeps,     // Trust dependencies
    pairingCallbacks,  // Platform-specific UI updates
    this.trustPlan  // NEW: trust.core TrustPlan for automatic trust assignment
  );
}
```

Add init call in Model.init():
```typescript
public async init(): Promise<void> {
  if (this.initialized) {
    console.log('[Model] Already initialized');
    return;
  }

  console.log('[Model] Initializing...');

  try {
    this.objectEvents.init();
    await this.leuteModel.init();
    await this.channelManager.init();
    await this.topicModel.init();
    await this.connections.init();
    await this.topicAnalysisModel.init();

    // Initialize TrustModel
    await this.trustModel.init();

    // ... rest of init
  }
}
```

### Step 3: Update ChainOfTrustView to Use Trust Levels

**File**: `/Users/gecko/src/lama/lama.browser/browser-ui/src/components/ChainOfTrustView.tsx`

Update the component to fetch trust chain data:

```typescript
/**
 * ChainOfTrustView - Visual chain of trust for contacts
 *
 * Displays trust relationships in a horizontal tree format showing:
 * - Trust levels (self, high, medium, low)
 * - Trust establishment dates
 * - Transitive trust paths
 */

import React, { useState, useEffect } from 'react';
import { HorizontalTreeView, TreeNode } from './ui/HorizontalTreeView';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type { TrustLevel, TrustChain, TrustChainNode } from '@trust/core/types/trust-types.js';

export interface ChainOfTrustViewProps {
  personId: SHA256IdHash<Person>;
  className?: string;
  onNodeClick?: (node: TrustTreeNode) => void;
  /** Model instance for data fetching */
  model: any;
}

export interface TrustTreeNode {
  id: string;
  type: 'person';
  personId: SHA256IdHash<Person>;
  name: string;
  trustLevel: TrustLevel;
  establishedAt: Date;
  establishedBy?: SHA256IdHash<Person>;
  depth: number;
}

function getTrustLevelColor(trustLevel: TrustLevel): string {
  switch (trustLevel) {
    case 'self':
      // Dark blue - bottom of lama gradient (highest trust)
      return 'bg-blue-900 dark:bg-blue-950 text-white dark:text-white border-blue-900';
    case 'high':
      // Blue - lower-middle of gradient
      return 'bg-blue-500 dark:bg-blue-600 text-white dark:text-white border-blue-500';
    case 'medium':
      // Pink/Magenta - middle of gradient
      return 'bg-pink-500 dark:bg-pink-600 text-white dark:text-white border-pink-500';
    case 'low':
      // Light/White - top of gradient (lowest trust)
      return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300';
    default:
      return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300';
  }
}

function getTrustLevelIcon(trustLevel: TrustLevel): React.ReactNode {
  switch (trustLevel) {
    case 'self':
      // Dark blue shield - highest trust
      return (
        <svg className="h-4 w-4 text-blue-900 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case 'high':
      // Blue check circle
      return (
        <svg className="h-4 w-4 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'medium':
      // Pink/Magenta info circle
      return (
        <svg className="h-4 w-4 text-pink-500 dark:text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'low':
      // Light gray warning
      return (
        <svg className="h-4 w-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    default:
      return null;
  }
}

function renderTrustNode(node: TreeNode<TrustTreeNode>, level: number) {
  const data = node.data;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {getTrustLevelIcon(data.trustLevel)}
        <span className="font-semibold text-sm">{data.name}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 text-xs rounded border ${getTrustLevelColor(data.trustLevel)}`}>
          {data.trustLevel}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
          {data.personId.toString().substring(0, 8)}...
        </span>
      </div>

      <span className="text-xs text-gray-500 dark:text-gray-400">
        Established: {new Date(data.establishedAt).toLocaleDateString()}
      </span>

      {data.depth > 0 && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Depth: {data.depth} hop{data.depth !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

// Convert trust.core TrustChain to HorizontalTreeView format
function convertTrustChainToTreeNodes(chain: TrustChain): TreeNode<TrustTreeNode>[] {
  const nodeMap = new Map<string, TreeNode<TrustTreeNode>>();

  // Create tree nodes from chain nodes
  chain.nodes.forEach((chainNode) => {
    const treeNode: TreeNode<TrustTreeNode> = {
      id: chainNode.personId.toString(),
      data: {
        id: chainNode.personId.toString(),
        type: 'person',
        personId: chainNode.personId,
        name: chainNode.name,
        trustLevel: chainNode.trustLevel,
        establishedAt: chainNode.establishedAt,
        establishedBy: chainNode.establishedBy,
        depth: chainNode.depth,
      },
      children: [],
    };
    nodeMap.set(chainNode.personId.toString(), treeNode);
  });

  // Build parent-child relationships from edges
  chain.edges.forEach((edge) => {
    const parent = nodeMap.get(edge.from.toString());
    const child = nodeMap.get(edge.to.toString());

    if (parent && child) {
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(child);
    }
  });

  // Return root node (depth 0)
  const rootNode = nodeMap.get(chain.root.personId.toString());
  return rootNode ? [rootNode] : [];
}

export function ChainOfTrustView({
  personId,
  className,
  onNodeClick,
  model,
}: ChainOfTrustViewProps) {
  const [treeNodes, setTreeNodes] = useState<TreeNode<TrustTreeNode>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTrustChain() {
      if (!model?.trustPlan) {
        setError('Trust plan not available');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get trust chain from trust.core
        const result = await model.trustPlan.getTrustChain({
          personId,
          maxDepth: 3, // Show up to 3 levels of transitive trust
        });

        if (result.error) {
          throw new Error(result.error);
        }

        if (!result.chain) {
          throw new Error('No trust chain data returned');
        }

        // Convert trust chain to tree nodes
        const nodes = convertTrustChainToTreeNodes(result.chain);
        setTreeNodes(nodes);
      } catch (err) {
        console.error('[ChainOfTrustView] Error loading trust chain:', err);
        setError(err instanceof Error ? err.message : 'Failed to load trust chain');
      } finally {
        setLoading(false);
      }
    }

    loadTrustChain();
  }, [personId, model]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-500 rounded-lg bg-red-50 dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (treeNodes.length === 0) {
    return (
      <div className="p-4 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-900/20">
        <p className="text-sm text-gray-600 dark:text-gray-400">No trust chain data available</p>
      </div>
    );
  }

  return (
    <HorizontalTreeView
      nodes={treeNodes}
      renderNode={renderTrustNode}
      onNodeClick={onNodeClick}
      className={className}
      collapsible={true}
    />
  );
}

export default ChainOfTrustView;
```

### Step 4: Update ContactTrustStatus to Show New Trust Levels

**File**: `/Users/gecko/src/lama/lama.browser/browser-ui/src/components/ContactTrustStatus.tsx`

Update trust level type and icons:

```typescript
interface Contact {
  personId: string;
  name: string;
  trustLevel: 'self' | 'high' | 'medium' | 'low' | 'discovered' | 'pending' | 'blocked';
  // ... rest of interface
}

const getTrustIcon = (trustLevel: string) => {
  switch (trustLevel) {
    case 'self':
      // Dark blue - highest trust
      return <Shield className="h-4 w-4 text-blue-900 dark:text-blue-400" />;
    case 'high':
      // Blue - high trust
      return <ShieldCheck className="h-4 w-4 text-blue-500 dark:text-blue-400" />;
    case 'medium':
      // Pink/Magenta - medium trust
      return <ShieldCheck className="h-4 w-4 text-pink-500 dark:text-pink-400" />;
    case 'low':
      // Light gray - low trust
      return <ShieldAlert className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
    case 'discovered':
      return <Shield className="h-4 w-4 text-gray-400 dark:text-gray-500" />;
    case 'blocked':
      return <ShieldOff className="h-4 w-4 text-red-500" />;
    default:
      return <Shield className="h-4 w-4 text-gray-500" />;
  }
};
```

### Step 5: Add Expandable Contact Cards with Trust Chain

Create a new component to show contact details with expandable trust chain:

**File**: `/Users/gecko/src/lama/lama.browser/browser-ui/src/components/ContactCard.tsx`

```typescript
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ChainOfTrustView } from './ChainOfTrustView';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';

interface ContactCardProps {
  personId: SHA256IdHash<Person>;
  name: string;
  trustLevel: 'self' | 'high' | 'medium' | 'low';
  model: any;
}

export function ContactCard({ personId, name, trustLevel, model }: ContactCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>{name}</CardTitle>
            <Badge variant={trustLevel === 'high' ? 'default' : 'secondary'}>
              {trustLevel}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span className="ml-2">Chain of Trust</span>
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          <ChainOfTrustView
            personId={personId}
            model={model}
            className="border-t pt-4"
          />
        </CardContent>
      )}
    </Card>
  );
}
```

## Usage Examples

### Get Trust Level for a Contact

```typescript
const result = await model.trustPlan.getTrustLevel({ personId });
if (result.trustLevel) {
  console.log('Trust level:', result.trustLevel); // 'medium', 'high', etc.
}
```

### Get Trust Chain for Visualization

```typescript
const result = await model.trustPlan.getTrustChain({
  personId,
  maxDepth: 3
});

if (result.chain) {
  console.log('Root:', result.chain.root);
  console.log('Nodes:', result.chain.nodes);
  console.log('Edges:', result.chain.edges);
}
```

### Manually Update Trust Level

```typescript
await model.trustPlan.setTrustLevel({
  personId,
  trustLevel: 'high',
  reason: 'Manual verification after face-to-face meeting'
});
```

## Trust Level Visual Design

### Color Scheme (Lama Logo Gradient)

Trust levels follow the lama logo gradient spectrum from white (low trust) to dark blue (self):

| Level | Background | Text | Border | Gradient Position |
|-------|-----------|------|--------|-------------------|
| self | Dark Blue (#1e3a8a) | White | Dark Blue | Bottom (highest trust) |
| high | Blue (#3b82f6) | White | Blue | Lower-middle |
| medium | Pink/Magenta (#ec4899) | White | Pink | Middle |
| low | Light/White (#f3f4f6) | Gray | Light Gray | Top (lowest trust) |

### Badge Examples

```tsx
{/* Self trust - Dark blue (bottom of lama gradient) */}
<span className="px-2 py-0.5 text-xs rounded border bg-blue-900 dark:bg-blue-950 text-white dark:text-white border-blue-900">
  self
</span>

{/* High trust - Blue (lower-middle of gradient) */}
<span className="px-2 py-0.5 text-xs rounded border bg-blue-500 dark:bg-blue-600 text-white dark:text-white border-blue-500">
  high
</span>

{/* Medium trust - Pink/Magenta (middle of gradient) */}
<span className="px-2 py-0.5 text-xs rounded border bg-pink-500 dark:bg-pink-600 text-white dark:text-white border-pink-500">
  medium
</span>

{/* Low trust - Light/White (top of gradient) */}
<span className="px-2 py-0.5 text-xs rounded border bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300">
  low
</span>
```

## Testing

### Manual Testing Steps

1. **Test Trust Assignment on Invitation:**
   - Create invitation and accept it
   - Verify contact gets 'medium' trust level
   - Check browser console for trust assignment logs

2. **Test Trust Chain Visualization:**
   - Open contact card
   - Click "Chain of Trust" to expand
   - Verify horizontal tree shows:
     - Root node (Self)
     - Contact node with trust level badge
     - Connection lines
     - Proper depth indicators

3. **Test Manual Trust Update:**
   - Right-click contact → "Update Trust Level"
   - Select "High"
   - Verify badge updates in UI
   - Verify trust chain reflects new level

## Next Steps

1. Add trust level to contact right-click menu for manual updates
2. Add trust level filter in contacts list
3. Add trust level to contact search/sort
4. Add notifications when trust level changes
5. Add transitive trust visualization (future phase)

## Files Modified

- `/browser-ui/package.json` - Add @trust/core dependency
- `/browser-ui/src/model/Model.ts` - Initialize TrustModel and TrustPlan
- `/browser-ui/src/components/ChainOfTrustView.tsx` - Update to use trust.core API
- `/browser-ui/src/components/ContactTrustStatus.tsx` - Update trust level badges
- `/browser-ui/src/components/ContactCard.tsx` - NEW: Expandable contact card

## Documentation References

- Trust Level Definitions: `/trust.core/docs/TRUST-LEVELS.md`
- Integration Summary: `/trust.core/docs/INTEGRATION-SUMMARY.md`
- API Documentation: `/trust.core/plans/TrustPlan.ts`
