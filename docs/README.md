# Alt-Tab Extension

비활성 탭을 자동으로 감지하고 저장하는 브라우저 확장 프로그램

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

### 탭 그룹 아카이빙 (개발 중)
- 여러 탭을 그룹으로 서버에 저장
- PIN 코드 보호
- E2EE 종단간 암호화

## 기술 스택

### Frontend

**Core**
- WXT 0.20.7 - 브라우저 확장 프레임워크
- React 19.1.0
- TypeScript 5.8.3
- Tailwind CSS 4.1.10

**UI**
- Radix UI - 접근성 UI 컴포넌트
- Lucide React - 아이콘

**Data**
- Dexie 4.0.11 - IndexedDB wrapper
- SWR 2.3.3 - 데이터 페칭 & 캐싱
- webext-bridge 6.0.1 - 메시지 전달

**Security**
- @node-rs/argon2 2.0.2 - 패스워드 해싱
- Web Crypto API - AES-GCM 암호화

**Supported Browsers**: Chrome, Edge, Firefox

### Backend

- Kotlin 100%
- Ktor - 비동기 웹 프레임워크
- MongoDB - NoSQL DB
- JWT Bearer Authentication, OAuth
- Swagger UI

## 아키텍처

### 디렉토리 구조

```
entrypoints/
├── background/index.ts        # 서비스 워커
├── content/index.ts           # 탭 모니터링
└── popup/
    ├── pages/
    │   ├── CurrentTabs.tsx    # 현재 탭
    │   ├── RecordTabs.tsx     # 닫힌 탭 기록
    │   ├── ArchiveTabs.tsx    # 아카이브된 탭 그룹
    │   └── Setting.tsx        # 설정
    └── hooks/

types/
├── data.d.ts
├── server.d.ts
└── client.d.ts

utils/
├── crypto.ts                  # 암호화
├── db.ts                      # IndexedDB
├── Tab.ts                     # 탭 관리
├── Setting.ts                 # 설정 관리
└── api.ts                     # API 클라이언트
```

### 컴포넌트 통신

```
Background Service Worker ↔ Content Script ↔ Popup UI
(webext-bridge를 통한 메시지 전달)
```

**메시지 타입**
- `refresh-tab`: 탭 활동 새로고침
- `refresh-interval`: 간격 새로고침
- `get-tab-info`: 탭 정보 조회
- `send-tab-group`: 탭 그룹 전송

### 스토리지

**WXT Storage (Chrome Storage API)**
```typescript
// Session
"session:tabs": Record<tabId, ClientTabInfo>

// Local
"local:settings": Setting
"local:accessToken": string | null
"local:refreshToken": string | null
```

**IndexedDB (Dexie)**
```typescript
recordTabs: RecordTabInfo[]
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

**탭 그룹** (개발 중)
```
POST /tab-group                # 아카이브 생성
GET  /tab-group                # 아카이브 조회
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

**암호화 유틸 (utils/crypto.ts)**
- Argon2id 패스워드 해싱 (16 bytes salt, 32 bytes output)
- AES-256-GCM 암호화 (12 bytes IV, Non-extractable key)
- 제공 함수: `generateRandomBytes`, `hashPinWithArgon`, `importAesKey`, `aesGcmEncrypt`, `aesGcmDecrypt`

### 개발 중

- 탭 그룹 아카이빙 E2EE 통합
- PIN 검증 (현재 클라이언트만)
- QR 코드 공유
- 다중 디바이스 키 동기화

상세 내용은 [E2EE-ARCHITECTURE.md](./E2EE-ARCHITECTURE.md) 참고

## 개발 가이드

### 환경 변수

`.env` 파일:
```bash
VITE_OAUTH_BASE_URL=<백엔드 API URL>
VITE_MANIFEST_DEV_KEY=<Chrome 개발 키>  # 개발만
```

### 권한

```json
{
  "permissions": [
    "tabs", "tabGroups", "storage", "activeTab",
    "cookies", "nativeMessaging", "identity",
    "contextualIdentities"  // Firefox
  ],
  "host_permissions": ["<all_urls>"]
}
```

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
