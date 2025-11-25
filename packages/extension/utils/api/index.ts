/**
 * API Client Module
 *
 * Provides a centralized API client with automatic token refresh handling.
 * All API calls that require authentication should use this module.
 *
 * @example
 * ```typescript
 * import { apiClient } from "@/utils/api";
 *
 * // GET request
 * const data = await apiClient.get<MyType>("endpoint");
 *
 * // POST request
 * const result = await apiClient.post<ResultType>("endpoint", { data: "value" });
 * ```
 */

export { api, apiClient, HTTPError } from "./client";
