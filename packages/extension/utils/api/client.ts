import ky, { type KyInstance, type Options, HTTPError } from "ky";
import { accessTokenStorage, refreshTokenStorage } from "../storage";

const API_BASE_URL = import.meta.env.VITE_OAUTH_BASE_URL;

/**
 * Flag to prevent multiple simultaneous token refresh attempts
 */
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Refreshes the access token using the refresh token
 * @returns true if refresh was successful, false otherwise
 */
async function refreshTokens(): Promise<boolean> {
  const accessToken = await accessTokenStorage.getValue();
  const refreshToken = await refreshTokenStorage.getValue();

  if (!accessToken || !refreshToken) {
    console.warn("[API] No tokens available for refresh");
    await clearTokens();
    return false;
  }

  try {
    console.log("[API] Refreshing tokens...");
    const response = await fetch(`${API_BASE_URL}/refresh-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessToken,
        refreshToken,
      }),
    });

    if (!response.ok) {
      console.error("[API] Token refresh failed:", response.status, response.statusText);
      await clearTokens();
      return false;
    }

    const data = await response.json() as { accessToken?: string; refreshToken?: string };

    if (data.accessToken && data.refreshToken) {
      await accessTokenStorage.setValue(data.accessToken);
      await refreshTokenStorage.setValue(data.refreshToken);
      console.log("[API] Tokens refreshed successfully");
      return true;
    } else {
      console.error("[API] Invalid token response:", data);
      await clearTokens();
      return false;
    }
  } catch (error) {
    console.error("[API] Token refresh error:", error);
    await clearTokens();
    return false;
  }
}

/**
 * Clears all stored tokens
 */
async function clearTokens(): Promise<void> {
  await accessTokenStorage.removeValue();
  await refreshTokenStorage.removeValue();
}

/**
 * Gets the current access token
 */
async function getAccessToken(): Promise<string | null> {
  return await accessTokenStorage.getValue();
}

/**
 * Creates the ky instance with authentication and token refresh handling
 */
function createApiClient(): KyInstance {
  return ky.create({
    prefixUrl: API_BASE_URL,
    hooks: {
      beforeRequest: [
        async (request) => {
          const token = await getAccessToken();
          if (token) {
            request.headers.set("Authorization", `Bearer ${token}`);
          }
        },
      ],
      afterResponse: [
        async (request, options, response) => {
          // If we get a 401, try to refresh the token and retry the request
          if (response.status === 401) {
            console.log("[API] Received 401, attempting token refresh...");

            // Prevent multiple simultaneous refresh attempts
            if (!isRefreshing) {
              isRefreshing = true;
              refreshPromise = refreshTokens();
            }

            const refreshSuccess = await refreshPromise;
            isRefreshing = false;
            refreshPromise = null;

            if (refreshSuccess) {
              // Retry the original request with the new token
              const newToken = await getAccessToken();
              if (newToken) {
                const newRequest = new Request(request, {
                  headers: new Headers(request.headers),
                });
                newRequest.headers.set("Authorization", `Bearer ${newToken}`);

                console.log("[API] Retrying request with new token...");
                return ky(newRequest, options);
              }
            }

            // If refresh failed, throw an error
            throw new Error("Authentication failed. Please log in again.");
          }

          return response;
        },
      ],
    },
    retry: {
      limit: 0, // We handle retries manually after token refresh
    },
  });
}

/**
 * The main API client instance
 */
export const api = createApiClient();

/**
 * Type-safe API methods
 */
export const apiClient = {
  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: Options): Promise<T> {
    return api.get(endpoint, options).json<T>();
  },

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: unknown, options?: Options): Promise<T> {
    return api.post(endpoint, { json: data, ...options }).json<T>();
  },

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: unknown, options?: Options): Promise<T> {
    return api.put(endpoint, { json: data, ...options }).json<T>();
  },

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, data?: unknown, options?: Options): Promise<T> {
    return api.delete(endpoint, { json: data, ...options }).json<T>();
  },

  /**
   * Check if the user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await getAccessToken();
    return token !== null;
  },

  /**
   * Get the current access token
   */
  getAccessToken,

  /**
   * Clear all tokens (logout)
   */
  clearTokens,

  /**
   * Manually refresh tokens
   */
  refreshTokens,
};

export { HTTPError };
