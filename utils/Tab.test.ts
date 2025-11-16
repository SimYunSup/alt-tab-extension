import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Browser } from 'wxt/browser';
import type { Setting } from '@/types/data';

// Mock wxt/browser
vi.mock('wxt/browser', () => ({
  browser: {
    contextualIdentities: {
      get: vi.fn(),
    },
  },
}));

// Import after mocking
const { isClosableTab } = await import('./Tab');
const { browser } = await import('wxt/browser');

describe('isClosableTab', () => {
  const defaultSetting: Setting = {
    globalRule: {
      idleCondition: 'window',
      idleTimeout: 1,
      ignoreUnloadedTab: false,
      ignoreAudibleTab: false,
      allowPinnedTab: false,
      ignoreContainerTab: false,
    },
    whitelistUrls: {},
  };

  const createTab = (overrides: Partial<Browser.tabs.Tab> = {}): Browser.tabs.Tab => ({
    id: 1,
    index: 0,
    highlighted: false,
    active: false,
    pinned: false,
    windowId: 1,
    incognito: false,
    url: 'https://example.com',
    title: 'Example',
    frozen: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
    ...overrides,
  } as Browser.tabs.Tab);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('globalRule behavior', () => {
    it('should return true for normal tab with default settings', async () => {
      const tab = createTab();
      const result = await isClosableTab(tab, defaultSetting);
      expect(result).toBe(true);
    });

    it('should return false when tab is unloaded and ignoreUnloadedTab is true', async () => {
      const tab = createTab({ status: 'unloaded' });
      const setting: Setting = {
        ...defaultSetting,
        globalRule: {
          ...defaultSetting.globalRule,
          ignoreUnloadedTab: true,
        },
      };

      const result = await isClosableTab(tab, setting);
      expect(result).toBe(false);
    });

    it('should return true when tab is unloaded but ignoreUnloadedTab is false', async () => {
      const tab = createTab({ status: 'unloaded' });
      const result = await isClosableTab(tab, defaultSetting);
      expect(result).toBe(true);
    });

    it('should return false when tab is pinned and allowPinnedTab is true', async () => {
      const tab = createTab({ pinned: true });
      const setting: Setting = {
        ...defaultSetting,
        globalRule: {
          ...defaultSetting.globalRule,
          allowPinnedTab: true,
        },
      };

      const result = await isClosableTab(tab, setting);
      expect(result).toBe(false);
    });

    it('should return true when tab is pinned but allowPinnedTab is false', async () => {
      const tab = createTab({ pinned: true });
      const result = await isClosableTab(tab, defaultSetting);
      expect(result).toBe(true);
    });

    it('should return false when tab is audible and ignoreAudibleTab is false', async () => {
      const tab = createTab({ audible: true });
      const result = await isClosableTab(tab, defaultSetting);
      expect(result).toBe(false);
    });

    it('should return true when tab is audible but ignoreAudibleTab is true', async () => {
      const tab = createTab({ audible: true });
      const setting: Setting = {
        ...defaultSetting,
        globalRule: {
          ...defaultSetting.globalRule,
          ignoreAudibleTab: true,
        },
      };

      const result = await isClosableTab(tab, setting);
      expect(result).toBe(true);
    });

    it('should return false when tab has groupId and ignoreContainerTab is true', async () => {
      const tab = createTab({ groupId: 123 });
      const setting: Setting = {
        ...defaultSetting,
        globalRule: {
          ...defaultSetting.globalRule,
          ignoreContainerTab: true,
        },
      };

      const result = await isClosableTab(tab, setting);
      expect(result).toBe(false);
    });

    it('should return true when tab has groupId but ignoreContainerTab is false', async () => {
      const tab = createTab({ groupId: 123 });
      const result = await isClosableTab(tab, defaultSetting);
      expect(result).toBe(true);
    });
  });

  describe('whitelistUrls priority', () => {
    it('should apply whitelistUrls rules over globalRule', async () => {
      const tab = createTab({ url: 'https://whitelist.com', pinned: true });
      const setting: Setting = {
        globalRule: {
          ...defaultSetting.globalRule,
          allowPinnedTab: false, // Global: ignore pinned tabs
        },
        whitelistUrls: {
          'https://whitelist.com': {
            idleCondition: 'window',
            idleTimeout: 10,
            allowPinnedTab: true, // Whitelist: allow pinned tabs
          },
        },
      };

      const result = await isClosableTab(tab, setting);
      expect(result).toBe(false); // Should use whitelist rule (allowPinnedTab: true)
    });

    it('should merge whitelistUrls with globalRule', async () => {
      const tab = createTab({ url: 'https://whitelist.com', status: 'unloaded' });
      const setting: Setting = {
        globalRule: {
          ...defaultSetting.globalRule,
          ignoreUnloadedTab: true, // This should still apply
        },
        whitelistUrls: {
          'https://whitelist.com': {
            idleCondition: 'window',
            idleTimeout: 10,
            // ignoreUnloadedTab not specified, should inherit from globalRule
          },
        },
      };

      const result = await isClosableTab(tab, setting);
      expect(result).toBe(false); // Should inherit ignoreUnloadedTab from globalRule
    });

    it('should not apply whitelistUrls for non-matching URL', async () => {
      const tab = createTab({ url: 'https://other.com', pinned: true });
      const setting: Setting = {
        globalRule: {
          ...defaultSetting.globalRule,
          allowPinnedTab: false,
        },
        whitelistUrls: {
          'https://whitelist.com': {
            idleCondition: 'window',
            idleTimeout: 10,
            allowPinnedTab: true,
          },
        },
      };

      const result = await isClosableTab(tab, setting);
      expect(result).toBe(true); // Should use globalRule (allowPinnedTab: false)
    });
  });

  describe('multiple conditions', () => {
    it('should respect condition priority (ignoreUnloadedTab checked first)', async () => {
      const tab = createTab({
        status: 'unloaded',
        pinned: true,
        audible: true,
      });
      const setting: Setting = {
        globalRule: {
          idleCondition: 'window',
          idleTimeout: 1,
          ignoreUnloadedTab: true,
          allowPinnedTab: true,
          ignoreAudibleTab: false,
          ignoreContainerTab: false,
        },
        whitelistUrls: {},
      };

      const result = await isClosableTab(tab, setting);
      expect(result).toBe(false); // Should return false on first condition (ignoreUnloadedTab)
    });

    it('should check allowPinnedTab after ignoreUnloadedTab', async () => {
      const tab = createTab({
        status: 'loading', // Not unloaded
        pinned: true,
        audible: true,
      });
      const setting: Setting = {
        globalRule: {
          idleCondition: 'window',
          idleTimeout: 1,
          ignoreUnloadedTab: true,
          allowPinnedTab: true,
          ignoreAudibleTab: false,
          ignoreContainerTab: false,
        },
        whitelistUrls: {},
      };

      const result = await isClosableTab(tab, setting);
      expect(result).toBe(false); // Should return false on second condition (allowPinnedTab)
    });

    it('should check ignoreAudibleTab after allowPinnedTab', async () => {
      const tab = createTab({
        status: 'loading',
        pinned: false,
        audible: true,
      });
      const setting: Setting = {
        globalRule: {
          idleCondition: 'window',
          idleTimeout: 1,
          ignoreUnloadedTab: true,
          allowPinnedTab: true,
          ignoreAudibleTab: false,
          ignoreContainerTab: false,
        },
        whitelistUrls: {},
      };

      const result = await isClosableTab(tab, setting);
      expect(result).toBe(false); // Should return false on third condition (audible + ignoreAudibleTab: false)
    });

    it('should return true when no blocking conditions are met', async () => {
      const tab = createTab({
        status: 'loading',
        pinned: false,
        audible: false,
        groupId: undefined,
      });
      const setting: Setting = {
        globalRule: {
          idleCondition: 'window',
          idleTimeout: 1,
          ignoreUnloadedTab: true,
          allowPinnedTab: true,
          ignoreAudibleTab: false,
          ignoreContainerTab: true,
        },
        whitelistUrls: {},
      };

      const result = await isClosableTab(tab, setting);
      expect(result).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle tab without URL', async () => {
      const tab = createTab({ url: undefined });
      const setting: Setting = {
        ...defaultSetting,
        whitelistUrls: {
          '': {
            idleCondition: 'window',
            idleTimeout: 0,
          },
        },
      };

      const result = await isClosableTab(tab, setting);
      // Should use whitelistUrls[''] rule
      expect(result).toBe(true);
    });

    it('should handle tab with undefined audible property', async () => {
      const tab = createTab({ audible: undefined });
      const result = await isClosableTab(tab, defaultSetting);
      expect(result).toBe(true);
    });

    it('should handle tab with undefined status', async () => {
      const tab = createTab({ status: undefined });
      const setting: Setting = {
        ...defaultSetting,
        globalRule: {
          ...defaultSetting.globalRule,
          ignoreUnloadedTab: true,
        },
      };

      const result = await isClosableTab(tab, setting);
      expect(result).toBe(true); // undefined !== 'unloaded'
    });

    it('should handle empty whitelistUrls', async () => {
      const tab = createTab();
      const setting: Setting = {
        ...defaultSetting,
        whitelistUrls: {},
      };

      const result = await isClosableTab(tab, setting);
      expect(result).toBe(true);
    });
  });

  // Note: Firefox contextualIdentities tests are skipped
  // because import.meta.env.FIREFOX cannot be easily mocked in Vitest
  // These should be covered by integration/E2E tests in a Firefox environment
});
