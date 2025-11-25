import { argon2id } from "hash-wasm";

/** Converts ArrayBuffer or Uint8Array to Base64 string */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/** Converts Base64 string to Uint8Array */
function base64ToArrayBuffer(base64: string) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
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
    // Decode base64 salt
    const saltBuffer = base64ToArrayBuffer(salt);

    // Derive key from PIN using same parameters as extension
    const derivedKeyHash = await argon2id({
      password: pin,
      salt: saltBuffer,
      parallelism: 1,
      iterations: 3,
      memorySize: 65536, // 64MB
      hashLength: 32,
      outputType: "binary",
    });

    // Convert to base64 and compare with stored secret
    const computedSecretB64 = arrayBufferToBase64(derivedKeyHash);
    return computedSecretB64 === storedSecret;
  } catch (error) {
    console.error("PIN verification error:", error);
    return false;
  }
}
