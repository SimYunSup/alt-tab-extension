import { beforeEach } from 'vitest';
import { fakeBrowser } from '@webext-core/fake-browser';

// Setup fake browser for testing
// @ts-ignore
globalThis.browser = fakeBrowser;
// @ts-ignore
globalThis.chrome = fakeBrowser;

// Reset fake browser before each test
beforeEach(() => {
  fakeBrowser.reset();
});
