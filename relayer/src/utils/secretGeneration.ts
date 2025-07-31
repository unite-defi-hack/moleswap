import crypto from 'crypto';
import { SecretGenerationResult } from '../types/orders';

/**
 * Generate a cryptographically secure random secret
 * @returns 32-byte random secret as hex string
 */
export function generateSecret(): string {
  const secret = crypto.randomBytes(32);
  return `0x${secret.toString('hex')}`;
}

/**
 * Generate hashlock from secret using SHA256
 * @param secret - The secret to hash
 * @returns 32-byte hashlock as hex string
 */
export function generateHashlock(secret: string): string {
  // Create Keccak256 hash (same as ethers.keccak256)
  // Note: Node.js crypto doesn't have a direct Keccak256, so we'll use ethers.js
  const { ethers } = require('ethers');
  
  // Ensure secret has 0x prefix for ethers.js
  const secretWithPrefix = secret.startsWith('0x') ? secret : `0x${secret}`;
  return ethers.keccak256(secretWithPrefix);
}

/**
 * Encrypt secret using AES-256-GCM
 * @param secret - The secret to encrypt
 * @param encryptionKey - The encryption key (32 bytes)
 * @returns Encrypted secret with IV and auth tag
 */
export function encryptSecret(secret: string, encryptionKey: string): string {
  const key = Buffer.from(encryptionKey, 'hex');
  const iv = crypto.randomBytes(12); // 12 bytes for GCM
  // Remove 0x prefix from secret
  const cleanSecret = secret.startsWith('0x') ? secret.slice(2) : secret;
  const secretBuffer = Buffer.from(cleanSecret, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(secretBuffer);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Combine IV + encrypted data + auth tag
  const result = Buffer.concat([iv, encrypted, authTag]);
  return result.toString('base64');
}

/**
 * Decrypt secret using AES-256-GCM
 * @param encryptedSecret - The encrypted secret
 * @param encryptionKey - The encryption key (32 bytes)
 * @returns Decrypted secret
 */
export function decryptSecret(encryptedSecret: string, encryptionKey: string): string {
  const key = Buffer.from(encryptionKey, 'hex');
  const data = Buffer.from(encryptedSecret, 'base64');
  // Extract IV, encrypted data, and auth tag
  const iv = data.slice(0, 12);
  const authTag = data.slice(-16);
  const encrypted = data.slice(12, -16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return `0x${decrypted.toString('hex')}`;
}

/**
 * Generate complete secret generation result
 * @param encryptionKey - Optional encryption key for secret storage
 * @returns Secret generation result with secret, hashlock, and encrypted secret
 */
export function generateSecretWithHashlock(encryptionKey?: string): SecretGenerationResult {
  const secret = generateSecret();
  const hashlock = generateHashlock(secret);
  let encryptedSecret = '';
  if (encryptionKey) {
    encryptedSecret = encryptSecret(secret, encryptionKey);
  }
  return {
    secret,
    hashlock,
    encryptedSecret
  };
}

/**
 * Validate secret format
 * @param secret - The secret to validate
 * @returns Validation result
 */
export function validateSecret(secret: string): { valid: boolean; error?: string } {
  try {
    // Check if it's a valid hex string
    if (!secret.startsWith('0x')) {
      return {
        valid: false,
        error: 'Secret must start with 0x'
      };
    }
    // Check if it's exactly 32 bytes (64 hex characters + 0x prefix)
    if (secret.length !== 66) {
      return {
        valid: false,
        error: 'Secret must be exactly 32 bytes (64 hex characters)'
      };
    }
    // Validate hex format
    const cleanSecret = secret.slice(2);
    if (!/^[0-9a-fA-F]{64}$/.test(cleanSecret)) {
      return {
        valid: false,
        error: 'Secret must be a valid hex string'
      };
    }
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid secret format: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Validate hashlock format
 * @param hashlock - The hashlock to validate
 * @returns Validation result
 */
export function validateHashlock(hashlock: string): { valid: boolean; error?: string } {
  try {
    // Check if it's a valid hex string
    if (!hashlock.startsWith('0x')) {
      return {
        valid: false,
        error: 'Hashlock must start with 0x'
      };
    }
    // Check if it's exactly 32 bytes (64 hex characters + 0x prefix)
    if (hashlock.length !== 66) {
      return {
        valid: false,
        error: 'Hashlock must be exactly 32 bytes (64 hex characters)'
      };
    }
    // Validate hex format
    const cleanHashlock = hashlock.slice(2);
    if (!/^[0-9a-fA-F]{64}$/.test(cleanHashlock)) {
      return {
        valid: false,
        error: 'Hashlock must be a valid hex string'
      };
    }
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid hashlock format: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Verify that a secret matches its hashlock
 * @param secret - The secret to verify
 * @param hashlock - The expected hashlock
 * @returns Verification result
 */
export function verifySecretHashlock(secret: string, hashlock: string): { valid: boolean; error?: string } {
  try {
    // Validate inputs
    const secretValidation = validateSecret(secret);
    if (!secretValidation.valid) {
      return secretValidation;
    }
    const hashlockValidation = validateHashlock(hashlock);
    if (!hashlockValidation.valid) {
      return hashlockValidation;
    }
    // Generate hashlock from secret
    const generatedHashlock = generateHashlock(secret);
    // Compare hashlock
    if (generatedHashlock.toLowerCase() !== hashlock.toLowerCase()) {
      return {
        valid: false,
        error: 'Secret does not match hashlock'
      };
    }
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Generate a secure encryption key
 * @returns 32-byte encryption key as hex string
 */
export function generateEncryptionKey(): string {
  const key = crypto.randomBytes(32);
  return key.toString('hex');
}

/**
 * Get encryption key from environment or generate a new one
 * @returns Encryption key
 */
export function getEncryptionKey(): string {
  const envKey = process.env['SECRET_KEY'];
  if (envKey && envKey.length === 64) {
    return envKey;
  }
  // Generate a new key if not available in environment
  const newKey = generateEncryptionKey();
  console.warn('SECRET_KEY not found in environment, using generated key. Set SECRET_KEY for production.');
  return newKey;
} 