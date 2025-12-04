/**
 * Cryptographic constants for E2EE implementation
 *
 * These values follow security best practices:
 * - Argon2id for key derivation (memory-hard, resistant to GPU attacks)
 * - AES-256-GCM for authenticated encryption
 */

/** Salt length for Argon2 key derivation (16 bytes recommended) */
export const SALT_LENGTH_BYTES = 16;

/** IV/Nonce length for AES-GCM (12 bytes is optimal for GCM) */
export const IV_LENGTH_BYTES = 12;

/** Output key length for AES-256 (32 bytes = 256 bits) */
export const KEY_LENGTH_BYTES = 32;

/** Argon2id parameters - balanced for security and performance */
export const ARGON2_CONFIG = {
  /** Number of iterations (time cost) */
  iterations: 3,
  /** Memory usage in KiB (64 MiB) */
  memorySize: 65536,
  /** Degree of parallelism */
  parallelism: 1,
  /** Output hash length in bytes */
  hashLength: KEY_LENGTH_BYTES,
} as const;
