/**
 * Type-safe AI event system
 *
 * Centralizes all AI event names and provides TypeScript types for event data.
 * Replaces string literals scattered throughout the codebase.
 */

/**
 * AI event names (centralized constants)
 */
export const AIEventNames = {
  PROGRESS: 'ai:progress',
  MESSAGE_STREAM: 'ai:messageStream',
  MESSAGE_COMPLETE: 'ai:messageComplete',
  ERROR: 'ai:error',
  ANALYSIS_UPDATE: 'ai:analysisUpdate',
} as const;

/**
 * Type for all AI event names
 */
export type AIEventName = typeof AIEventNames[keyof typeof AIEventNames];

/**
 * AI event data types
 */
export interface AIProgressData {
  topicId: string;
  progress: number;
}

export interface AIMessageStreamData {
  topicId: string;
  messageId: string;
  partial: string;
  modelId?: string;
  modelName?: string;
}

export interface AIMessageCompleteData {
  topicId: string;
  messageId: string;
  response: string;
  modelId?: string;
  modelName?: string;
}

export interface AIErrorData {
  topicId: string;
  error: Error | string;
}

export interface AIAnalysisUpdateData {
  topicId: string;
  type: 'subjects' | 'keywords' | 'both';
}

/**
 * Map of event names to their data types
 */
export interface AIEventDataMap {
  [AIEventNames.PROGRESS]: AIProgressData;
  [AIEventNames.MESSAGE_STREAM]: AIMessageStreamData;
  [AIEventNames.MESSAGE_COMPLETE]: AIMessageCompleteData;
  [AIEventNames.ERROR]: AIErrorData;
  [AIEventNames.ANALYSIS_UPDATE]: AIAnalysisUpdateData;
}

/**
 * Type-safe AI event
 */
export type AIEvent<K extends AIEventName = AIEventName> = CustomEvent<AIEventDataMap[K]>;

/**
 * Type-safe event listener
 */
export type AIEventListener<K extends AIEventName> = (event: AIEvent<K>) => void;

/**
 * Emit a type-safe AI event
 */
export function emitAIEvent<K extends AIEventName>(
  eventName: K,
  data: AIEventDataMap[K]
): void {
  const event = new CustomEvent(eventName, { detail: data });
  window.dispatchEvent(event);
}

/**
 * Add a type-safe AI event listener
 */
export function addAIEventListener<K extends AIEventName>(
  eventName: K,
  listener: AIEventListener<K>
): () => void {
  // Cast to EventListener for window.addEventListener compatibility
  const wrappedListener = listener as EventListener;
  window.addEventListener(eventName, wrappedListener);

  // Return cleanup function
  return () => {
    window.removeEventListener(eventName, wrappedListener);
  };
}

/**
 * Remove a type-safe AI event listener
 */
export function removeAIEventListener<K extends AIEventName>(
  eventName: K,
  listener: AIEventListener<K>
): void {
  window.removeEventListener(eventName, listener as EventListener);
}
