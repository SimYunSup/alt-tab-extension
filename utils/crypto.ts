import type { hash as nodeHash } from "@node-rs/argon2";
// @ts-expect-error becuase @node-rs/argon2/browser.d.ts does not export
import { hash } from "@node-rs/argon2/browser";

const browserHash = hash as typeof nodeHash;

const SALT_LENGTH_BYTES = 16;         // Recommended salt length for Argon2
const IV_LENGTH_BYTES = 12;           // Recommended length for AES-GCM IV
const ARGON2_HASH_LENGTH_BYTES = 32;  // Output length matching diagram (key size for AES-256)

const ARGON2_TYPE = 2;


// --- Helper Functions ---

/** Converts ArrayBuffer or Uint8Array to Base64 string */
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/** Converts Base64 string to Uint8Array */
export function base64ToArrayBuffer(base64: string) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

/** Encodes a UTF-8 string to Uint8Array */
export function textToUint8Array(str: string) {
  return new TextEncoder().encode(str);
}

/** Decodes a Uint8Array to UTF-8 string */
export function uint8ArrayToText(arr: Uint8Array) {
  return new TextDecoder().decode(arr);
}

/** Generates cryptographically secure random bytes */
export function generateRandomBytes(length: number) {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** Imports raw key bytes into a CryptoKey for AES-GCM */
export async function importAesKey(keyBytes: Uint8Array) {
  if (keyBytes.length !== 32) {
    throw new Error("Key material must be 32 bytes for AES-256.");
  }
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false, // not extractable
    ["encrypt", "decrypt"]
  );
}

/** Encrypts data using AES-GCM */
export async function aesGcmEncrypt(dataBytes: Uint8Array, key: CryptoKey) {
  const iv = generateRandomBytes(IV_LENGTH_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    dataBytes
  );
  return { ciphertext: new Uint8Array(ciphertext), iv: iv };
}

/** Decrypts data using AES-GCM */
export async function aesGcmDecrypt(ciphertext: Uint8Array, key: CryptoKey, iv: Uint8Array) {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );
    return new Uint8Array(decrypted);
  } catch (error) {
    console.error("AES-GCM Decryption failed:", error);
    throw new Error("Decryption failed. Invalid key, IV, or ciphertext integrity check failed.");
  }
}

/** Hashes PIN with salt using Argon2 */
export async function hashPinWithArgon(pin: string, salt: Uint8Array) {
  if (!pin || pin.length === 0) {
    throw new Error("PIN cannot be empty.");
  }
  if (salt.length !== SALT_LENGTH_BYTES) {
    throw new Error(`Salt must be ${SALT_LENGTH_BYTES} bytes.`);
  }

  try {
    const hashResult = await browserHash(
      pin,
      {
        salt: salt,
        outputLen: ARGON2_HASH_LENGTH_BYTES,
        algorithm: ARGON2_TYPE,
      }
    );
    return hashResult;
  } catch (error) {
    console.error("Argon2 hashing failed:", error);
    throw new Error("PIN hashing failed.");
  }
}
