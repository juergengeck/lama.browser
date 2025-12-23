/**
 * Type-safe AI event system for Browser
 *
 * Uses centralized event registry from @lama/core/events as source of truth.
 * Provides platform-specific event emission via CustomEvent/window.dispatchEvent.
 */

import { Events, EventPayloads, EventName } from '@lama/core/events';

// Re-export for convenience
export { Events, EventPayloads, EventName };

/**
 * Type-safe AI event
 */
export type AIEvent<K extends EventName = EventName> = CustomEvent<EventPayloads[K]>;

/**
 * Type-safe event listener
 */
export type AIEventListener<K extends EventName> = (event: AIEvent<K>) => void;

/**
 * Emit a type-safe AI event via CustomEvent
 */
export function emitAIEvent<K extends EventName>(
  eventName: K,
  data: EventPayloads[K]
): void {
  const event = new CustomEvent(eventName, { detail: data });
  window.dispatchEvent(event);
}

/**
 * Add a type-safe AI event listener
 */
export function addAIEventListener<K extends EventName>(
  eventName: K,
  listener: AIEventListener<K>
): () => void {
  const wrappedListener = listener as EventListener;
  window.addEventListener(eventName, wrappedListener);

  return () => {
    window.removeEventListener(eventName, wrappedListener);
  };
}

/**
 * Remove a type-safe AI event listener
 */
export function removeAIEventListener<K extends EventName>(
  eventName: K,
  listener: AIEventListener<K>
): void {
  window.removeEventListener(eventName, listener as EventListener);
}
