import { argon2id } from "hash-wasm";

/** Converts ArrayBuffer or Uint8Array to Base64 string */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Converts Base64 string to Uint8Array */
function base64ToArrayBuffer(base64: string) {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

/** Decodes a Uint8Array to UTF-8 string */
function uint8ArrayToText(arr: Uint8Array) {
  return new TextDecoder().decode(arr);
}

/** Imports raw key bytes into a CryptoKey for AES-GCM */
async function importAesKey(keyBytes: Uint8Array) {
  if (keyBytes.length !== 32) {
    throw new Error("Key material must be 32 bytes for AES-256.");
  }
  return crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false, // not extractable
    ["decrypt"]
  );
}

/** Decrypts data using AES-GCM */
async function aesGcmDecrypt(ciphertext: Uint8Array, key: CryptoKey, iv: Uint8Array) {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer
  );
  return new Uint8Array(decrypted);
}

/**
 * Derives the encryption key from PIN and salt
 * @param pin - User's 6-digit PIN
 * @param salt - Base64 encoded salt
 * @returns AES-GCM CryptoKey for decryption
 */
export async function deriveKeyFromPin(pin: string, salt: string): Promise<CryptoKey> {
  const saltBuffer = base64ToArrayBuffer(salt);

  const derivedKeyHash = await argon2id({
    password: pin,
    salt: saltBuffer,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536, // 64MB
    hashLength: 32,
    outputType: "binary",
  });

  return importAesKey(derivedKeyHash);
}

/**
 * Decrypts sensitive data that was encrypted with AES-GCM
 * @param encryptedData - Encrypted data in format "iv:ciphertext" (both base64 encoded)
 * @param key - AES-GCM CryptoKey for decryption
 * @returns Decrypted plain text data
 */
export async function decryptSensitiveData(encryptedData: string, key: CryptoKey): Promise<string> {
  try {
    // Parse iv:ciphertext format
    const [ivBase64, ciphertextBase64] = encryptedData.split(':');
    if (!ivBase64 || !ciphertextBase64) {
      console.warn("[Web Crypto] Invalid encrypted data format, returning as-is");
      return encryptedData;
    }

    const iv = base64ToArrayBuffer(ivBase64);
    const ciphertext = base64ToArrayBuffer(ciphertextBase64);

    const decryptedBytes = await aesGcmDecrypt(ciphertext, key, iv);
    return uint8ArrayToText(decryptedBytes);
  } catch (error) {
    console.error("[Web Crypto] Failed to decrypt sensitive data:", error);
    throw new Error("Decryption failed. Invalid PIN or corrupted data.");
  }
}

/**
 * Verifies a PIN code against stored secret and salt
 * @param pin - 6-digit PIN code
 * @param storedSecret - Base64 encoded secret from server
 * @param salt - Base64 encoded salt from server
 * @returns true if PIN is correct
 */
export async function verifyPinCode(
  pin: string,
  storedSecret: string,
  salt: string
): Promise<boolean> {
  try {
    console.log("[Web Crypto] Starting PIN verification...");

    // Decode base64 salt
    const saltBuffer = base64ToArrayBuffer(salt);
    console.log("[Web Crypto] Salt decoded, length:", saltBuffer.length);

    // Derive key from PIN using same parameters as extension
    console.log("[Web Crypto] Starting Argon2id hashing...");
    const derivedKeyHash = await argon2id({
      password: pin,
      salt: saltBuffer,
      parallelism: 1,
      iterations: 3,
      memorySize: 65536, // 64MB
      hashLength: 32,
      outputType: "binary",
    });
    console.log("[Web Crypto] Argon2id hashing complete");

    // Convert to base64 and compare with stored secret
    const computedSecretB64 = arrayBufferToBase64(derivedKeyHash);
    const isMatch = computedSecretB64 === storedSecret;
    console.log("[Web Crypto] PIN verification result:", isMatch);

    return isMatch;
  } catch (error) {
    console.error("[Web Crypto] PIN verification error:", error);
    return false;
  }
}
