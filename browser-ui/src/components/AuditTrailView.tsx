/**
 * AuditTrailView - Audit trail visualization for journal entries
 *
 * Displays audit trail in a horizontal tree format.
 * Shows attestations, auditors, LLM calls, and journal properties.
 */

import React, { useState, useEffect } from 'react';
import { HorizontalTreeView, TreeNode } from './ui/HorizontalTreeView';

export interface AuditTrailViewProps {
  /** Message hash to show audit trail for */
  messageHash?: string;
  /** Topic ID to show audit trail for */
  topicId?: string;
  /** Conversation ID for journal entries */
  topicId?: string;
  className?: string;
  onNodeClick?: (node: AuditTreeNode) => void;
  /** Model instance for data fetching */
  model: any;
}

export interface AuditTreeNode {
  id: string;
  type: 'root' | 'attestation' | 'auditor' | 'signature' | 'journal-entry' | 'llm-call' | 'property';
  messageHash?: string;
  topicId?: string;
  topicId?: string;
  auditorId?: string;
  auditorName?: string;
  trustLevel?: number;
  timestamp?: number;
  attestedAt?: number;
  signature?: string;
  // Journal-specific
  callId?: string;
  modelId?: string;
  prompt?: string;
  response?: string;
  property?: string;
  value?: string;
  // Status
  status?: 'complete' | 'partial' | 'pending' | 'failed';
  reason?: string;
}

function getStatusBadgeClasses(status: string | undefined): string {
  switch (status) {
    case 'complete':
      return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200';
    case 'partial':
      return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200';
    case 'pending':
      return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200';
    case 'failed':
      return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200';
    default:
      return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200';
  }
}

function getTrustBadgeClasses(level: number | undefined): string {
  if (level === undefined) return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200';
  if (level >= 2) return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200';
  return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200';
}

function renderAuditNode(node: TreeNode<AuditTreeNode>, level: number) {
  const data = node.data;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {data.type === 'root' && (
          <>
            <span className="font-semibold text-sm">
              {data.topicId ? 'Journal Audit Trail' : 'Message Audit Trail'}
            </span>
            {data.messageHash && (
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {data.messageHash.substring(0, 8)}...
              </span>
            )}
            {data.topicId && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {data.topicId}
              </span>
            )}
          </>
        )}

        {data.type === 'attestation' && (
          <>
            <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-sm">Attestation</span>
            {data.status && (
              <span className={`px-2 py-0.5 text-xs rounded ${getStatusBadgeClasses(data.status)}`}>
                {data.status}
              </span>
            )}
          </>
        )}

        {data.type === 'auditor' && (
          <>
            <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-sm">Auditor:</span>
            <span className="text-xs font-medium">
              {data.auditorName || 'Unknown'}
            </span>
            {data.trustLevel !== undefined && (
              <span className={`px-2 py-0.5 text-xs rounded ${getTrustBadgeClasses(data.trustLevel)}`}>
                Trust: {data.trustLevel}
              </span>
            )}
          </>
        )}

        {data.type === 'signature' && (
          <>
            <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">Signature:</span>
            <span className="text-xs font-mono">
              {data.signature?.substring(0, 12)}...
            </span>
          </>
        )}

        {data.type === 'llm-call' && (
          <>
            <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-sm">LLM Call:</span>
            <span className="text-xs font-medium">{data.modelId}</span>
          </>
        )}

        {data.type === 'journal-entry' && (
          <>
            <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm">Entry:</span>
            <span className="text-xs">{data.callId?.substring(0, 12)}...</span>
          </>
        )}

        {data.type === 'property' && (
          <>
            <span className="text-sm font-medium">{data.property}:</span>
            <span className="text-xs truncate max-w-[200px]">{data.value?.substring(0, 50)}...</span>
          </>
        )}
      </div>

      {data.reason && (
        <p className="text-xs text-gray-600 dark:text-gray-300 max-w-[250px]">
          {data.reason}
        </p>
      )}

      {data.prompt && (
        <p className="text-xs text-gray-600 dark:text-gray-300 max-w-[250px] truncate">
          {data.prompt}
        </p>
      )}

      {data.timestamp && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(data.timestamp).toLocaleString()}
        </span>
      )}
    </div>
  );
}

