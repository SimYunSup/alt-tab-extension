# Alt-Tab Extension - 전체 문서

## 목차
1. [개요](#개요)
2. [주요 기능](#주요-기능)
3. [기술 스택](#기술-스택)
4. [프론트엔드 아키텍처](#프론트엔드-아키텍처)
5. [백엔드 아키텍처](#백엔드-아키텍처)
6. [데이터베이스 스키마](#데이터베이스-스키마)
7. [인증 및 보안](#인증-및-보안)
8. [개발 상태](#개발-상태)

---

## 개요

**Alt-Tab Extension**은 브라우저의 비활성 탭을 지능적으로 관리하는 확장 프로그램입니다. 사용자가 설정한 시간 동안 사용하지 않은 탭을 자동으로 감지하고 저장하여 작업 공간을 깔끔하게 유지합니다.

### 목적
- **메모리 최적화**: 비활성 탭을 닫아 브라우저 메모리 사용량 감소
- **생산성 향상**: 중요한 탭에 집중할 수 있도록 워크스페이스 정리
- **탭 복구**: 닫힌 탭의 정보를 보존하여 필요시 쉽게 복원
- **크로스 디바이스 동기화**: 여러 기기에서 설정 및 탭 그룹 공유

### 저장소
- **프론트엔드**: [SimYunSup/alt-tab-extension](https://github.com/SimYunSup/alt-tab-extension)
- **백엔드**: [knight7024/alt-tab](https://github.com/knight7024/alt-tab)

---

## 주요 기능

### 1. 자동 탭 아카이빙
- 설정된 시간 동안 비활성 상태인 탭을 자동으로 감지
- 탭 정보를 로컬 IndexedDB에 저장 후 닫기
- 닫힌 탭은 언제든지 복원 가능

### 2. 동적 설정 조정
- 브라우저 활동에 따라 탭 관리 동작 자동 조정
- URL별 커스텀 규칙 설정 가능
- 비활성 시간 임계값: 1-240분

### 3. 비활성 탭 감지 모드
| 모드 | 설명 | 지원 브라우저 |
|------|------|---------------|
| `window` | 다른 윈도우/탭으로 전환 시 비활성 | 전체 |
| `visibility` | 탭이 화면에서 숨겨질 때 비활성 | 전체 |
| `idle` | 사용자 상호작용이 없을 때 비활성 | Chrome/Edge only |

### 4. 탭 보호 옵션
- ✅ 언로드된 탭 무시
- ✅ 오디오 재생 중인 탭 무시
- ✅ 고정된 탭 허용 (자동 닫기 제외)
- ✅ 컨테이너/그룹 탭 무시

### 5. 탭 그룹 아카이빙 (개발 중)
- 여러 탭을 그룹으로 묶어 서버에 저장
- PIN 코드로 보호된 아카이브
- QR 코드를 통한 공유 기능 (예정)
- E2EE(종단간 암호화)를 통한 보안 강화 (예정)

### 6. 디바이스 동기화
- Google OAuth를 통한 인증
- 설정을 서버에 저장하여 여러 디바이스에서 동기화
- 액세스 토큰 자동 갱신

---

## 기술 스택

### 프론트엔드 (Browser Extension)

#### 핵심 프레임워크
| 기술 | 버전 | 용도 |
|------|------|------|
| **WXT** | 0.20.7 | 브라우저 확장 프로그램 프레임워크 |
| **React** | 19.1.0 | UI 라이브러리 |
| **TypeScript** | 5.8.3 | 타입 안전성 |
| **Tailwind CSS** | 4.1.10 | 스타일링 |
| **Vite** | - | 빌드 도구 (WXT 내장) |

#### 주요 라이브러리
**UI 컴포넌트:**
- Radix UI (Dialog, Select, Slider, Switch, Tabs 등)
- Lucide React (아이콘)
- class-variance-authority, clsx, tailwind-merge (스타일 유틸)

**데이터 & 스토리지:**
- Dexie 4.0.11 (IndexedDB wrapper)
- dexie-react-hooks (React 통합)
- SWR 2.3.3 (데이터 페칭 & 캐싱)

**보안 & 암호화:**
- @node-rs/argon2 2.0.2 (Argon2 패스워드 해싱)
- Web Crypto API (AES-GCM 암호화)

**브라우저 확장:**
- webext-bridge 6.0.1 (크로스 컨텍스트 메시징)
- @types/chrome (TypeScript 정의)

**날짜/시간:**
- @internationalized/date (날짜 유틸리티)

#### 지원 브라우저
- ✅ Chrome
- ✅ Edge
- ✅ Firefox (contextualIdentities 권한 포함)

### 백엔드 (API Server)

#### 핵심 기술
| 기술 | 설명 |
|------|------|
| **Kotlin** | 100% Kotlin 기반 |
| **Ktor** | 비동기 웹 프레임워크 |
| **MongoDB** | NoSQL 데이터베이스 |
| **Gradle** | 빌드 도구 (Kotlin DSL) |

#### 주요 기능
- **인증**: JWT Bearer Authentication, OAuth
- **직렬화**: kotlinx.serialization (JSON)
- **API 문서**: Swagger UI
- **CORS**: 크로스 오리진 요청 지원
- **컨테이너화**: Docker 지원

---

## 프론트엔드 아키텍처

### 디렉토리 구조
```
entrypoints/
├── background/
│   ├── index.ts              # 서비스 워커 (메인 로직)
│   ├── utils/
│   │   ├── tabManager.ts     # 탭 관리 로직
│   │   ├── oauth.ts          # OAuth 인증
│   │   └── setting.ts        # 설정 관리
│   └── watcher/              # 스토리지 감시자
├── content/
│   ├── index.ts              # 콘텐츠 스크립트 (탭 모니터링)
│   └── utils/
│       ├── idleDetector.ts   # Idle 감지
│       └── visibilityDetector.ts # Visibility 감지
├── popup/
│   ├── App.tsx               # 메인 UI
│   ├── pages/
│   │   ├── CurrentTabs.tsx   # 현재 열린 탭
│   │   ├── RecordTabs.tsx    # 닫힌 탭 기록
│   │   ├── ArchiveTabs.tsx   # 아카이브된 탭 그룹
│   │   └── Setting.tsx       # 설정 페이지
│   └── hooks/                # React 커스텀 훅
└── components/               # 공유 UI 컴포넌트
    ├── ui/                   # Radix UI 래퍼
    └── ...

types/
├── data.d.ts                 # 데이터 타입 정의
├── server.d.ts               # 서버 API 타입
└── client.d.ts               # 클라이언트 타입

utils/
├── crypto.ts                 # 암호화 유틸리티
├── db.ts                     # IndexedDB (Dexie)
├── api.ts                    # API 클라이언트
└── ...
```

### 컴포넌트 통신

#### 메시지 전달 (webext-bridge)
```
Background Service Worker
    ↕ (webext-bridge)
Content Script
    ↕ (webext-bridge)
Popup UI
```

**메시지 타입:**
- `refresh-tab`: 탭 활동 새로고침
- `refresh-interval`: 간격 새로고침 요청
- `get-tab-info`: 탭 정보 조회
- `send-tab-group`: 탭 그룹 전송

#### 스토리지 계층
```
WXT Storage API
    ├── Session Storage
    │   └── "session:tabs": Record<tabId, ClientTabInfo>
    └── Local Storage
        ├── "local:settings": Setting
        ├── "local:accessToken": string | null
        └── "local:refreshToken": string | null

IndexedDB (Dexie)
    └── recordTabs: RecordTabInfo[]
```

### 핵심 워크플로우

#### 1. 탭 모니터링 플로우
```
1. Background Script
   └─> 탭 이벤트 수신 (created, updated, removed)
   └─> ClientTabInfo 변환 & 세션 스토리지 저장

2. Content Script
   └─> idleCondition에 따라 비활성 상태 모니터링
   └─> 활동 감지 시 refresh-tab 메시지 전송

3. Background Script
   └─> lastActiveAt 타임스탬프 업데이트
   └─> 주기적 체크 (1초 간격)
   └─> 오래된 탭 닫기
   └─> IndexedDB에 저장 (saveTabIndexedDB)
```

#### 2. 설정 동기화 플로우
```
1. Google OAuth 로그인
2. 토큰 추출 & 저장
3. initSettingIfLogin()
   └─> GET /stash-setting
4. 서버 설정과 기본값 병합 (defu)
5. 설정 변경 시
   └─> PUT /stash-setting/update
```

#### 3. 탭 그룹 아카이빙 플로우 (개발 중)
```
1. 사용자가 탭 선택
2. archiveTabGroup(tabs, secret, salt)
3. POST /tab-group
   └─> 서버에 저장: { secret, salt, browserTabInfos }
4. PIN 코드로 보호된 아카이브 생성
```

---

## 백엔드 아키텍처

### API 엔드포인트

#### OAuth & 인증
```
GET  /oauth/google
     → Google OAuth 인증 시작

POST /refresh-tokens
     → 액세스 토큰 갱신
     Request: { refreshToken: string }
     Response: { accessToken: string }
```

#### 설정 관리
```
GET  /stash-setting
     → 사용자 설정 조회
     Headers: Authorization: Bearer <token>
     Response: Setting

PUT  /stash-setting/update
     → 사용자 설정 업데이트
     Headers: Authorization: Bearer <token>
     Body: Setting
```

#### 탭 그룹 아카이빙
```
POST /tab-group
     → 탭 그룹 아카이브 생성
     Body: {
       secret: string,
       salt: string,
       browserTabInfos: TabInfo[]
     }

GET  /tab-group
     → 아카이브된 탭 그룹 조회
     Query: ?secret=xxx&salt=xxx
```

### 인증 체계

**OAuth 2.0 Flow:**
1. 클라이언트가 `/oauth/google` 호출
2. Google OAuth 동의 화면 리디렉션
3. 콜백 URL에서 `access_token`, `refresh_token` 추출
4. 토큰을 로컬 스토리지에 저장
5. 이후 API 호출 시 `Authorization: Bearer <token>` 헤더 사용

**JWT 인증:**
- Bearer Token 방식
- 서버는 JWT를 검증하여 사용자 식별
- 토큰 만료 시 `/refresh-tokens`로 갱신

### 데이터베이스 (MongoDB)

**Collections (추정):**
- `users`: 사용자 정보 및 OAuth 토큰
- `settings`: 사용자별 설정
- `tab_groups`: 아카이브된 탭 그룹

**탭 그룹 스키마 (예상):**
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  secret: String,        // 암호화된 비밀키
  salt: String,          // 암호화 솔트
  browserTabInfos: [     // 탭 정보 배열
    {
      url: String,
      title: String,
      faviconUrl: String,
      scrollPosition: Number,
      localStorage: Object,
      sessionStorage: Object,
      cookies: Array,
      deviceInfo: Object,
      incognito: Boolean,
      lastActiveAt: Number
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

---

## 데이터베이스 스키마

### IndexedDB (클라이언트)

**데이터베이스 이름**: `alt-tab`

**테이블**: `recordTabs` (v1)

```typescript
interface RecordTabInfo {
  id: string;              // UUID (Primary Key, Auto-increment)
  url: string;             // Indexed
  title?: string;          // Indexed
  windowId: number;        // Indexed
  tabIndex?: number;       // Indexed
  lastActiveAt: number;    // Indexed (시간 기반 쿼리용)
  faviconUrl?: string;     // Indexed
}
```

**인덱스:** `++id, tabId, url, title, windowId, tabIndex, lastActiveAt, faviconUrl`

**쿼리 예시:**
```typescript
// 최근 30일 내 닫힌 탭 조회
db.recordTabs
  .where("lastActiveAt")
  .aboveOrEqual(Date.now() - 30 * 24 * 60 * 60 * 1000)
  .reverse()
  .sortBy("-lastActiveAt")
```

### WXT Storage (Chrome Storage API)

**Session Storage:**
```typescript
"session:tabs": Record<string, ClientTabInfo>
```

**Local Storage:**
```typescript
"local:settings": Setting
"local:accessToken": string | null
"local:refreshToken": string | null
```

---

## 인증 및 보안

### 현재 구현된 보안 기능

#### 1. OAuth 2.0 인증
- Google OAuth를 통한 사용자 인증
- `chrome.identity.launchWebAuthFlow()` 사용
- Access Token & Refresh Token 관리
- 브라우저 시작 시 자동 토큰 갱신

#### 2. 암호화 유틸리티 (구현 완료, 통합 대기)

**Argon2 패스워드 해싱:**
```typescript
// utils/crypto.ts
- 알고리즘: Argon2id (type 2)
- 솔트: 16 bytes (암호학적으로 안전한 랜덤)
- 출력: 32 bytes (AES-256 키 파생용)
```

**AES-GCM 암호화:**
```typescript
- 키 크기: 256-bit (32 bytes)
- IV 길이: 12 bytes (GCM 권장)
- Non-extractable CryptoKey 객체
- 인증 암호화 (GCM은 무결성 검증 제공)
```

**제공 함수:**
- `generateRandomBytes()`: 안전한 랜덤 바이트 생성
- `hashPinWithArgon()`: Argon2로 PIN 해싱
- `importAesKey()`: AES 키 임포트
- `aesGcmEncrypt()`: AES-GCM 암호화
- `aesGcmDecrypt()`: AES-GCM 복호화
- `arrayBufferToBase64()` / `base64ToArrayBuffer()`: 인코딩 유틸

### 보안 현황

✅ **구현 완료:**
- OAuth 토큰 관리
- Argon2 패스워드 해싱 유틸리티
- AES-GCM 암호화/복호화 유틸리티

🚧 **개발 중:**
- 탭 그룹 아카이빙에 E2EE 통합
- PIN 검증 (현재 클라이언트 사이드만)
- QR 코드 공유 기능

❌ **미구현:**
- 토큰 클라이언트 사이드 암호화 (브라우저 스토리지 보안에 의존)
- 서버 사이드 암호화 검증
- 키 교환 프로토콜 (다중 디바이스 공유)

---

## 개발 상태

### 완료된 기능 ✅

1. **핵심 탭 관리**
   - 자동 탭 감지 및 닫기
   - 3가지 비활성 감지 모드 (window, visibility, idle)
   - URL별 커스텀 규칙
   - 탭 보호 옵션

2. **로컬 탭 아카이빙**
   - IndexedDB에 닫힌 탭 저장
   - 탭 복원 기능
   - 최근 30일 기록 관리

3. **설정 관리**
   - 전역 규칙 설정
   - URL 화이트리스트
   - 클라우드 동기화 (OAuth)

4. **UI/UX**
   - 현재 탭 뷰
   - 닫힌 탭 뷰
   - 설정 페이지
   - 검색 기능

### 개발 중 🚧

1. **탭 그룹 아카이빙**
   - 서버에 탭 그룹 저장 (API 연결 필요)
   - PIN 보호 (UI만 구현, 실제 검증 미구현)
   - 암호화 통합 (유틸리티만 준비됨)

2. **E2EE (종단간 암호화)**
   - 암호화 키 관리
   - 서버 저장 전 클라이언트 사이드 암호화
   - PIN 기반 암호화/복호화

3. **공유 기능**
   - QR 코드 생성 (UI 플레이스홀더만 존재)
   - 다른 디바이스로 탭 그룹 공유

### 계획된 기능 📋

1. **보안 강화**
   - Zero-knowledge 아키텍처
   - 다중 디바이스 키 동기화
   - 2FA (Two-Factor Authentication)

2. **고급 기능**
   - 탭 그룹 편집
   - 태그 및 카테고리
   - 고급 검색 필터

3. **성능 최적화**
   - 대량 탭 처리 최적화
   - 메모리 사용량 모니터링

---

## 개발 환경 설정

### 환경 변수 (.env)
```bash
VITE_OAUTH_BASE_URL=<백엔드 API URL>
VITE_MANIFEST_DEV_KEY=<Chrome 개발 키>  # 개발 환경만
```

### 권한 (manifest.json)
```json
{
  "permissions": [
    "tabs",
    "tabGroups",
    "storage",
    "activeTab",
    "cookies",
    "nativeMessaging",
    "identity",
    "contextualIdentities"  // Firefox only
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

### 빌드 & 실행
```bash
# 의존성 설치
npm install

# 개발 모드 (Chrome)
npm run dev

# 개발 모드 (Firefox)
npm run dev:firefox

# 프로덕션 빌드
npm run build

# 프로덕션 빌드 (Firefox)
npm run build:firefox
```

---

## 참고 문서

- [WXT 프레임워크](https://wxt.dev/)
- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/)
- [Firefox WebExtensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [Ktor 프레임워크](https://ktor.io/)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

---

**작성일**: 2025-11-15
**문서 버전**: 1.0.0
