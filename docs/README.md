# Alt-Tab Extension

비활성 탭을 자동으로 감지하고 저장하는 브라우저 확장 프로그램

[메인 README (한국어)](../README.ko.md) | [Main README (English)](../README.md)

**저장소**
- Frontend: [SimYunSup/alt-tab-extension](https://github.com/SimYunSup/alt-tab-extension)
- Backend: [knight7024/alt-tab](https://github.com/knight7024/alt-tab)

## 목차
- [핵심 기능](#핵심-기능)
- [기술 스택](#기술-스택)
- [아키텍처](#아키텍처)
- [데이터베이스](#데이터베이스)
- [보안](#보안)
- [개발 가이드](#개발-가이드)

## 핵심 기능

### 자동 탭 관리
- 설정한 시간 동안 비활성 상태인 탭 자동 감지 및 닫기
- IndexedDB에 탭 정보 저장, 언제든 복원 가능
- 비활성 시간 임계값: 1-240분

### 비활성 감지 모드
| 모드 | 설명 | 지원 |
|------|------|------|
| window | 윈도우/탭 전환 시 비활성 | All |
| visibility | 탭이 숨겨질 때 비활성 | All |
| idle | 사용자 상호작용 없을 때 | Chrome/Edge |

### 탭 보호 옵션
- 언로드된 탭 무시
- 오디오 재생 중인 탭 무시
- 고정 탭 제외
- 컨테이너/그룹 탭 무시

### URL별 커스텀 규칙
브라우저 활동에 따라 동작 자동 조정, URL별 개별 규칙 설정 가능

### 디바이스 동기화
Google OAuth 인증으로 설정을 여러 디바이스에서 동기화

### 탭 그룹 아카이빙
- 여러 탭을 그룹으로 서버에 저장
- PIN 코드 보호
- E2EE 종단간 암호화
- QR 코드를 통한 디바이스 간 공유

## 기술 스택

### Frontend

**Core**
- WXT - 브라우저 확장 프레임워크
- React
- TypeScript
- Tailwind CSS

**UI**
- Radix UI - 접근성 UI 컴포넌트
- Lucide React - 아이콘
- Sonner - 토스트 알림

**Data**
- Dexie - IndexedDB wrapper
- Ky - HTTP 클라이언트
- webext-bridge - 메시지 전달

**Security**
- hash-wasm - Argon2id PIN 기반 키 파생
- Web Crypto API - AES-256-GCM 암호화

**Supported Browsers**: Chrome, Edge (Manifest V3), Firefox (Manifest V2)

### Backend

- Kotlin 100%
- Ktor - 비동기 웹 프레임워크
- MongoDB - NoSQL DB
- JWT Bearer Authentication, OAuth
- Swagger UI

## 아키텍처

### 디렉토리 구조

```
packages/
├── extension/                  # 브라우저 확장 프로그램
│   ├── entrypoints/
│   │   ├── background/         # 서비스 워커
│   │   │   ├── index.ts
│   │   │   ├── messaging.ts    # 메시지 핸들러
│   │   │   ├── oauth.ts        # OAuth 인증
│   │   │   ├── tab-lifecycle.ts
│   │   │   └── tab-restore.ts
│   │   ├── content/
│   │   │   ├── index.ts        # 탭 모니터링
│   │   │   └── bridge.ts       # 웹앱 통신 브릿지
│   │   ├── popup/
│   │   │   ├── pages/
│   │   │   │   ├── CurrentTabs.tsx
│   │   │   │   ├── RecordTabs.tsx
│   │   │   │   ├── ArchiveTabs.tsx
│   │   │   │   └── Setting.tsx
│   │   │   └── hooks/
│   │   └── components/
│   │       ├── ui/             # Radix UI 컴포넌트
│   │       └── Login/
│   ├── utils/
│   │   ├── storage.ts          # WXT 스토리지
│   │   ├── db.ts               # IndexedDB (Dexie)
│   │   ├── Tab.ts              # 탭 관리
│   │   ├── Setting.ts          # 설정 관리
│   │   ├── ArchivedTabGroup.ts # 탭 그룹 아카이빙
│   │   └── api/                # API 클라이언트
│   │       └── client.ts
│   └── types/
│       └── data.d.ts
├── web/                        # QR 코드 공유용 웹 앱
│   └── src/
└── shared/                     # 공유 패키지
    └── src/
        ├── crypto/             # 암호화 유틸
        │   ├── aes.ts          # AES-256-GCM
        │   ├── pin.ts          # PIN 키 파생
        │   └── sensitive-data.ts
        └── logger.ts
```

### 컴포넌트 통신

```
Background Service Worker ↔ Content Script ↔ Popup UI
(webext-bridge를 통한 메시지 전달)

Web App → Content Script Bridge → Background
(window.postMessage + runtime.sendMessage)
```

**내부 메시지 타입 (webext-bridge)**
- `refresh-tab`: 탭 활동 새로고침
- `refresh-interval`: 간격 새로고침
- `send-tab-group`: 탭 그룹 암호화 및 전송
- `restore-storage`: 페이지 상태 복원

**외부 메시지 타입 (Web App → Extension)**
- `ping`: 확장 프로그램 설치 확인
- `restore_tabs`: 탭 복원 요청
- `open_tab`: 새 탭 열기
- `open_settings`: 설정 페이지 열기
- `get_redirect_url`: 내부 웹 URL 조회

### 스토리지

**WXT Storage (Chrome Storage API)**
```typescript
// Session
"session:tabs": Record<tabId, ClientTabInfo>

// Local
"local:settings": Setting
"local:accessToken": string | null
"local:refreshToken": string | null
"local:tabGroupCreatedAt": Record<groupId, number>  // 아카이브 메타데이터
```

**IndexedDB (Dexie)**
```typescript
recordTabs: RecordTabInfo[]  // 닫힌 탭 기록
```

### 핵심 플로우

**탭 모니터링**
1. Background Script: 탭 이벤트 수신 → ClientTabInfo 변환 → 세션 저장
2. Content Script: idleCondition에 따라 비활성 감지 → refresh-tab 메시지 전송
3. Background Script: lastActiveAt 업데이트 → 주기적 체크 → 오래된 탭 닫기 → IndexedDB 저장

**설정 동기화**
1. Google OAuth 로그인 → 토큰 저장
2. GET /stash-setting → 서버 설정과 기본값 병합
3. 설정 변경 시 PUT /stash-setting/update

### API 엔드포인트

**인증**
```
GET  /oauth/google             # OAuth 인증
POST /refresh-tokens           # 토큰 갱신
```

**설정**
```
GET /stash-setting             # 설정 조회
PUT /stash-setting/update      # 설정 업데이트
```

**탭 그룹**
```
POST /tab-group                # 아카이브 생성 (암호화된 데이터)
GET  /tab-group                # 아카이브 목록 조회
GET  /tab-group/:id            # 아카이브 상세 조회
```

## 데이터베이스

### IndexedDB (Client)

**DB**: `alt-tab`

**Table**: `recordTabs`
```typescript
interface RecordTabInfo {
  id: string;              // UUID
  url: string;
  title?: string;
  windowId: number;
  tabIndex?: number;
  lastActiveAt: number;
  faviconUrl?: string;
}
```

**Indexes**: `++id, tabId, url, title, windowId, tabIndex, lastActiveAt, faviconUrl`

**쿼리 예시**
```typescript
// 최근 30일 내 닫힌 탭
db.recordTabs
  .where("lastActiveAt")
  .aboveOrEqual(Date.now() - 30 * 24 * 60 * 60 * 1000)
  .reverse()
  .sortBy("-lastActiveAt")
```

### Chrome Storage

```typescript
"session:tabs": Record<string, ClientTabInfo>
"local:settings": Setting
"local:accessToken": string | null
"local:refreshToken": string | null
```

## 보안

### 구현된 기능

**OAuth 2.0**
- Google OAuth 인증
- Access Token & Refresh Token 자동 갱신
- `chrome.identity.launchWebAuthFlow()` 사용

**암호화 유틸 (@alt-tab/shared/crypto)**

PIN 기반 E2EE (End-to-End Encryption) 구현:

1. **키 파생** (Argon2id)
   - 입력: 사용자 PIN + 16바이트 랜덤 솔트
   - 파라미터: t_cost=3, m_cost=65536, parallelism=1
   - 출력: 32바이트 AES-256 키

2. **데이터 암호화** (AES-256-GCM)
   - 12바이트 랜덤 IV
   - 인증된 암호화 (AEAD)

**제공 모듈:**
- `@alt-tab/shared/crypto/pin` - PIN 키 파생
- `@alt-tab/shared/crypto/aes` - AES-GCM 암호화/복호화
- `@alt-tab/shared/crypto/sensitive-data` - 민감 데이터 처리
- `@alt-tab/shared/crypto/encoding` - Base64/UTF-8 인코딩

### 탭 그룹 아카이빙

- 탭 그룹 E2EE 암호화 후 서버 저장
- PIN 기반 클라이언트 사이드 복호화
- QR 코드를 통한 디바이스 간 공유

상세 내용은 [E2EE-ARCHITECTURE.md](./E2EE-ARCHITECTURE.md) 참고

## 개발 가이드

### 환경 변수

**Extension** (`packages/extension/.env`):
```bash
VITE_OAUTH_BASE_URL=<백엔드 API URL>
VITE_WEB_APP_URL=<웹 앱 URL>
VITE_USE_MOCK_API=false
VITE_MANIFEST_DEV_KEY=<Chrome 개발 키>  # 개발만
```

**Web App** (`packages/web/.env`):
```bash
VITE_API_BASE_URL=<백엔드 API URL>
VITE_CHROME_EXTENSION_ID=<Chrome 확장 ID>
VITE_FIREFOX_EXTENSION_ID=<Firefox 확장 ID>
```

### 권한

```json
{
  "permissions": [
    "tabs", "tabGroups", "storage", "activeTab",
    "cookies", "nativeMessaging", "identity", "scripting"
  ],
  "host_permissions": ["<all_urls>"]
}
```

> Firefox의 경우 `contextualIdentities` 권한 추가

### 빌드 & 실행

```bash
# 설치
pnpm install

# 개발
pnpm dev              # Chrome
pnpm dev:firefox      # Firefox

# 빌드
pnpm build            # Chrome
pnpm build:firefox    # Firefox

# 테스트
pnpm test
```

### 테스트

Vitest 사용, 현재 `isClosableTab` 함수 테스트 구현됨 (20 test cases)

```bash
pnpm test           # 테스트 실행
pnpm test:watch     # watch 모드
```

## 참고

- [WXT Framework](https://wxt.dev/)
- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/)
- [Firefox WebExtensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
