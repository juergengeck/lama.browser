/**
 * useProposals Hook
 * React hook to manage proposal state and interactions
 *
 * Reference: /specs/019-above-the-chat/plan.md line 133
 */

import { useState, useEffect, useCallback } from 'react';
import { getModel } from '@/model';
import type {
  Proposal,
  GetProposalsResponse,
  DismissProposalResponse,
  ShareProposalResponse,
} from '../types/proposals';

interface UseProposalsOptions {
  topicId: string;
  currentSubjects?: string[];
  autoRefresh?: boolean;
}

interface UseProposalsResult {
  proposals: Proposal[];
  currentIndex: number;
  currentProposal: Proposal | null;
  loading: boolean;
  error: string | null;
  nextProposal: () => void;
  previousProposal: () => void;
  dismissProposal: (proposalId: string, pastSubjectIdHash: string) => Promise<void>;
  shareProposal: (
    proposalId: string,
    pastSubjectIdHash: string,
    includeMessages?: boolean
  ) => Promise<ShareProposalResponse>;
  refresh: () => Promise<void>;
}

export function useProposals({
  topicId,
  currentSubjects,
  autoRefresh = true,
}: UseProposalsOptions): UseProposalsResult {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch proposals from Model handler (Browser platform - no IPC)
   */
  const fetchProposals = useCallback(
    async (forceRefresh = false) => {
      if (!topicId) {
        console.log('[useProposals] Skipping fetch - no topicId');
        return;
      }

      const model = getModel();
      if (!model.initialized) {
        console.log('[useProposals] Skipping - model not initialized yet');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response: GetProposalsResponse = await model.proposalsPlan.getForTopic({
          topicId,
          currentSubjects,
          forceRefresh,
        });

        setProposals(response.proposals || []);
        setCurrentIndex(0); // Reset to first proposal
      } catch (err: any) {
        console.error('[useProposals] Error fetching proposals:', err);
        setError(err.message || 'Failed to fetch proposals');
        setProposals([]);
      } finally {
        setLoading(false);
      }
    },
    [topicId, currentSubjects]
  );

  /**
   * Auto-refresh when current subjects change
   * Note: We don't require currentSubjects because the IPC handler will query them
   */
  useEffect(() => {
    if (autoRefresh && topicId) {
      fetchProposals();
    }
  }, [autoRefresh, topicId, fetchProposals]);

  /**
   * Navigate to next proposal
   */
  const nextProposal = useCallback(() => {
    if (proposals.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % proposals.length);
  }, [proposals.length]);

  /**
   * Navigate to previous proposal
   */
  const previousProposal = useCallback(() => {
    if (proposals.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + proposals.length) % proposals.length);
  }, [proposals.length]);

  /**
   * Dismiss a proposal
   */
  const dismissProposal = useCallback(
    async (proposalId: string, pastSubjectIdHash: string) => {
      try {
        const model = getModel();
        const response: DismissProposalResponse = await model.proposalsPlan.dismiss({
          proposalId,
          topicId,
          pastSubjectIdHash,
        });

        if (response.success) {
          // Remove dismissed proposal from local state
          setProposals((prev) => prev.filter((p) => p.id !== proposalId));

          // Adjust current index if needed
          setCurrentIndex((prev) => {
            if (prev >= proposals.length - 1) {
              return Math.max(0, proposals.length - 2);
            }
            return prev;
          });
        }
      } catch (err: any) {
        console.error('[useProposals] Error dismissing proposal:', err);
        throw err;
      }
    },
    [topicId, proposals.length]
  );

  /**
   * Share a proposal
   */
  const shareProposal = useCallback(
    async (
      proposalId: string,
      pastSubjectIdHash: string,
      includeMessages = false
    ): Promise<ShareProposalResponse> => {
      try {
        const model = getModel();
        const response: ShareProposalResponse = await model.proposalsPlan.share({
          proposalId,
          topicId,
          pastSubjectIdHash,
          includeMessages,
        });

        if (response.success) {
          // Remove shared proposal from local state (auto-dismissed)
          setProposals((prev) => prev.filter((p) => p.id !== proposalId));

          // Adjust current index if needed
          setCurrentIndex((prev) => {
            if (prev >= proposals.length - 1) {
              return Math.max(0, proposals.length - 2);
            }
            return prev;
          });
        }

        return response;
      } catch (err: any) {
        console.error('[useProposals] Error sharing proposal:', err);
        throw err;
      }
    },
    [topicId, proposals.length]
  );

  /**
   * Manually refresh proposals
   */
  const refresh = useCallback(async () => {
    await fetchProposals(true);
  }, [fetchProposals]);

  const currentProposal = proposals[currentIndex] || null;

  return {
    proposals,
    currentIndex,
    currentProposal,
    loading,
    error,
    nextProposal,
    previousProposal,
    dismissProposal,
    shareProposal,
    refresh,
  };
}
