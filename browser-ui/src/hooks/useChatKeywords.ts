/**
 * useChatKeywords Hook - Platform-Agnostic
 * Non-blocking real-time single-word keyword extraction
 * Uses usePlans() for platform-agnostic access to topicAnalysis plan
 */

import { useState, useEffect, useRef } from 'react';
import { getModel } from '../model';
import { usePlans } from '@refinio/lama.ui';
import { addAIEventListener, Events } from '../events/AIEventTypes';

interface Message {
  id?: string;
  content?: string;
  text?: string;
  sender?: string;
  timestamp?: number | string;
}

export function useChatKeywords(topicId: string, messages: Message[] = []) {
  console.log('[useChatKeywords] Hook called with topicId:', topicId, 'messages:', messages.length);

  // Use Plans for platform-agnostic operations
  const { topicAnalysis } = usePlans();

  const [keywords, setKeywords] = useState<any[]>([]); // Changed from string[] to any[] to hold full keyword objects
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs to track and cancel stale requests
  const extractionInProgress = useRef(false);
  const requestCounter = useRef(0);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Track previous keyword count for change detection
  const prevKeywordCountRef = useRef(0);

  // Listen for keywords update events from Model (type-safe AI events)
  useEffect(() => {
    if (!topicId) return;

    const cleanup = addAIEventListener(Events.KEYWORDS_UPDATED, (event) => {
      const data = event.detail;
      console.log(`[useChatKeywords-${topicId}] 🔔 Received KEYWORDS_UPDATED event for: "${data.topicId}"`);

      if (data.topicId === topicId) {
        console.log(`[useChatKeywords-${topicId}] ✅ Fetching updated keywords`);
        // Re-fetch keywords immediately (platform-agnostic)
        const fetchKeywords = async () => {
          try {
            const response = await topicAnalysis.getKeywords({
              topicId,
              limit: 15
            });
            if (response.success && response.data?.keywords) {
              const keywords = response.data.keywords;
              const keywordTerms = keywords.map((k: any) => k.term || k);
              console.log(`[useChatKeywords-${topicId}] Refreshed keywords after update:`, keywordTerms.length);
              setKeywords(keywords);
            }
          } catch (err) {
            console.error(`[useChatKeywords-${topicId}] Error refreshing keywords:`, err);
          }
        };
        fetchKeywords();
      }
    });

    return cleanup;
  }, [topicId, topicAnalysis]);

  // Detect when keywords appear (0 -> N) and return flag
  const keywordsJustAppeared = prevKeywordCountRef.current === 0 && keywords.length > 0;
  prevKeywordCountRef.current = keywords.length;

  // Non-blocking keyword extraction
  useEffect(() => {
    // CRITICAL: Clear keywords immediately when topicId changes to prevent stale data
    console.log('[useChatKeywords] 🧹 Clearing keywords for topic change to:', topicId);
    setKeywords([]);

    if (!topicId) {
      return;
    }

    // Cancel any pending debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Debounce the extraction to avoid too many calls
    debounceTimer.current = setTimeout(() => {
      // Increment request counter to track current request
      const currentRequest = ++requestCounter.current;

      // Don't wait for extraction, fire and forget
      const performExtraction = async () => {
        // Skip if another extraction is already in progress
        if (extractionInProgress.current) {
          console.log('[useChatKeywords] Skipping - extraction already in progress');
          return;
        }

        extractionInProgress.current = true;

        try {
          const model = getModel();
          if (!model.initialized) {
            console.log('[useChatKeywords] Skipping - model not initialized yet');
            return;
          }

          // Only show loading for initial load, not updates
          if (keywords.length === 0) {
            setLoading(true);
          }

          if (messages && messages.length > 0) {
            console.log('[useChatKeywords] Loading keywords from storage for', messages.length, 'messages');

            // Get keywords from storage - platform-agnostic
            const response = await topicAnalysis.getKeywords({
              topicId,
              limit: 15
            });

            // Only update if this is still the latest request
            if (currentRequest === requestCounter.current) {
              if (response.success && response.data?.keywords) {
                // Keep full keyword objects with subjects array
                const keywords = response.data.keywords;
                const keywordTerms = keywords.map((k: any) => k.term || k);
                console.log('[useChatKeywords] ✅ Keywords loaded from storage:', keywordTerms.length, 'keywords:', keywordTerms);
                setKeywords(keywords);
                setError(null);
              } else {
                console.log('[useChatKeywords] ❌ No keywords in response:', response);
              }
            } else {
              console.log('[useChatKeywords] Ignoring stale response');
            }
          } else if (keywords.length === 0) {
            // Only try fallback if we have no keywords yet
            console.log('[useChatKeywords] No messages, trying fallback to subjects');

            const subjectsResponse = await topicAnalysis.getSubjects({
              topicId,
              includeArchived: false
            });

            // Only update if this is still the latest request
            if (currentRequest === requestCounter.current) {
              if (subjectsResponse.success && subjectsResponse.data?.subjects) {
                const allKeywords = new Set<string>();

                subjectsResponse.data.subjects.forEach((subject: any) => {
                  if (subject.keywords && Array.isArray(subject.keywords)) {
                    subject.keywords.forEach((keyword: string) => {
                      // Only include single words
                      if (!keyword.includes(' ') && !keyword.includes('+')) {
                        allKeywords.add(keyword);
                      }
                    });
                  }
                });

                const keywordArray = Array.from(allKeywords).slice(0, 15);
                setKeywords(keywordArray);
              }
            }
          }
        } catch (err) {
          // Only update error if this is still the latest request
          if (currentRequest === requestCounter.current) {
            console.error('[useChatKeywords] Extraction error:', err);
            setError(err instanceof Error ? err.message : 'Failed to extract keywords');
          }
        } finally {
          extractionInProgress.current = false;
          if (currentRequest === requestCounter.current) {
            setLoading(false);
          }
        }
      };

      // Start extraction without blocking
      performExtraction();
    }, 300); // 300ms debounce

    // Cleanup function
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [topicId, messages.length, topicAnalysis]); // Only re-run when topic, message count, or plan changes

  // Non-blocking update for new message
  const updateKeywordsForNewMessage = (messageText: string) => {
    if (!messageText) return;

    // Increment request counter
    const currentRequest = ++requestCounter.current;

    // Fire and forget - don't block on this
    const performUpdate = async () => {
      try {
        const model = getModel();
        if (!model.initialized) {
          console.log('[useChatKeywords] Skipping update - model not initialized yet');
          return;
        }

        console.log('[useChatKeywords] Updating keywords for new message (non-blocking)');

        const response = await topicAnalysis.extractRealtimeKeywords({
          text: messageText,
          existingKeywords: keywords,
          maxKeywords: 15
        });

        // Only update if this is still the latest request
        if (currentRequest === requestCounter.current) {
          if (response.success && response.data?.keywords) {
            setKeywords(response.data.keywords);
          }
        }
      } catch (err) {
        console.error('[useChatKeywords] Update error (non-blocking):', err);
        // Don't set error state for non-blocking updates
      }
    };

    // Start update without blocking
    performUpdate();
  };

  return {
    keywords,
    loading,
    error,
    updateKeywordsForNewMessage,
    keywordsJustAppeared
  };
}