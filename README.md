![logo](./docs/logo.png)

# Alt-Tab

> [!WARNING]
>
> This project is Work in Progress. Currently developing.

[![License: MIT][license-image]][license-url]

[한국어](./README.ko.md) | English

## Overview

Alt-Tab is a browser extension and web application for intelligent tab management with cloud sync and secure sharing capabilities. It automatically detects and stores inactive tabs, keeping your workspace clean while allowing easy restoration across devices.

**Repositories**
- Frontend: [SimYunSup/alt-tab-extension](https://github.com/SimYunSup/alt-tab-extension)
- Backend: [knight7024/alt-tab](https://github.com/knight7024/alt-tab)

## Monorepo Structure

This is a pnpm monorepo containing:

- **`packages/extension`** - Browser extension (Chrome, Firefox)
- **`packages/web`** - Web app for QR code tab sharing and restoration

## Features

### Browser Extension

- **Automatic Tab Management**
  - Detects and stores tabs that have been inactive for a defined period (1-240 minutes)
  - Multiple inactivity detection modes:
    | Mode | Description | Support |
    |------|-------------|---------|
    | window | Inactive on window/tab switch | All browsers |
    | visibility | Inactive when tab is hidden | All browsers |
    | idle | Inactive when no user interaction | Chrome/Edge only |
  - Tab protection options: ignore unloaded tabs, audio-playing tabs, pinned tabs, container/group tabs
- **URL-Specific Rules**
  - Apply custom settings for specific websites using URL patterns
- **Cloud Sync**
  - Sync settings and tabs across devices via Google OAuth
- **Tab Archiving**
  - Archive tab groups with end-to-end encryption (PIN-based, Argon2id + AES-256-GCM)
  - Share tab groups via QR code for cross-device restoration

### Web Application

- **QR Code Tab Restoration**
  - Scan QR codes to restore shared tab groups
  - PIN-based decryption for security
  - Extension detection and installation guidance
  - Fallback to direct tab opening if extension not installed

## Development

### Prerequisites

- Node.js 18+
- pnpm 10+

### Installation

```bash
# Install dependencies for all packages
pnpm install
```

### Development Commands

```bash
# Run extension in development mode (Chrome)
pnpm dev

# Run extension in Firefox
pnpm dev:firefox

# Run web app
pnpm dev:web

# Build all packages
pnpm build:all

# Build extension only
pnpm build

# Build web app only
pnpm build:web
```

### Package Scripts

#### Extension (`packages/extension`)

```bash
cd packages/extension

# Development
pnpm dev              # Chrome
pnpm dev:firefox      # Firefox

# Build
pnpm build            # Production build for Chrome
pnpm build:firefox    # Production build for Firefox

# Package
pnpm zip              # Create .zip for distribution
pnpm zip:firefox      # Firefox .zip

# Test
pnpm test             # Run tests
```

#### Web App (`packages/web`)

```bash
cd packages/web

# Development
pnpm dev              # Start dev server

# Build
pnpm build            # Production build

# Preview
pnpm preview          # Preview production build
```

## Environment Variables

### Extension

Create `.env` in `packages/extension/`:

```env
# Backend API URL (required for OAuth and API calls)
VITE_OAUTH_BASE_URL=http://localhost:8080

# For production:
# VITE_OAUTH_BASE_URL=https://your-backend-domain.com
```

### Web App

Create `.env` in `packages/web/`:

```env
# Backend API URL
VITE_API_BASE_URL=http://localhost:8080

# For production:
# VITE_API_BASE_URL=https://your-backend-domain.com
```

## Tech Stack

### Extension
- **Framework**: WXT (Browser extension framework)
- **UI**: React, Tailwind CSS, Radix UI, Lucide React
- **Data**: Dexie (IndexedDB), webext-bridge (messaging)
- **Security**: hash-wasm (Argon2id), Web Crypto API (AES-256-GCM)
- **Language**: TypeScript

### Web App
- **Framework**: Vite, React
- **UI**: Tailwind CSS, Radix UI

### Supported Browsers
- Chrome / Edge (Manifest V3)
- Firefox (Manifest V2)

## Architecture

### Tab Sharing Flow

1. **Extension**: User archives tab group with PIN
   - Tab data encrypted with PIN-derived key (Argon2id)
   - Sent to backend server
2. **Backend**: Stores encrypted tab group, generates share URL
3. **QR Code**: Extension generates QR code with share URL
4. **Web App**:
   - User scans QR code → opens share URL
   - Detects if extension is installed (via content script bridge)
   - User enters PIN → decrypts tab group
   - Restores tabs via extension or direct browser API

### Extension-Web Communication

Web app communicates with extension using:
- **Content Script Bridge** (`entrypoints/content/bridge.ts`)
- **window.postMessage** API for cross-context messaging
- No direct chrome.runtime access from web page

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Documentation

- [Technical Documentation (Korean)](./docs/README.md) - Detailed architecture and API reference
- [E2EE Architecture (Korean)](./docs/E2EE-ARCHITECTURE.md) - End-to-end encryption design

## License

[MIT](LICENSE.md)

## References

- [WXT Framework](https://wxt.dev/)
- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/)
- [Firefox WebExtensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)

[license-image]: https://img.shields.io/badge/License-MIT-brightgreen.svg?style=flat-square
[license-url]: https://opensource.org/licenses/MIT
