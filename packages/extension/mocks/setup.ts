import type { BrowserTabInfoDto, TabGroupResponse } from '@/utils/ArchivedTabGroup';

// In-memory storage for mock data
interface MockStore {
  tabGroups: Map<string, TabGroupResponse>;
  settings: StashSettingDto;
  tokenCounter: number;
}

interface StashSettingDto {
  globalRule: StashRuleDto;
  whitelistUrls: Record<string, StashRuleDto | null>;
}

interface StashRuleDto {
  idleCondition: string;
  idleTimeout: number;
  ignoreUnloadedTab: boolean;
  ignoreAudibleTab: boolean;
  ignoreContainerTab?: boolean;
  allowPinnedTab: boolean;
}

interface TokenDto {
  accessToken: string;
  refreshToken: string;
}

interface CreateTabGroupRequest {
  secret: string;
  salt: string;
  browserTabInfos: BrowserTabInfoDto[];
}

const store: MockStore = {
  tabGroups: new Map(),
  settings: {
    globalRule: {
      idleCondition: 'idle',
      idleTimeout: 30,
      ignoreUnloadedTab: true,
      ignoreAudibleTab: true,
      ignoreContainerTab: false,
      allowPinnedTab: false,
    },
    whitelistUrls: {},
  },
  tokenCounter: 0,
};

