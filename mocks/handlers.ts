import { http, HttpResponse } from 'msw';
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

interface DeleteTabGroupRequest {
  id: string;
}

interface CreateQRCodeRequest {
  id: string;
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

// Helper to generate unique IDs
function generateId(): string {
  return `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

// Helper to generate mock tokens
function generateTokens(): TokenDto {
  store.tokenCounter++;
  return {
    accessToken: `mock-access-token-${store.tokenCounter}`,
    refreshToken: `mock-refresh-token-${store.tokenCounter}`,
  };
}

export const handlers = [
  // Auth API
  http.post('*/refresh-tokens', async ({ request }) => {
    const body = await request.json() as TokenDto;
    console.log('[MSW] POST /refresh-tokens', body);

    // Simulate token refresh
    const newTokens = generateTokens();
    return HttpResponse.json(newTokens);
  }),

  http.get('*/oauth/complete', () => {
    console.log('[MSW] GET /oauth/complete');
    return new HttpResponse(null, { status: 200 });
  }),

  // StashSetting API
  http.get('*/stash-setting', () => {
    console.log('[MSW] GET /stash-setting');
    return HttpResponse.json(store.settings);
  }),

  http.put('*/stash-setting/update', async ({ request }) => {
    const body = await request.json() as StashSettingDto;
    console.log('[MSW] PUT /stash-setting/update', body);

    store.settings = body;
    return new HttpResponse(null, { status: 200 });
  }),

  // TabGroup API
  http.get('*/tab-group', () => {
    console.log('[MSW] GET /tab-group');
    const tabGroups = Array.from(store.tabGroups.values());
    return HttpResponse.json(tabGroups);
  }),

  http.post('*/tab-group', async ({ request }) => {
    const body = await request.json() as CreateTabGroupRequest;
    console.log('[MSW] POST /tab-group', body);

    const id = generateId();
    const tabGroup: TabGroupResponse = {
      id,
      secret: body.secret,
      salt: body.salt,
      browserTabInfos: body.browserTabInfos,
    };

    store.tabGroups.set(id, tabGroup);
    console.log('[MSW] Created tab group with ID:', id);

    return HttpResponse.json(tabGroup);
  }),

  http.delete('*/tab-group', async ({ request }) => {
    const body = await request.json() as DeleteTabGroupRequest;
    console.log('[MSW] DELETE /tab-group', body);

    if (!store.tabGroups.has(body.id)) {
      return new HttpResponse(null, { status: 404 });
    }

    store.tabGroups.delete(body.id);
    return new HttpResponse(null, { status: 200 });
  }),

  http.post('*/tab-group/qr-code', async ({ request }) => {
    const body = await request.json() as CreateQRCodeRequest;
    console.log('[MSW] POST /tab-group/qr-code', body);

    if (!store.tabGroups.has(body.id)) {
      return new HttpResponse(null, { status: 404 });
    }

    // Generate expiring QR code path
    const qrCodeId = `qr-${body.id}-${Date.now() + 600000}`;
    return HttpResponse.json({ path: `/tab-group/${qrCodeId}` });
  }),

  // Public endpoint for QR code access
  http.get('*/tab-group/:id', ({ params }) => {
    const { id } = params;
    console.log('[MSW] GET /tab-group/:id', id);

    // Check if it's a QR code ID (starts with 'qr-')
    if (typeof id === 'string' && id.startsWith('qr-')) {
      const parts = id.split('-');
      const originalId = parts.slice(1, -1).join('-');
      const expiry = parseInt(parts[parts.length - 1], 10);

      if (Date.now() > expiry) {
        return new HttpResponse(null, { status: 404 });
      }

      const tabGroup = store.tabGroups.get(originalId);
      if (!tabGroup) {
        return new HttpResponse(null, { status: 404 });
      }

      return HttpResponse.json(tabGroup);
    }

    // Direct access (for authenticated users)
    const tabGroup = store.tabGroups.get(id as string);
    if (!tabGroup) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(tabGroup);
  }),
];

// Export store for testing purposes
export { store };
