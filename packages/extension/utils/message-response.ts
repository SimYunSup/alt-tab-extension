/**
 * Message response utilities for consistent response patterns
 */

export interface SuccessResponse<T> {
  success: true;
  data?: T;
}

export interface ErrorResponse {
  success: false;
  error: string;
}

export type MessageResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

/**
 * Create a success response with optional data
 */
export function successResponse<T>(data?: T): SuccessResponse<T> {
  return { success: true, data };
}

/**
 * Create an error response from any error type
 */
export function errorResponse(error: unknown): ErrorResponse {
  return {
    success: false,
    error: error instanceof Error ? error.message : String(error),
  };
}

/**
 * Wrapper for async handlers used with chrome.runtime message listeners.
 * Handles the async/callback pattern required by the browser API.
 */
export function createAsyncHandler<T>(
  handler: () => Promise<T>,
  sendResponse: (response: MessageResponse<T>) => void
): void {
  handler()
    .then((data) => sendResponse(successResponse(data)))
    .catch((error) => sendResponse(errorResponse(error)));
}
