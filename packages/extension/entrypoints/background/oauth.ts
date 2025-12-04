/**
 * OAuth flow handling module
 */

import { createLogger } from '@alt-tab/shared/logger';
import { accessTokenStorage, refreshTokenStorage } from '@/utils/storage';

const logger = createLogger('OAuth');

/**
 * Extracts tokens from OAuth redirect URL
 */
export function extractTokensFromUrl(url: string): { accessToken: string; refreshToken: string } | null {
  try {
    const urlObj = new URL(url);
    const hash = urlObj.hash;

    const accessToken = /access_token=([a-zA-Z0-9.\-_]+)/.exec(hash)?.[1];
    const refreshToken = /refresh_token=([a-zA-Z0-9.\-_]+)/.exec(hash)?.[1];

    if (!accessToken || !refreshToken) {
      return null;
    }

    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

/**
 * Saves tokens to storage
 */
export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await accessTokenStorage.setValue(accessToken);
  await refreshTokenStorage.setValue(refreshToken);
}

/**
 * Clears tokens from storage
 */
export async function clearTokens(): Promise<void> {
  await accessTokenStorage.removeValue();
  await refreshTokenStorage.removeValue();
}

/**
 * Refreshes tokens using the refresh token
 */
export async function refreshTokens(
  providedAccessToken?: string,
  providedRefreshToken?: string
): Promise<boolean> {
  const accessToken = providedAccessToken ?? await accessTokenStorage.getValue() ?? undefined;
  const refreshToken = providedRefreshToken ?? await refreshTokenStorage.getValue() ?? undefined;

  if (!accessToken || !refreshToken) {
    await clearTokens();
    return false;
  }

  try {
    const response = await fetch(`${import.meta.env.VITE_OAUTH_BASE_URL}/refresh-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, refreshToken }),
    });

    if (!response.ok) {
      logger.error('Failed to refresh tokens:', response.statusText);
      return false;
    }

    const data = await response.json() as { accessToken?: string; refreshToken?: string };

    if (data.accessToken && data.refreshToken) {
      await saveTokens(data.accessToken, data.refreshToken);
      logger.info('Tokens refreshed successfully');
      return true;
    }

    logger.error('Invalid token response:', data);
    return false;
  } catch (error) {
    logger.error('Token refresh error:', error);
    return false;
  }
}

/**
 * Checks if a URL is an OAuth callback URL
 */
export function isOAuthCallbackUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes(import.meta.env.VITE_OAUTH_BASE_URL) && url.includes('#access_token=');
}

/**
 * Handles OAuth callback - extracts and saves tokens
 */
export function handleOAuthCallback(url: string): { accessToken: string; refreshToken: string } | null {
  const tokens = extractTokensFromUrl(url);
  if (tokens) {
    saveTokens(tokens.accessToken, tokens.refreshToken);
  }
  return tokens;
}
