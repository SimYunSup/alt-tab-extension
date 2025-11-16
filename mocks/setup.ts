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
  console.log('[Mock API] Mock API is now active');
}

export function teardownMockAPI() {
  globalThis.fetch = originalFetch;
  console.log('[Mock API] Mock API disabled');
}

export { store };
