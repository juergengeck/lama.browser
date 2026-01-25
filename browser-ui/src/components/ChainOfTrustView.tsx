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
import type { TrustLevel, TrustChain, TrustChainNode } from '@refinio/trust.core/types/trust-types.js';

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
    case 'me':
      // Dark blue (highest trust)
      return 'bg-blue-900 dark:bg-blue-950 text-white dark:text-white border-blue-900';
    case 'trusted':
      // Blue
      return 'bg-blue-500 dark:bg-blue-600 text-white dark:text-white border-blue-500';
    case 'low':
      // Light gray (limited trust)
      return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300';
    case 'unknown':
    default:
      return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300';
  }
}

function getTrustLevelIcon(trustLevel: TrustLevel): React.ReactNode {
  switch (trustLevel) {
    case 'me':
      // Dark blue shield - highest trust
      return (
        <svg className="h-4 w-4 text-blue-900 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case 'trusted':
      // Blue check circle
      return (
        <svg className="h-4 w-4 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'low':
      // Gray warning
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
      onNodeClick={onNodeClick ? (node) => onNodeClick(node.data) : undefined}
      className={className}
      collapsible={true}
    />
  );
}

export default ChainOfTrustView;
