/**
 * useChatSubjects Hook - Platform-Agnostic
 * Fetches and manages subjects for a chat topic using usePlans()
 */

import { useState, useEffect, useRef } from 'react';
import type { Subject } from '../types/topic-analysis';
import { getModel } from '../model';
import { usePlans } from '@refinio/lama.ui';
import { addAIEventListener, Events } from '../events/AIEventTypes';

export function useChatSubjects(topicId: string) {
  // Use Plans for platform-agnostic operations
  const { topicAnalysis } = usePlans();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs to track and cancel stale requests
  const requestCounter = useRef(0);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Track previous subject count for change detection
  const prevSubjectCountRef = useRef(0);

  // Listen for subject update events from Model (type-safe)
  useEffect(() => {
    if (!topicId) return;

    // Listen to type-safe subjects updated events
    const cleanup = addAIEventListener(Events.SUBJECTS_UPDATED, (event) => {
      const data = event.detail;
      if (data.topicId === topicId) {
        // Re-fetch subjects immediately
        fetchSubjects();
      }
    });

    return cleanup;
  }, [topicId]);

  // Detect when subjects appear (0 -> N) and return flag
  const subjectsJustAppeared = prevSubjectCountRef.current === 0 && subjects.length > 0;
  prevSubjectCountRef.current = subjects.length;

  // Fetch subjects
  const fetchSubjects = async () => {
    const currentRequest = ++requestCounter.current;

    try {
      const model = getModel();
      if (!model.initialized) {
        console.log('[useChatSubjects] Skipping - model not initialized yet');
        return;
      }

      if (loading) {
        console.log('[useChatSubjects] Skipping - fetch already in progress');
        return;
      }

      setLoading(true);

      // Platform-agnostic subject fetching
      const response = await topicAnalysis.getSubjects({
        topicId,
        includeArchived: false
      });

      // Only update if this is still the latest request
      if (currentRequest === requestCounter.current) {
        if (response.success && response.data?.subjects) {
          setSubjects(response.data.subjects);
          setError(null);
        } else {
          setSubjects([]);
        }
      }
    } catch (err) {
      if (currentRequest === requestCounter.current) {
        console.error('[useChatSubjects] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch subjects');
      }
    } finally {
      if (currentRequest === requestCounter.current) {
        setLoading(false);
      }
    }
  };

  // Load subjects when topicId changes
  useEffect(() => {
    // Clear subjects immediately when topicId changes
    setSubjects([]);
    setError(null);

    if (!topicId) {
      return;
    }

    // Cancel any pending debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Debounce the fetch
    debounceTimer.current = setTimeout(() => {
      fetchSubjects();
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [topicId]);

  return {
    subjects,
    loading,
    error,
    refetch: fetchSubjects,
    subjectsJustAppeared
  };
}
