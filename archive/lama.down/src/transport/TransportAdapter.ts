/**
 * TransportAdapter - Client-side transport abstraction
 *
 * This interface provides a consistent API for React components to invoke
 * operations regardless of the underlying transport mechanism.
 */

/**
 * Base transport adapter interface
 */
export interface TransportAdapter {
  /**
   * Invoke a plan operation
   *
   * @param operation - Operation name in domain:method format
   * @param request - Request payload
   * @returns Promise resolving to response payload
   * @throws Error if operation fails
   */
  invoke<TRequest = any, TResponse = any>(
    operation: string,
    request: TRequest
  ): Promise<TResponse>;

  /**
   * Subscribe to events (optional)
   *
   * @param event - Event name to subscribe to
   * @param callback - Callback function to handle event data
   * @returns Unsubscribe function (optional)
   */
  subscribe?(event: string, callback: (data: any) => void): (() => void) | void;

  /**
   * Initialize the adapter
   */
  initialize?(): Promise<void>;

  /**
   * Shutdown the adapter
   */
  shutdown?(): Promise<void>;
}

/**
 * Standard response format from backend
 */
export interface OperationResponse<T> {
  success: boolean;
  result?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
    stack?: string;
  };
}
