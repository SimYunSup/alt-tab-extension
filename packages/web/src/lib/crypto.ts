/**
 * Crypto utilities - re-exported from @alt-tab/shared
 *
 * This file provides a stable import path for the web app while
 * the actual implementation lives in the shared package.
 */

export {
  deriveKeyFromPin,
  verifyPin as verifyPinCode,
} from '@alt-tab/shared/crypto/pin';

export {
  decryptWithKey as decryptSensitiveData,
} from '@alt-tab/shared/crypto/sensitive-data';
