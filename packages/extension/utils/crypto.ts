/**
 * Crypto utilities - re-exported from @alt-tab/shared
 *
 * This file provides a stable import path for the extension while
 * the actual implementation lives in the shared package.
 */

// Re-export everything from the shared crypto modules
export {
  // Constants
  SALT_LENGTH_BYTES,
  IV_LENGTH_BYTES,
  KEY_LENGTH_BYTES,
  ARGON2_CONFIG,
} from '@alt-tab/shared/crypto/constants';

export {
  // Encoding utilities
  arrayBufferToBase64,
  base64ToArrayBuffer,
  textToUint8Array,
  uint8ArrayToText,
  generateRandomBytes,
} from '@alt-tab/shared/crypto/encoding';

export {
  // AES encryption
  importAesKey,
  aesGcmEncrypt,
  aesGcmDecrypt,
  type EncryptionResult,
} from '@alt-tab/shared/crypto/aes';

export {
  // PIN-based operations
  deriveKeyFromPinRaw as hashPinWithArgon,
  deriveKeyFromPin,
  generateSecretFromPin as generateSecretAndSaltFromPin,
  verifyPin as verifyPinCode,
  deriveSecretFromPin,
} from '@alt-tab/shared/crypto/pin';

export {
  // Sensitive data operations
  encryptSensitiveData,
  decryptSensitiveData,
  decryptWithKey,
} from '@alt-tab/shared/crypto/sensitive-data';
