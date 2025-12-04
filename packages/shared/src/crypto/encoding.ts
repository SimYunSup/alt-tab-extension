/**
 * Encoding utilities for cryptographic operations
 */

/** Converts ArrayBuffer or Uint8Array to Base64 string */
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Converts Base64 string to Uint8Array */
export function base64ToArrayBuffer(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/** Encodes a UTF-8 string to Uint8Array */
export function textToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/** Decodes a Uint8Array to UTF-8 string */
export function uint8ArrayToText(arr: Uint8Array): string {
  return new TextDecoder().decode(arr);
}

/** Generates cryptographically secure random bytes */
export function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}
