/**
 * High-level encryption/decryption for sensitive data
 * Uses the "iv:ciphertext" format for serialization
 */

import { arrayBufferToBase64, base64ToArrayBuffer, textToUint8Array, uint8ArrayToText } from './encoding.ts';
import { aesGcmEncrypt, aesGcmDecrypt, importAesKey } from './aes.ts';

/**
 * Encrypts sensitive data with AES-256-GCM
 * @param plaintext - Data to encrypt
 * @param secretBase64 - Base64 encoded 32-byte secret key
 * @returns Encrypted data in "iv:ciphertext" format (both Base64)
 */
export async function encryptSensitiveData(
  plaintext: string,
  secretBase64: string
): Promise<string> {
  const secretBytes = base64ToArrayBuffer(secretBase64);
  const key = await importAesKey(secretBytes, ['encrypt']);
  const dataBytes = textToUint8Array(plaintext);

  const { ciphertext, iv } = await aesGcmEncrypt(dataBytes, key);

  return `${arrayBufferToBase64(iv)}:${arrayBufferToBase64(ciphertext)}`;
}

/**
 * Decrypts sensitive data encrypted with encryptSensitiveData
 * @param encryptedData - Encrypted data in "iv:ciphertext" format
 * @param secretBase64 - Base64 encoded 32-byte secret key
 * @returns Decrypted plaintext
 * @throws Error if decryption fails
 */
export async function decryptSensitiveData(
  encryptedData: string,
  secretBase64: string
): Promise<string> {
  const parts = encryptedData.split(':');
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted data format. Expected 'iv:ciphertext'");
  }

  const [ivBase64, ciphertextBase64] = parts;
  const iv = base64ToArrayBuffer(ivBase64);
  const ciphertext = base64ToArrayBuffer(ciphertextBase64);
  const secretBytes = base64ToArrayBuffer(secretBase64);

  const key = await importAesKey(secretBytes, ['decrypt']);
  const decryptedBytes = await aesGcmDecrypt(ciphertext, key, iv);

  return uint8ArrayToText(decryptedBytes);
}

/**
 * Decrypts sensitive data using a CryptoKey directly
 * @param encryptedData - Encrypted data in "iv:ciphertext" format
 * @param key - AES-GCM CryptoKey
 * @returns Decrypted plaintext
 */
export async function decryptWithKey(
  encryptedData: string,
  key: CryptoKey
): Promise<string> {
  const parts = encryptedData.split(':');
  if (parts.length !== 2) {
    // Return as-is if not in expected format (might be unencrypted)
    return encryptedData;
  }

  const [ivBase64, ciphertextBase64] = parts;
  const iv = base64ToArrayBuffer(ivBase64);
  const ciphertext = base64ToArrayBuffer(ciphertextBase64);

  const decryptedBytes = await aesGcmDecrypt(ciphertext, key, iv);
  return uint8ArrayToText(decryptedBytes);
}