function generateId(): string {
  return `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

function generateTokens(): TokenDto {
  store.tokenCounter++;
  return {
    accessToken: `mock-access-token-${store.tokenCounter}`,
    refreshToken: `mock-refresh-token-${store.tokenCounter}`,
  };
}

// Create sample tab groups for testing
function createSampleTabGroups() {
  const now = Math.floor(Date.now() / 1000);

  // Sample group 1: Development tabs
  // Note: These are placeholder secrets/salts. PIN verification won't work with these.
  // To test PIN verification, create a new tab group with your own PIN.
  const group1: TabGroupResponse = {
    id: 'sample-dev-tabs',
    secret: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // 32 bytes base64
    salt: 'AAAAAAAAAAAAAAAAAAAAAA==', // 16 bytes base64
    createdAt: now - 3600, // 1 hour ago
    browserTabInfos: [
      {
        windowId: '1',
        groupId: null,
        tabIndex: 0,
        title: 'GitHub - Your Repositories',
        url: 'https://github.com',
        faviconUrl: 'https://github.com/favicon.ico',
        incognito: false,
        scrollPosition: { x: 0, y: 150 },
        lastUsedAgent: 'Chrome/120.0',
        lastActiveAt: now - 3600,
        session: '{}',
        cookie: '[]',
      },
      {
        windowId: '1',
        groupId: null,
        tabIndex: 1,
        title: 'Stack Overflow - Where Developers Learn',
        url: 'https://stackoverflow.com',
        faviconUrl: 'https://stackoverflow.com/favicon.ico',
        incognito: false,
        scrollPosition: { x: 0, y: 0 },
        lastUsedAgent: 'Chrome/120.0',
        lastActiveAt: now - 3500,
        session: '{}',
        cookie: '[]',
      },
      {
        windowId: '1',
        groupId: null,
        tabIndex: 2,
        title: 'MDN Web Docs',
        url: 'https://developer.mozilla.org',
        faviconUrl: 'https://developer.mozilla.org/favicon.ico',
        incognito: false,
        scrollPosition: { x: 0, y: 300 },
        lastUsedAgent: 'Chrome/120.0',
        lastActiveAt: now - 3400,
        session: '{}',
        cookie: '[]',
      },
    ],
  };

  // Sample group 2: Shopping tabs
  const group2: TabGroupResponse = {
    id: 'sample-shopping-tabs',
    secret: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=', // 32 bytes base64
    salt: 'BBBBBBBBBBBBBBBBBBBBBB==', // 16 bytes base64
    createdAt: now - 86400, // 1 day ago
    browserTabInfos: [
      {
        windowId: '2',
        groupId: null,
        tabIndex: 0,
        title: 'Amazon.com: Online Shopping',
        url: 'https://www.amazon.com',
        faviconUrl: 'https://www.amazon.com/favicon.ico',
        incognito: false,
        scrollPosition: { x: 0, y: 500 },
        lastUsedAgent: 'Chrome/120.0',
        lastActiveAt: now - 86400,
        session: '{}',
        cookie: '[]',
      },
      {
        windowId: '2',
        groupId: null,
        tabIndex: 1,
        title: 'eBay | Electronics, Cars, Fashion',
        url: 'https://www.ebay.com',
        faviconUrl: 'https://www.ebay.com/favicon.ico',
        incognito: false,
        scrollPosition: { x: 0, y: 200 },
        lastUsedAgent: 'Chrome/120.0',
        lastActiveAt: now - 86300,
        session: '{}',
        cookie: '[]',
      },
    ],
  };

  // Sample group 3: Research tabs
  const group3: TabGroupResponse = {
    id: 'sample-research-tabs',
    secret: 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=', // 32 bytes base64
    salt: 'CCCCCCCCCCCCCCCCCCCCCC==', // 16 bytes base64
    createdAt: now - 604800, // 1 week ago
    browserTabInfos: [
      {
        windowId: '3',
        groupId: null,
        tabIndex: 0,
        title: 'Wikipedia, the free encyclopedia',
        url: 'https://www.wikipedia.org',
        faviconUrl: 'https://www.wikipedia.org/favicon.ico',
        incognito: false,
        scrollPosition: { x: 0, y: 0 },
        lastUsedAgent: 'Chrome/120.0',
        lastActiveAt: now - 604800,
        session: '{}',
        cookie: '[]',
      },
      {
        windowId: '3',
        groupId: null,
        tabIndex: 1,
        title: 'Google Scholar',
        url: 'https://scholar.google.com',
        faviconUrl: 'https://scholar.google.com/favicon.ico',
        incognito: false,
        scrollPosition: { x: 0, y: 100 },
        lastUsedAgent: 'Chrome/120.0',
        lastActiveAt: now - 604700,
        session: '{}',
        cookie: '[]',
      },
      {
        windowId: '3',
        groupId: null,
        tabIndex: 2,
        title: 'arXiv.org e-Print archive',
        url: 'https://arxiv.org',
        faviconUrl: 'https://arxiv.org/favicon.ico',
        incognito: false,
        scrollPosition: { x: 0, y: 250 },
        lastUsedAgent: 'Chrome/120.0',
        lastActiveAt: now - 604600,
        session: '{}',
        cookie: '[]',
      },
      {
        windowId: '3',
        groupId: null,
        tabIndex: 3,
        title: 'ResearchGate | Find and share research',
        url: 'https://www.researchgate.net',
        faviconUrl: 'https://www.researchgate.net/favicon.ico',
        incognito: false,
        scrollPosition: { x: 0, y: 0 },
        lastUsedAgent: 'Chrome/120.0',
        lastActiveAt: now - 604500,
        session: '{}',
        cookie: '[]',
      },
    ],
  };

  store.tabGroups.set(group1.id, group1);
  store.tabGroups.set(group2.id, group2);
  store.tabGroups.set(group3.id, group3);

  console.log('[Mock API] Created 3 sample tab groups');
}

const originalFetch = globalThis.fetch;

async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method || 'GET';

  console.log(`[Mock API] ${method} ${url}`);

  // Auth API
  if (url.includes('/refresh-tokens') && method === 'POST') {
    const body = JSON.parse(init?.body as string) as TokenDto;
    console.log('[Mock API] Token refresh request:', body);
    const newTokens = generateTokens();
    return new Response(JSON.stringify(newTokens), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.includes('/oauth/complete') && method === 'GET') {
    return new Response(null, { status: 200 });
  }

  // StashSetting API
  if (url.includes('/stash-setting') && !url.includes('/update') && method === 'GET') {
    return new Response(JSON.stringify(store.settings), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.includes('/stash-setting/update') && method === 'PUT') {
    const body = JSON.parse(init?.body as string) as StashSettingDto;
    console.log('[Mock API] Update settings:', body);
    store.settings = body;
    return new Response(null, { status: 200 });
  }

  // TabGroup API
  if (url.match(/\/tab-group\/qr-code$/) && method === 'POST') {
    const body = JSON.parse(init?.body as string) as { id: string };
    console.log('[Mock API] Generate QR code for:', body.id);

    if (!store.tabGroups.has(body.id)) {
      return new Response(null, { status: 404 });
    }

    const qrCodeId = `qr-${body.id}-${Date.now() + 600000}`;
    return new Response(JSON.stringify({ path: `/tab-group/${qrCodeId}` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.match(/\/tab-group\/[^/]+$/) && method === 'GET') {
    const id = url.split('/').pop()!;
    console.log('[Mock API] Get tab group:', id);

    if (id.startsWith('qr-')) {
      const parts = id.split('-');
      const expiry = parseInt(parts[parts.length - 1], 10);
      const originalId = parts.slice(1, -1).join('-');

      if (Date.now() > expiry) {
        return new Response(null, { status: 404 });
      }

      const tabGroup = store.tabGroups.get(originalId);
      if (!tabGroup) {
        return new Response(null, { status: 404 });
      }

      return new Response(JSON.stringify(tabGroup), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tabGroup = store.tabGroups.get(id);
    if (!tabGroup) {
      return new Response(null, { status: 404 });
    }

    return new Response(JSON.stringify(tabGroup), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.match(/\/tab-group$/) && method === 'GET') {
    const tabGroups = Array.from(store.tabGroups.values());
    console.log('[Mock API] Get all tab groups:', tabGroups.length);
    return new Response(JSON.stringify(tabGroups), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.match(/\/tab-group$/) && method === 'POST') {
    const body = JSON.parse(init?.body as string) as CreateTabGroupRequest;
    console.log('[Mock API] Create tab group:', body);

    const id = generateId();
    const tabGroup: TabGroupResponse = {
      id,
      secret: body.secret,
      salt: body.salt,
      browserTabInfos: body.browserTabInfos,
      createdAt: Math.floor(Date.now() / 1000), // epoch seconds
    };

    store.tabGroups.set(id, tabGroup);
    console.log('[Mock API] Created tab group with ID:', id);

    return new Response(JSON.stringify(tabGroup), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.match(/\/tab-group$/) && method === 'DELETE') {
    const body = JSON.parse(init?.body as string) as { id: string };
    console.log('[Mock API] Delete tab group:', body.id);

    if (!store.tabGroups.has(body.id)) {
      return new Response(null, { status: 404 });
    }

    store.tabGroups.delete(body.id);
    return new Response(null, { status: 200 });
  }

  // Fallback to original fetch
  console.log('[Mock API] Passing through to real fetch:', url);
  return originalFetch(input, init);
}

export function setupMockAPI() {
  console.log('[Mock API] Setting up mock API...');
  globalThis.fetch = mockFetch;
  createSampleTabGroups();
  console.log('[Mock API] Mock API is now active');
}

export function teardownMockAPI() {
  globalThis.fetch = originalFetch;
  console.log('[Mock API] Mock API disabled');
}

export { store };
