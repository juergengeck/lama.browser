/**
 * Throttled Streaming Content Hook
 *
 * Throttles updates to streaming content to improve markdown rendering performance.
 * ReactMarkdown can be expensive to re-render on every character, so we throttle
 * updates to a reasonable interval while ensuring the final content is always shown.
 */

import { useState, useEffect, useRef } from 'react';

const THROTTLE_INTERVAL_MS = 100; // Update at most every 100ms during streaming

export function useThrottledStreamingContent(
  rawContent: string,
  isProcessing: boolean
): string {
  const [throttledContent, setThrottledContent] = useState(rawContent);
  const lastUpdateRef = useRef(0);
  const pendingUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // If no content, clear immediately
    if (!rawContent) {
      setThrottledContent('');
      return;
    }

    // If processing just finished, show final content immediately
    if (!isProcessing) {
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }
      setThrottledContent(rawContent);
      return;
    }

    // During streaming, throttle updates
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    if (timeSinceLastUpdate >= THROTTLE_INTERVAL_MS) {
      // Enough time has passed, update immediately
      lastUpdateRef.current = now;
      setThrottledContent(rawContent);
    } else {
      // Too soon, schedule an update
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
      }

      const delay = THROTTLE_INTERVAL_MS - timeSinceLastUpdate;
      pendingUpdateRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          lastUpdateRef.current = Date.now();
          setThrottledContent(rawContent);
          pendingUpdateRef.current = null;
        }
      }, delay);
    }
  }, [rawContent, isProcessing]);

  return throttledContent;
}
