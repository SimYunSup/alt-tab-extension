/**
 * PIN-based key derivation and verification
 * Uses Argon2id for secure key derivation from user PINs
 */

import { argon2id } from 'hash-wasm';
import { SALT_LENGTH_BYTES, ARGON2_CONFIG } from './constants.ts';
import { arrayBufferToBase64, base64ToArrayBuffer, generateRandomBytes } from './encoding.ts';
import { importAesKey } from './aes.ts';

/**
 * Derives a cryptographic key from a PIN using Argon2id
 * @param pin - User's PIN (typically 6 digits)
 * @param salt - 16-byte salt (Uint8Array)
 * @returns 32-byte derived key
 */
export async function deriveKeyFromPinRaw(
  pin: string,
  salt: Uint8Array
): Promise<Uint8Array> {
  if (!pin || pin.length === 0) {
    throw new Error('PIN cannot be empty');
  }
  if (salt.length !== SALT_LENGTH_BYTES) {
    throw new Error(`Salt must be ${SALT_LENGTH_BYTES} bytes`);
  }

  const hash = await argon2id({
    password: pin,
    salt,
    ...ARGON2_CONFIG,
    outputType: 'binary',
  });

  return hash;
}

/**
 * Derives an AES-GCM CryptoKey from a PIN
 * @param pin - User's PIN
 * @param saltBase64 - Base64 encoded salt
 * @returns AES-GCM CryptoKey for encryption/decryption
 */
export async function deriveKeyFromPin(
  pin: string,
  saltBase64: string
): Promise<CryptoKey> {
  const salt = base64ToArrayBuffer(saltBase64);
  const keyBytes = await deriveKeyFromPinRaw(pin, salt);
  return importAesKey(keyBytes, ['decrypt']);
}

/**
 * Generates a new secret and salt from a PIN
 * Used when creating a new encrypted tab group
 * @param pin - User's PIN
 * @returns Base64 encoded secret and salt
 */
export async function generateSecretFromPin(pin: string): Promise<{
  secret: string;
  salt: string;
}> {
  const salt = generateRandomBytes(SALT_LENGTH_BYTES);
  const keyBytes = await deriveKeyFromPinRaw(pin, salt);

  return {
    secret: arrayBufferToBase64(keyBytes),
    salt: arrayBufferToBase64(salt),
  };
}

/**
 * Verifies a PIN against a stored secret and salt
 * @param pin - PIN to verify
 * @param storedSecret - Base64 encoded expected secret
 * @param storedSalt - Base64 encoded salt
 * @returns true if PIN is correct
 */
export async function verifyPin(
  pin: string,
  storedSecret: string,
  storedSalt: string
): Promise<boolean> {
  try {
    const salt = base64ToArrayBuffer(storedSalt);
    const derivedKey = await deriveKeyFromPinRaw(pin, salt);
    const derivedSecret = arrayBufferToBase64(derivedKey);
    return derivedSecret === storedSecret;
  } catch {
    return false;
  }
}

/**
 * Derives the secret string from PIN and salt
 * Used for decryption operations
 * @param pin - User's PIN
 * @param saltBase64 - Base64 encoded salt
 * @returns Base64 encoded secret
 */
export async function deriveSecretFromPin(
  pin: string,
  saltBase64: string
): Promise<string> {
  const salt = base64ToArrayBuffer(saltBase64);
  const keyBytes = await deriveKeyFromPinRaw(pin, salt);
  return arrayBufferToBase64(keyBytes);
}
