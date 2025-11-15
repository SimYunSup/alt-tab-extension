# E2EE (End-to-End Encryption) 아키텍처 설계

## 목차
1. [개요](#개요)
2. [보안 요구사항](#보안-요구사항)
3. [암호화 설계](#암호화-설계)
4. [키 관리](#키-관리)
5. [데이터 흐름](#데이터-흐름)
6. [프로토콜 상세](#프로토콜-상세)
7. [보안 고려사항](#보안-고려사항)
8. [구현 가이드](#구현-가이드)
9. [참고 자료](#참고-자료)

---

## 개요

### E2EE가 필요한 이유

Alt-Tab Extension의 **탭 그룹 공유 기능**은 사용자의 민감한 브라우징 정보를 포함합니다:

- **URL**: 방문한 웹사이트 (금융, 의료, 개인 정보 등)
- **탭 제목**: 문서 이름, 이메일 제목 등
- **쿠키 & 로컬 스토리지**: 세션 토큰, 인증 정보
- **스크롤 위치 & 폼 데이터**: 사용자 활동 컨텍스트

이러한 데이터가 서버에 평문으로 저장되면:
- ❌ 서버 해킹 시 모든 사용자 데이터 유출
- ❌ 내부자 공격 (악의적인 관리자)
- ❌ 법적 요청 시 데이터 제공 강제
- ❌ 클라우드 프로바이더의 접근 가능성

**E2EE (End-to-End Encryption)**를 구현하면:
- ✅ 서버는 암호화된 데이터만 보유 (복호화 불가능)
- ✅ Zero-knowledge 아키텍처 달성
- ✅ 사용자만이 자신의 데이터를 복호화
- ✅ 법적 요청에도 데이터 제공 불가 (서버가 키를 모름)

### 설계 목표

1. **Zero-Knowledge**: 서버는 사용자 데이터를 복호화할 수 없음
2. **PIN 기반 보안**: 사용자가 기억하기 쉬운 6자리 PIN 사용
3. **다중 디바이스 지원**: QR 코드로 키 공유 가능
4. **Forward Secrecy**: 과거 키 유출이 미래 데이터에 영향 없음
5. **Quantum-resistant**: 가능한 경우 양자 내성 알고리즘 사용

---

## 보안 요구사항

### 위협 모델

#### 보호 대상
1. **공격자가 서버를 장악한 경우**: 암호화된 데이터만 획득, 복호화 불가
2. **중간자 공격 (MITM)**: HTTPS로 전송 중 보호
3. **무차별 대입 공격 (Brute Force)**: Argon2 해싱으로 PIN 크래킹 지연
4. **레인보우 테이블 공격**: 솔트로 방어
5. **재생 공격 (Replay Attack)**: Nonce/타임스탬프로 방어

#### 보호하지 않는 것
- 클라이언트 측 악성코드 (키로거, 스크린샷 등)
- 사용자가 PIN을 잊어버린 경우 (복구 불가능 - 트레이드오프)
- 물리적 디바이스 접근 (브라우저 프로파일 보호에 의존)

### 규정 준수
- **GDPR**: 개인정보보호, Right to be Forgotten
- **CCPA**: 캘리포니아 소비자 프라이버시법
- **HIPAA**: 의료 정보 보호 (선택적)

---

## 암호화 설계

### 암호화 알고리즘 선택

#### 1. Argon2id - PIN 해싱
- **알고리즘**: Argon2id (Argon2i + Argon2d의 하이브리드)
- **버전**: Argon2 v1.3
- **용도**: 사용자 PIN → 암호화 키 파생
- **특징**:
  - 2015 Password Hashing Competition 우승
  - GPU/ASIC 크래킹 저항성
  - 타이밍 공격 방어 (Argon2i)
  - 크래킹 저항성 (Argon2d)

**파라미터:**
```typescript
{
  timeCost: 3,          // 반복 횟수
  memoryCost: 65536,    // 64MB 메모리 사용
  parallelism: 4,       // 병렬 스레드 수
  hashLength: 32,       // 256-bit 출력 (AES-256용)
  saltLength: 16        // 128-bit 솔트
}
```

**크래킹 비용 예측:**
- 6자리 숫자 PIN (000000~999999): 1,000,000 조합
- Argon2 해싱: ~100ms/해시 (일반 CPU)
- 총 크래킹 시간: ~27.7시간 (단일 CPU)
- GPU/ASIC 사용 시: 메모리 하드 특성으로 효율 감소

**권장사항:** 더 강력한 보안을 위해 8자리 이상 영숫자 PIN 권장

#### 2. AES-256-GCM - 데이터 암호화
- **알고리즘**: AES (Advanced Encryption Standard)
- **모드**: GCM (Galois/Counter Mode)
- **키 크기**: 256-bit
- **특징**:
  - NIST 승인 알고리즘
  - 인증 암호화 (AEAD - Authenticated Encryption with Associated Data)
  - 무결성 검증 내장 (태그 생성)
  - 병렬 처리 가능

**파라미터:**
```typescript
{
  name: "AES-GCM",
  length: 256,          // 256-bit 키
  iv: 12 bytes,         // 96-bit IV (GCM 권장)
  tagLength: 128        // 128-bit 인증 태그
}
```

**보안 강도:**
- 2^256 키 공간 (양자 컴퓨터로도 2^128 보안 강도)
- 현존하는 가장 안전한 대칭키 암호

#### 3. Web Crypto API
- **구현**: 브라우저 네이티브 암호화 API
- **장점**:
  - 하드웨어 가속 지원
  - Non-extractable 키 (메모리에서 추출 불가)
  - 보안 컨텍스트 (HTTPS 필수)

### 암호화 계층 구조

```
사용자 PIN (6자리)
    ↓
[Argon2id + Salt]
    ↓
Master Key (256-bit)
    ↓
[AES-GCM 암호화]
    ↓
암호화된 탭 데이터
    ↓
[서버 저장]
```

---

## 키 관리

### 키 계층 구조

```
User PIN
    ├─> Master Key (Argon2id 파생)
    │       ├─> Data Encryption Key (DEK)
    │       │       └─> 탭 그룹 데이터 암호화
    │       └─> Key Encryption Key (KEK)
    │               └─> DEK 암호화 (다중 디바이스용)
    └─> PIN Verification Hash
            └─> 서버 저장 (PIN 검증용, 선택적)
```

### 키 생성 프로세스

#### 1단계: 사용자 PIN 입력
```typescript
// 사용자가 6자리 PIN 입력
const userPin = "123456";  // 예시
```

#### 2단계: 솔트 생성
```typescript
// 암호학적으로 안전한 랜덤 솔트
const salt = crypto.getRandomValues(new Uint8Array(16));
// Base64 인코딩하여 저장
const saltBase64 = arrayBufferToBase64(salt);
```

#### 3단계: Master Key 파생
```typescript
import { hash } from "@node-rs/argon2";

const masterKey = await hash(userPin, {
  salt: salt,
  memoryCost: 65536,  // 64MB
  timeCost: 3,
  parallelism: 4,
  outputLen: 32       // 256-bit
});
```

#### 4단계: AES 키 임포트
```typescript
const aesKey = await crypto.subtle.importKey(
  "raw",
  masterKey,
  { name: "AES-GCM", length: 256 },
  false,  // non-extractable
  ["encrypt", "decrypt"]
);
```

### 키 저장 전략

| 키 타입 | 저장 위치 | 형식 | 보안 |
|--------|----------|------|------|
| User PIN | 사용자 기억 | 6자리 숫자 | 입력 시에만 메모리 |
| Salt | 서버 & 로컬 | Base64 | 공개 가능 |
| Master Key | 메모리 (임시) | Binary | 즉시 삭제 |
| AES Key | Web Crypto (non-extractable) | CryptoKey | 추출 불가 |
| 암호화된 데이터 | 서버 & IndexedDB | Base64 | 안전 |

### 다중 디바이스 키 공유

#### QR 코드를 통한 키 공유

**시나리오**: 사용자가 디바이스 A에서 생성한 탭 그룹을 디바이스 B에서 열고 싶음

**프로토콜:**

1. **디바이스 A (공유자)**
   ```typescript
   // QR 코드 페이로드 생성
   const sharePayload = {
     pin: userPin,           // 6자리 PIN
     salt: saltBase64,       // 솔트
     groupId: "abc123"       // 서버 탭 그룹 ID
   };

   // JSON → Base64
   const qrData = btoa(JSON.stringify(sharePayload));

   // QR 코드 생성
   generateQRCode(qrData);
   ```

2. **디바이스 B (수신자)**
   ```typescript
   // QR 코드 스캔
   const qrData = scanQRCode();

   // Base64 → JSON
   const payload = JSON.parse(atob(qrData));

   // 동일한 PIN + Salt로 Master Key 재생성
   const masterKey = await hashPinWithArgon(payload.pin, payload.salt);

   // 서버에서 암호화된 데이터 다운로드
   const encryptedData = await fetchTabGroup(payload.groupId);

   // 복호화
   const decryptedData = await aesGcmDecrypt(
     masterKey,
     encryptedData.iv,
     encryptedData.ciphertext
   );
   ```

**보안 고려:**
- QR 코드는 일회성 사용 권장
- QR 코드 표시 후 일정 시간 후 자동 삭제
- QR 코드 스캔 시 HTTPS 사용 강제
- 물리적으로 안전한 환경에서만 스캔

---

## 데이터 흐름

### 1. 탭 그룹 생성 & 암호화

```
┌─────────────────────────────────────────────────────────────┐
│ Client (Browser Extension)                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 사용자 탭 선택                                           │
│     tabs = [tab1, tab2, tab3, ...]                         │
│                                                             │
│  2. PIN 입력                                                │
│     pin = "123456"                                         │
│                                                             │
│  3. 솔트 생성                                               │
│     salt = randomBytes(16)                                 │
│                                                             │
│  4. Master Key 파생                                        │
│     masterKey = Argon2id(pin, salt)                        │
│                                                             │
│  5. 탭 데이터 직렬화                                        │
│     plaintext = JSON.stringify(tabs)                       │
│                                                             │
│  6. IV 생성                                                │
│     iv = randomBytes(12)                                   │
│                                                             │
│  7. AES-GCM 암호화                                         │
│     {ciphertext, authTag} = AES-GCM-256.encrypt(           │
│       key: masterKey,                                      │
│       iv: iv,                                              │
│       plaintext: plaintext                                 │
│     )                                                      │
│                                                             │
│  8. 서버 전송                                               │
│     POST /tab-group                                        │
│     body: {                                                │
│       salt: base64(salt),                                  │
│       iv: base64(iv),                                      │
│       ciphertext: base64(ciphertext),                      │
│       authTag: base64(authTag)                             │
│     }                                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Server (Ktor Backend)                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  9. 데이터 수신 & 검증                                       │
│     - JWT 토큰 검증                                         │
│     - 필수 필드 확인 (salt, iv, ciphertext)                 │
│                                                             │
│  10. MongoDB 저장                                           │
│      {                                                     │
│        _id: ObjectId(),                                    │
│        userId: extractedFromJWT,                           │
│        salt: "...",                                        │
│        iv: "...",                                          │
│        ciphertext: "...",                                  │
│        authTag: "...",                                     │
│        createdAt: new Date()                               │
│      }                                                     │
│                                                             │
│  11. 응답                                                   │
│      { groupId: "abc123", success: true }                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘

※ 서버는 암호화된 데이터만 저장, 복호화 불가능
```

### 2. 탭 그룹 복호화 & 복원

```
┌─────────────────────────────────────────────────────────────┐
│ Client (Browser Extension)                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 사용자 아카이브 선택                                      │
│     groupId = "abc123"                                     │
│                                                             │
│  2. 서버에서 암호화된 데이터 조회                             │
│     GET /tab-group/:groupId                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Server (Ktor Backend)                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  3. JWT 검증 & 권한 확인                                     │
│     - 사용자가 해당 그룹의 소유자인지 확인                    │
│                                                             │
│  4. MongoDB 조회 & 응답                                     │
│     {                                                      │
│       salt: "...",                                         │
│       iv: "...",                                           │
│       ciphertext: "...",                                   │
│       authTag: "..."                                       │
│     }                                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Client (Browser Extension)                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  5. PIN 입력 요청                                           │
│     pin = prompt("6자리 PIN을 입력하세요")                   │
│                                                             │
│  6. Master Key 재생성                                       │
│     masterKey = Argon2id(pin, base64Decode(salt))          │
│                                                             │
│  7. AES-GCM 복호화                                         │
│     plaintext = AES-GCM-256.decrypt(                       │
│       key: masterKey,                                      │
│       iv: base64Decode(iv),                                │
│       ciphertext: base64Decode(ciphertext),                │
│       authTag: base64Decode(authTag)                       │
│     )                                                      │
│                                                             │
│  8. 복호화 실패 처리                                         │
│     if (decryption failed):                                │
│       alert("잘못된 PIN입니다")                             │
│       return                                               │
│                                                             │
│  9. 데이터 역직렬화                                          │
│     tabs = JSON.parse(plaintext)                           │
│                                                             │
│  10. 탭 복원                                                │
│      tabs.forEach(tab => {                                 │
│        chrome.tabs.create({                                │
│          url: tab.url,                                     │
│          pinned: tab.pinned                                │
│        })                                                  │
│      })                                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. QR 코드 공유 플로우

```
┌──────────────────┐                    ┌──────────────────┐
│  Device A        │                    │  Device B        │
│  (공유자)         │                    │  (수신자)         │
└──────────────────┘                    └──────────────────┘
         │                                       │
         │ 1. "공유" 버튼 클릭                    │
         │                                       │
         │ 2. QR 코드 생성                        │
         │    payload = {pin, salt, groupId}     │
         │    qrData = base64(JSON(payload))     │
         │                                       │
         │ 3. QR 코드 표시                        │
         │    ┌───────────────┐                  │
         │    │  ████  ██  ██ │                  │
         │    │  ██  ████  ██ │                  │
         │    │  ██  ██  ████ │                  │
         │    └───────────────┘                  │
         │                                       │
         │ <────────────────────────────────────> │
         │           물리적 QR 스캔                │
         │                                       │
         │                                       │ 4. QR 코드 스캔
         │                                       │    카메라 사용
         │                                       │
         │                                       │ 5. 페이로드 파싱
         │                                       │    {pin, salt, groupId}
         │                                       │
         │                                       │ 6. 서버에서 데이터 조회
         │                                       │    GET /tab-group/:groupId
         │                                       │
         │                                       │ 7. 복호화 & 복원
         │                                       │    masterKey = Argon2(pin, salt)
         │                                       │    plaintext = AES.decrypt(...)
         │                                       │    tabs.forEach(restore)
         │                                       │
         ▼                                       ▼
```

---

## 프로토콜 상세

### API 스키마 변경 제안

#### 현재 (평문 저장)
```typescript
POST /tab-group
Request: {
  secret: "SECRETTABGROUP",  // ❌ 하드코딩된 평문
  salt: "SALT",              // ❌ 하드코딩된 평문
  browserTabInfos: [...]     // ❌ 평문 탭 데이터
}
```

#### 제안 (E2EE)
```typescript
POST /tab-group
Request: {
  salt: string,           // Base64 encoded (16 bytes)
  iv: string,             // Base64 encoded (12 bytes)
  ciphertext: string,     // Base64 encoded AES-GCM ciphertext
  authTag: string,        // Base64 encoded (16 bytes)
  metadata?: {            // 선택적 메타데이터 (암호화되지 않음)
    tabCount: number,
    createdAt: string,
    deviceInfo: string
  }
}

Response: {
  groupId: string,
  success: boolean
}
```

#### 복호화 API
```typescript
GET /tab-group/:groupId
Response: {
  groupId: string,
  salt: string,
  iv: string,
  ciphertext: string,
  authTag: string,
  metadata?: {...},
  createdAt: string
}
```

#### PIN 검증 (선택적)
```typescript
// 옵션 1: 클라이언트 사이드 검증만 (권장)
// - PIN이 틀리면 복호화 실패로 알 수 있음
// - 서버는 PIN 관여 안 함

// 옵션 2: 서버 사이드 PIN 힌트 (선택적)
POST /tab-group
Request: {
  ...,
  pinHash?: string  // Argon2(PIN + groupId) - 선택적
}

// PIN 검증 시
POST /tab-group/:groupId/verify-pin
Request: {
  pinHash: string
}
Response: {
  valid: boolean
}
```

### MongoDB 스키마 제안

```javascript
// collections/tabGroups.js
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  userId: ObjectId("507f191e810c19729de860ea"),

  // 암호화 파라미터
  salt: "iR5z9X2mP8kL3nQ7",          // Base64, 16 bytes
  iv: "gH4j6K1vN9sR",                // Base64, 12 bytes

  // 암호화된 데이터
  ciphertext: "8j3kL9mP2qW5...",     // Base64, AES-GCM ciphertext
  authTag: "xY7zK3mN8pL2qW5R",       // Base64, 16 bytes

  // 메타데이터 (암호화되지 않음)
  metadata: {
    tabCount: 15,
    deviceInfo: "Chrome/120.0 (Windows)",
    encryptionVersion: "1.0"         // 향후 암호화 알고리즘 변경 대비
  },

  // 선택적: PIN 검증 해시
  pinHash: "...",  // Argon2(PIN + groupId)

  // 타임스탬프
  createdAt: ISODate("2025-11-15T10:30:00Z"),
  updatedAt: ISODate("2025-11-15T10:30:00Z"),
  expiresAt: ISODate("2026-11-15T10:30:00Z"),  // 자동 삭제 (선택적)

  // 인덱스
  // db.tabGroups.createIndex({ userId: 1, createdAt: -1 })
  // db.tabGroups.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })  // TTL
}
```

---

## 보안 고려사항

### 1. PIN 보안

#### 문제: 6자리 숫자는 무차별 대입 공격에 취약

**해결책:**
- ✅ Argon2 해싱으로 크래킹 속도 지연 (~100ms/해시)
- ✅ 클라이언트 사이드 시도 제한 (5회 실패 시 1분 대기)
- ✅ 서버 사이드 Rate Limiting (동일 IP에서 분당 10회 제한)
- ✅ 더 강력한 PIN 권장 (8자리 영숫자)

#### 고급 보안 옵션

**Biometric + PIN:**
```typescript
// WebAuthn API 사용
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: new Uint8Array(32),
    rp: { name: "Alt-Tab Extension" },
    user: {
      id: new Uint8Array(16),
      name: userEmail,
      displayName: userName
    },
    pubKeyCredParams: [{ alg: -7, type: "public-key" }],
    authenticatorSelection: {
      userVerification: "required"  // 생체 인증 필수
    }
  }
});

// 생체 인증 성공 시에만 PIN 입력 허용
```

### 2. IV (Initialization Vector) 재사용 방지

**문제**: 동일한 키 + IV로 두 번 암호화하면 보안 취약

**해결책:**
```typescript
// 항상 새로운 IV 생성
const iv = crypto.getRandomValues(new Uint8Array(12));

// IV는 공개 가능, 각 암호화마다 고유해야 함
```

### 3. 타이밍 공격 방어

**문제**: PIN 비교 시간으로 정보 유출

**해결책:**
```typescript
// ❌ 취약한 비교
if (inputPin === correctPin) { ... }

// ✅ 상수 시간 비교
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
```

### 4. 메모리 보안

**문제**: 민감한 데이터가 메모리에 남아있을 수 있음

**해결책:**
```typescript
// 민감한 데이터 즉시 삭제
function secureClear(data: Uint8Array | string) {
  if (data instanceof Uint8Array) {
    crypto.getRandomValues(data);  // 랜덤 데이터로 덮어쓰기
  } else {
    data = "";  // 문자열 참조 제거
  }
}

// 사용 예시
const pin = getPin();
const masterKey = await hashPin(pin);
secureClear(pin);  // PIN 즉시 삭제

// 암호화 후 키 삭제
const encrypted = await encrypt(masterKey, data);
secureClear(masterKey);
```

### 5. HTTPS 강제

**문제**: HTTP에서는 중간자 공격 가능

**해결책:**
```typescript
// manifest.json에서 HTTPS 강제
{
  "content_security_policy": {
    "extension_pages": "default-src 'self'; connect-src https://api.example.com"
  }
}

// API 클라이언트에서 확인
if (!apiUrl.startsWith('https://')) {
  throw new Error('HTTPS required for security');
}
```

### 6. 세션 타임아웃

**문제**: 복호화된 데이터가 오래 메모리에 남아있음

**해결책:**
```typescript
// 10분 후 자동 잠금
const SESSION_TIMEOUT = 10 * 60 * 1000;  // 10분

let lastActivityTime = Date.now();

// 사용자 활동 감지
document.addEventListener('mousedown', () => {
  lastActivityTime = Date.now();
});

// 주기적 체크
setInterval(() => {
  if (Date.now() - lastActivityTime > SESSION_TIMEOUT) {
    lockSession();  // 메모리에서 키 삭제, 재로그인 필요
  }
}, 60000);  // 1분마다 체크
```

---

## 구현 가이드

### Phase 1: 기본 E2EE 구현

#### 1. 암호화 유틸리티 완성 (이미 구현됨)

파일: `utils/crypto.ts`

현재 상태:
- ✅ `generateRandomBytes()`
- ✅ `hashPinWithArgon()`
- ✅ `importAesKey()`
- ✅ `aesGcmEncrypt()`
- ✅ `aesGcmDecrypt()`

#### 2. 탭 그룹 암호화 통합

파일: `utils/ArchivedTabGroup.ts`

**Before (현재):**
```typescript
export async function archiveTabGroup(
  tabs: TabInfo[],
  secret?: string,
  salt?: string
): Promise<void> {
  const { accessToken } = await browser.storage.local.get("accessToken");

  await api.post<ServerArchivedTabGroup>(
    "/tab-group",
    {
      secret: secret ?? "SECRETTABGROUP",  // ❌ 하드코딩
      salt: salt ?? "SALT",                // ❌ 하드코딩
      browserTabInfos: tabs.map(convertTabInfoServer),
    },
    // ...
  );
}
```

**After (E2EE):**
```typescript
import {
  generateRandomBytes,
  hashPinWithArgon,
  aesGcmEncrypt,
  arrayBufferToBase64,
  textToUint8Array
} from "./crypto";

export async function archiveTabGroup(
  tabs: TabInfo[],
  pin: string  // ✅ 사용자 PIN
): Promise<string> {  // groupId 반환
  // 1. 솔트 생성
  const salt = generateRandomBytes(16);
  const saltBase64 = arrayBufferToBase64(salt);

  // 2. Master Key 파생
  const masterKeyBuffer = await hashPinWithArgon(
    pin,
    new Uint8Array(salt)
  );

  // 3. 탭 데이터 직렬화
  const plaintext = JSON.stringify(
    tabs.map(convertTabInfoServer)
  );
  const plaintextBytes = textToUint8Array(plaintext);

  // 4. 암호화
  const { iv, ciphertext, authTag } = await aesGcmEncrypt(
    masterKeyBuffer,
    plaintextBytes
  );

  // 5. 서버 전송
  const { accessToken } = await browser.storage.local.get("accessToken");

  const response = await api.post<{ groupId: string }>(
    "/tab-group",
    {
      salt: arrayBufferToBase64(salt),
      iv: arrayBufferToBase64(iv),
      ciphertext: arrayBufferToBase64(ciphertext),
      authTag: arrayBufferToBase64(authTag),
      metadata: {
        tabCount: tabs.length,
        deviceInfo: navigator.userAgent,
        encryptionVersion: "1.0"
      }
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return response.data.groupId;
}
```

#### 3. 탭 그룹 복호화 구현

```typescript
import {
  hashPinWithArgon,
  aesGcmDecrypt,
  base64ToArrayBuffer,
  uint8ArrayToText
} from "./crypto";

export async function decryptTabGroup(
  groupId: string,
  pin: string
): Promise<TabInfo[]> {
  // 1. 서버에서 암호화된 데이터 조회
  const { accessToken } = await browser.storage.local.get("accessToken");

  const response = await api.get<{
    salt: string;
    iv: string;
    ciphertext: string;
    authTag: string;
  }>(`/tab-group/${groupId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const { salt, iv, ciphertext, authTag } = response.data;

  // 2. Master Key 재생성
  const saltBuffer = base64ToArrayBuffer(salt);
  const masterKeyBuffer = await hashPinWithArgon(
    pin,
    new Uint8Array(saltBuffer)
  );

  // 3. 복호화
  try {
    const plaintextBytes = await aesGcmDecrypt(
      masterKeyBuffer,
      base64ToArrayBuffer(iv),
      base64ToArrayBuffer(ciphertext)
    );

    const plaintext = uint8ArrayToText(new Uint8Array(plaintextBytes));
    const tabs: ServerTabInfo[] = JSON.parse(plaintext);

    return tabs.map(convertServerTabInfoToClient);
  } catch (error) {
    throw new Error("복호화 실패: 잘못된 PIN이거나 데이터가 손상되었습니다.");
  }
}
```

#### 4. UI 통합

파일: `entrypoints/popup/pages/ArchiveTabs.tsx`

**PIN 입력 다이얼로그:**
```typescript
const [pin, setPin] = useState("");
const [isLocked, setIsLocked] = useState(true);

const handleUnlock = async () => {
  try {
    const tabs = await decryptTabGroup(selectedGroupId, pin);
    setDecryptedTabs(tabs);
    setIsLocked(false);
    setPin("");  // 즉시 삭제
  } catch (error) {
    alert("잘못된 PIN입니다. 다시 시도해주세요.");
  }
};

// PIN 입력 UI
<Dialog open={isLocked}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>PIN을 입력하세요</DialogTitle>
    </DialogHeader>
    <Input
      type="password"
      inputMode="numeric"
      maxLength={6}
      value={pin}
      onChange={(e) => setPin(e.target.value)}
      placeholder="6자리 PIN"
    />
    <DialogFooter>
      <Button onClick={handleUnlock}>잠금 해제</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Phase 2: QR 코드 공유

#### 1. QR 코드 생성

```bash
npm install qrcode
npm install -D @types/qrcode
```

```typescript
import QRCode from 'qrcode';

export async function generateShareQRCode(
  groupId: string,
  pin: string,
  salt: string
): Promise<string> {
  const payload = {
    v: 1,           // 버전
    g: groupId,     // 그룹 ID
    p: pin,         // PIN
    s: salt         // 솔트
  };

  const qrData = btoa(JSON.stringify(payload));

  // QR 코드 이미지 생성 (Data URL)
  const qrImageUrl = await QRCode.toDataURL(qrData, {
    errorCorrectionLevel: 'H',  // 높은 오류 정정
    width: 300,
    margin: 2
  });

  return qrImageUrl;
}
```

#### 2. QR 코드 스캔

```bash
npm install html5-qrcode
```

```typescript
import { Html5QrcodeScanner } from 'html5-qrcode';

export function scanQRCode(
  elementId: string,
  onSuccess: (decodedText: string) => void
) {
  const scanner = new Html5QrcodeScanner(
    elementId,
    { fps: 10, qrbox: 250 },
    false
  );

  scanner.render(
    (decodedText) => {
      try {
        const payload = JSON.parse(atob(decodedText));

        if (payload.v !== 1) {
          throw new Error('지원하지 않는 QR 코드 버전');
        }

        onSuccess(payload);
        scanner.clear();
      } catch (error) {
        alert('유효하지 않은 QR 코드입니다.');
      }
    },
    (errorMessage) => {
      console.warn('QR 스캔 오류:', errorMessage);
    }
  );
}
```

### Phase 3: 보안 강화

#### 1. Rate Limiting (클라이언트)

```typescript
class PinAttemptLimiter {
  private attempts = 0;
  private lockUntil = 0;

  async checkAttempt(): Promise<void> {
    const now = Date.now();

    if (this.lockUntil > now) {
      const waitSeconds = Math.ceil((this.lockUntil - now) / 1000);
      throw new Error(`너무 많은 시도. ${waitSeconds}초 후 다시 시도하세요.`);
    }

    this.attempts++;

    if (this.attempts >= 5) {
      this.lockUntil = now + 60 * 1000;  // 1분 잠금
      this.attempts = 0;
      throw new Error('5회 실패. 1분 후 다시 시도하세요.');
    }
  }

  reset() {
    this.attempts = 0;
  }
}

const limiter = new PinAttemptLimiter();

// 사용
try {
  await limiter.checkAttempt();
  const tabs = await decryptTabGroup(groupId, pin);
  limiter.reset();  // 성공 시 리셋
} catch (error) {
  // ...
}
```

#### 2. 서버 Rate Limiting (Ktor)

```kotlin
// build.gradle.kts
dependencies {
    implementation("io.ktor:ktor-server-rate-limit:$ktor_version")
}

// Application.kt
install(RateLimit) {
    register(RateLimitName("tab-group-api")) {
        rateLimiter(limit = 10, refillPeriod = 60.seconds)
        requestKey { call ->
            call.request.headers["X-Forwarded-For"]
                ?: call.request.origin.remoteHost
        }
    }
}

// Route
routing {
    rateLimit(RateLimitName("tab-group-api")) {
        get("/tab-group/{id}") {
            // ...
        }
    }
}
```

---

## 참고 자료

### 암호화 표준
- [NIST SP 800-38D](https://csrc.nist.gov/publications/detail/sp/800-38d/final) - AES-GCM 권장사항
- [RFC 9106](https://www.rfc-editor.org/rfc/rfc9106) - Argon2 메모리 하드 함수
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)

### Web Crypto API
- [MDN Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Crypto.subtle.encrypt()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt)
- [Crypto.subtle.decrypt()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/decrypt)

### 보안 Best Practices
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Signal Protocol](https://signal.org/docs/) - E2EE 참고 구현
- [Google Tink](https://github.com/google/tink) - 암호화 라이브러리

### 관련 라이브러리
- [@node-rs/argon2](https://github.com/napi-rs/node-rs/tree/main/packages/argon2)
- [qrcode](https://github.com/soldair/node-qrcode)
- [html5-qrcode](https://github.com/mebjas/html5-qrcode)

---

**작성일**: 2025-11-15
**문서 버전**: 1.0.0
**보안 리뷰**: 필요 (전문가 검토 권장)
