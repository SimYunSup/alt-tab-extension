import { argon2id } from "hash-wasm";

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
    const saltBuffer = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));

    // Derive key from PIN using same parameters as extension
    const derivedKeyHash = await argon2id({
      password: pin,
      salt: saltBuffer,
      parallelism: 1,
      iterations: 3,
      memorySize: 65536, // 64MB
      hashLength: 32,
      outputType: "encoded",
    });

    // Compare with stored secret
    return derivedKeyHash === storedSecret;
  } catch (error) {
    console.error("PIN verification error:", error);
    return false;
  }
}
