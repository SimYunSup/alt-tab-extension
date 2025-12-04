import { useState, useEffect, useCallback } from 'react';

// Extension IDs for external messaging
const CHROME_EXTENSION_ID = import.meta.env.VITE_CHROME_EXTENSION_ID;
const FIREFOX_EXTENSION_ID = import.meta.env.VITE_FIREFOX_EXTENSION_ID;

// Browser API types
declare const chrome: {
  runtime?: {
    sendMessage?: (extensionId: string, message: unknown) => Promise<{ success?: boolean; url?: string }>;
  };
} | undefined;

declare const browser: {
  runtime?: {
    sendMessage?: (extensionId: string, message: unknown) => Promise<{ success?: boolean; url?: string }>;
  };
} | undefined;

export type ExtensionState = 'checking' | 'not_found' | 'redirecting';

function isFirefox(): boolean {
  return navigator.userAgent.toLowerCase().includes('firefox');
}

function getRuntime() {
  return isFirefox()
    ? (typeof browser !== 'undefined' ? browser?.runtime : undefined)
    : (typeof chrome !== 'undefined' ? chrome?.runtime : undefined);
}

function getExtensionId(): string | undefined {
  return isFirefox() ? FIREFOX_EXTENSION_ID : CHROME_EXTENSION_ID;
}

interface UseExtensionDetectionResult {
  state: ExtensionState;
  retry: () => void;
}

const DETECTION_TIMEOUT_MS = 2000;

/**
 * Custom hook to detect the Alt-Tab extension and handle redirection
 */
export function useExtensionDetection(): UseExtensionDetectionResult {
  const [state, setState] = useState<ExtensionState>('checking');

  const checkExtension = useCallback(async () => {
    setState('checking');

    const extensionId = getExtensionId();
    const runtime = getRuntime();

    // Try external messaging first (direct communication with extension)
    if (runtime?.sendMessage && extensionId) {
      try {
        const response = await runtime.sendMessage(extensionId, {
          type: 'get_redirect_url',
          search: window.location.search,
        });

        if (response?.success && response?.url) {
          setState('redirecting');
          window.location.href = response.url;
          return;
        }
      } catch {
        // Extension not available via external messaging
      }
    }

    // Fallback: Try content script communication via postMessage
    let redirected = false;
    let pongReceived = false;

    const messageHandler = (event: MessageEvent) => {
      if (event.data?.source !== 'alt-tab-extension') return;

      if (event.data.type === 'pong' && !pongReceived) {
        pongReceived = true;
        window.postMessage({
          source: 'alt-tab-web',
          type: 'get_redirect_url',
          search: window.location.search,
        }, '*');
      }

      if (event.data.type === 'redirect_url_response' && event.data.data?.url) {
        redirected = true;
        window.removeEventListener('message', messageHandler);
        setState('redirecting');
        window.location.href = event.data.data.url;
      }
    };

    window.addEventListener('message', messageHandler);

    // Ping extension via content script
    window.postMessage({ source: 'alt-tab-web', type: 'ping' }, '*');

    // Set timeout for extension detection
    setTimeout(() => {
      if (!redirected) {
        window.removeEventListener('message', messageHandler);
        setState('not_found');
      }
    }, DETECTION_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    checkExtension();
  }, [checkExtension]);

  return {
    state,
    retry: checkExtension,
  };
}
