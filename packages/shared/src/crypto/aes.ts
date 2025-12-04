/**
 * AES-256-GCM encryption/decryption utilities
 */

import { KEY_LENGTH_BYTES, IV_LENGTH_BYTES } from './constants.ts';
import { generateRandomBytes } from './encoding.ts';

export interface EncryptionResult {
  ciphertext: Uint8Array;
  iv: Uint8Array;
}

/**
 * Imports raw key bytes into a CryptoKey for AES-GCM
 * @param keyBytes - 32-byte key material for AES-256
 * @param usage - Key usage: 'encrypt', 'decrypt', or both
 */
export async function importAesKey(
  keyBytes: Uint8Array,
  usage: KeyUsage[] = ['encrypt', 'decrypt']
): Promise<CryptoKey> {
  if (keyBytes.length !== KEY_LENGTH_BYTES) {
    throw new Error(`Key material must be ${KEY_LENGTH_BYTES} bytes for AES-256`);
  }

  return crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false, // not extractable
    usage
  );
}

/**
 * Encrypts data using AES-256-GCM
 * @param data - Data to encrypt
 * @param key - AES-GCM CryptoKey
 * @returns Ciphertext and IV (both needed for decryption)
 */
export async function aesGcmEncrypt(
  data: Uint8Array,
  key: CryptoKey
): Promise<EncryptionResult> {
  const iv = generateRandomBytes(IV_LENGTH_BYTES);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    data.buffer as ArrayBuffer
  );

  return {
    ciphertext: new Uint8Array(ciphertext),
    iv,
  };
}

/**
 * Decrypts data using AES-256-GCM
 * @param ciphertext - Encrypted data
 * @param key - AES-GCM CryptoKey
 * @param iv - Initialization vector used during encryption
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export async function aesGcmDecrypt(
  ciphertext: Uint8Array,
  key: CryptoKey,
  iv: Uint8Array
): Promise<Uint8Array> {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext.buffer as ArrayBuffer
    );
    return new Uint8Array(decrypted);
  } catch {
    throw new Error('Decryption failed: invalid key, IV, or data integrity check failed');
  }
}
