import { argon2id } from "hash-wasm";

const SALT_LENGTH_BYTES = 16;         // Recommended salt length for Argon2
const IV_LENGTH_BYTES = 12;           // Recommended length for AES-GCM IV
const ARGON2_HASH_LENGTH_BYTES = 32;  // Output length matching diagram (key size for AES-256)



// --- Helper Functions ---

/** Converts ArrayBuffer or Uint8Array to Base64 string */
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Converts Base64 string to Uint8Array */
export function base64ToArrayBuffer(base64: string) {
  const binary_string = atob(base64);
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
    keyBytes.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false, // not extractable
    ["encrypt", "decrypt"]
  );
}

/** Encrypts data using AES-GCM */
export async function aesGcmEncrypt(dataBytes: Uint8Array, key: CryptoKey) {
  const iv = generateRandomBytes(IV_LENGTH_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    dataBytes.buffer as ArrayBuffer
  );
  return { ciphertext: new Uint8Array(ciphertext), iv: iv };
}

/** Decrypts data using AES-GCM */
export async function aesGcmDecrypt(ciphertext: Uint8Array, key: CryptoKey, iv: Uint8Array) {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext.buffer as ArrayBuffer
    );
    return new Uint8Array(decrypted);
  } catch (error) {
    console.error("AES-GCM Decryption failed:", error);
    throw new Error("Decryption failed. Invalid key, IV, or ciphertext integrity check failed.");
  }
}

/** Hashes PIN with salt using Argon2 */
export async function hashPinWithArgon(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  if (!pin || pin.length === 0) {
    throw new Error("PIN cannot be empty.");
  }
  if (salt.length !== SALT_LENGTH_BYTES) {
    throw new Error(`Salt must be ${SALT_LENGTH_BYTES} bytes.`);
  }

  try {
    console.log("[Crypto] Starting Argon2id hashing...");
    const hashResult = await argon2id({
      password: pin,
      salt: salt,
      parallelism: 1,
      iterations: 3,
      memorySize: 65536, // 64 MiB
      hashLength: ARGON2_HASH_LENGTH_BYTES,
      outputType: "binary",
    });
    console.log("[Crypto] Argon2id hashing complete");

    return hashResult;
  } catch (error) {
    console.error("Argon2 hashing failed:", error);
    throw new Error("PIN hashing failed.");
  }
}

/**
 * Generates secret and salt from PIN code for E2EE
 * Used for tab group encryption
 */
export async function generateSecretAndSaltFromPin(pinCode: string) {
  const salt = generateRandomBytes(SALT_LENGTH_BYTES);
  const secret = await hashPinWithArgon(pinCode, salt);

  return {
    secret: arrayBufferToBase64(secret),
    salt: arrayBufferToBase64(salt),
  };
}

/**
 * Verifies if a PIN code matches the stored secret and salt
 */
export async function verifyPinCode(pinCode: string, storedSecret: string, storedSalt: string) {
  try {
    const saltBytes = base64ToArrayBuffer(storedSalt);
    const computedSecret = await hashPinWithArgon(pinCode, saltBytes);
    const computedSecretB64 = arrayBufferToBase64(computedSecret);
    return computedSecretB64 === storedSecret;
  } catch (error) {
    console.error("PIN verification failed:", error);
    return false;
  }
}

/**
 * Decrypts sensitive data that was encrypted with encryptSensitiveData
 * @param encryptedData - Encrypted data in format "iv:ciphertext" (both base64 encoded)
 * @param secretBase64 - Base64 encoded secret key (32 bytes for AES-256)
 * @returns Decrypted plain text data
 */
export async function decryptSensitiveData(encryptedData: string, secretBase64: string): Promise<string> {
  try {
    // Parse iv:ciphertext format
    const [ivBase64, ciphertextBase64] = encryptedData.split(':');
    if (!ivBase64 || !ciphertextBase64) {
      throw new Error("Invalid encrypted data format. Expected 'iv:ciphertext'");
    }

    const iv = base64ToArrayBuffer(ivBase64);
    const ciphertext = base64ToArrayBuffer(ciphertextBase64);
    const secretBytes = base64ToArrayBuffer(secretBase64);
    const key = await importAesKey(secretBytes);

    const decryptedBytes = await aesGcmDecrypt(ciphertext, key, iv);
    return uint8ArrayToText(decryptedBytes);
  } catch (error) {
    console.error("[E2EE] Failed to decrypt sensitive data:", error);
    throw new Error("Decryption failed. Invalid PIN or corrupted data.");
  }
}

/**
 * Derives the encryption secret from PIN and salt
 * This is used when restoring tabs to decrypt sensitive data
 * @param pinCode - User's 6-digit PIN
 * @param saltBase64 - Base64 encoded salt (stored with tab group)
 * @returns Base64 encoded secret for decryption
 */
export async function deriveSecretFromPin(pinCode: string, saltBase64: string): Promise<string> {
  const saltBytes = base64ToArrayBuffer(saltBase64);
  const secret = await hashPinWithArgon(pinCode, saltBytes);
  return arrayBufferToBase64(secret);
}