export function AuditTrailView({
  messageHash,
  topicId,
  topicId,
  className,
  onNodeClick,
  model,
}: AuditTrailViewProps) {
  const [treeNodes, setTreeNodes] = useState<TreeNode<AuditTreeNode>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAuditTrail() {
      try {
        setLoading(true);
        setError(null);

        const children: TreeNode<AuditTreeNode>[] = [];

        // Load message attestations if messageHash provided
        if (messageHash && model?.auditPlan) {
          try {
            const attestationsResponse = await model.auditPlan.getAttestations({ messageHash });

            if (attestationsResponse.success && attestationsResponse.attestations?.length > 0) {
              const attestationChildren: TreeNode<AuditTreeNode>[] =
                attestationsResponse.attestations.map((attestation: any, index: number) => {
                  const auditorChildren: TreeNode<AuditTreeNode>[] = [];

                  if (attestation.signature) {
                    auditorChildren.push({
                      id: `signature-${index}`,
                      data: {
                        id: `signature-${index}`,
                        type: 'signature',
                        signature: attestation.signature,
                      },
                    });
                  }

                  return {
                    id: `auditor-${index}`,
                    data: {
                      id: `auditor-${index}`,
                      type: 'auditor',
                      auditorId: attestation.auditorId,
                      auditorName: attestation.auditorName,
                      trustLevel: attestation.trustLevel || 1,
                      attestedAt: attestation.timestamp,
                      timestamp: attestation.timestamp,
                    },
                    children: auditorChildren.length > 0 ? auditorChildren : undefined,
                  };
                });

              const statusResponse = await model.auditPlan.getAttestationStatus({ messageHash });

              children.push({
                id: 'attestations',
                data: {
                  id: 'attestations',
                  type: 'attestation',
                  status: statusResponse.status?.fullyAttested
                    ? 'complete'
                    : statusResponse.status?.partiallyAttested
                    ? 'partial'
                    : 'pending',
                  reason: `${attestationsResponse.attestations.length} attestations`,
                },
                children: attestationChildren,
              });
            }
          } catch (err) {
            console.warn('[AuditTrailView] Attestations unavailable:', err);
          }
        }

        // Load topic attestations if topicId provided
        if (topicId && model?.auditPlan) {
          try {
            const attestationsResponse = await model.auditPlan.getAttestations({ topicId });

            if (attestationsResponse.success && attestationsResponse.attestations?.length > 0) {
              const topicAttestationChildren: TreeNode<AuditTreeNode>[] =
                attestationsResponse.attestations.map((attestation: any, index: number) => ({
                  id: `topic-auditor-${index}`,
                  data: {
                    id: `topic-auditor-${index}`,
                    type: 'auditor',
                    auditorId: attestation.auditorId,
                    auditorName: attestation.auditorName,
                    timestamp: attestation.timestamp,
                  },
                }));

              children.push({
                id: 'topic-attestations',
                data: {
                  id: 'topic-attestations',
                  type: 'attestation',
                  reason: `Topic: ${attestationsResponse.attestations.length} attestations`,
                },
                children: topicAttestationChildren,
              });
            }
          } catch (err) {
            console.warn('[AuditTrailView] Topic attestations unavailable:', err);
          }
        }

        // Load journal entries if topicId provided
        // Note: Journal plan not yet available in browser-ui, placeholder for future
        if (topicId) {
          children.push({
            id: 'journal-placeholder',
            data: {
              id: 'journal-placeholder',
              type: 'journal-entry',
              status: 'pending',
              reason: 'Journal tracking coming soon',
            },
          });
        }

        // If no data loaded, show empty state
        if (children.length === 0) {
          children.push({
            id: 'empty',
            data: {
              id: 'empty',
              type: 'attestation',
              status: 'pending',
              reason: 'No audit data available',
            },
          });
        }

        const rootNode: TreeNode<AuditTreeNode> = {
          id: 'root',
          data: {
            id: 'root',
            type: 'root',
            messageHash,
            topicId,
            topicId,
          },
          children,
        };

        setTreeNodes([rootNode]);
      } catch (err) {
        console.error('[AuditTrailView] Error loading audit trail:', err);
        setError(err instanceof Error ? err.message : 'Failed to load audit trail');
      } finally {
        setLoading(false);
      }
    }

    if (model) {
      loadAuditTrail();
    } else {
      setError('Model not available');
      setLoading(false);
    }
  }, [messageHash, topicId, topicId, model]);

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

  return (
    <HorizontalTreeView
      nodes={treeNodes}
      renderNode={renderAuditNode}
      onNodeClick={onNodeClick}
      className={className}
      collapsible={true}
    />
  );
}

export default AuditTrailView;
