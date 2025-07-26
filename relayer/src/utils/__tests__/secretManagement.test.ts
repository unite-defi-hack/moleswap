import { 
  generateSecret, 
  generateHashlock, 
  encryptSecret, 
  decryptSecret,
  generateSecretWithHashlock,
  validateSecret,
  validateHashlock,
  verifySecretHashlock,
  generateEncryptionKey,
  getEncryptionKey
} from '../secretGeneration';

describe('Secret Management', () => {
  describe('generateSecret', () => {
    it('should generate a 32-byte secret with 0x prefix', () => {
      const secret = generateSecret();
      
      expect(secret).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(secret.length).toBe(66); // 0x + 64 hex chars
    });

    it('should generate unique secrets', () => {
      const secret1 = generateSecret();
      const secret2 = generateSecret();
      
      expect(secret1).not.toBe(secret2);
    });
  });

  describe('generateHashlock', () => {
    it('should generate hashlock from secret', () => {
      const secret = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const hashlock = generateHashlock(secret);
      
      expect(hashlock).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(hashlock.length).toBe(66);
    });

    it('should handle secret with or without 0x prefix', () => {
      const secretWithPrefix = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const secretWithoutPrefix = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      
      const hashlock1 = generateHashlock(secretWithPrefix);
      const hashlock2 = generateHashlock(secretWithoutPrefix);
      
      expect(hashlock1).toBe(hashlock2);
    });
  });

  describe('encryptSecret and decryptSecret', () => {
    it('should encrypt and decrypt secret correctly', () => {
      const secret = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const encryptionKey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      
      const encrypted = encryptSecret(secret, encryptionKey);
      const decrypted = decryptSecret(encrypted, encryptionKey);
      
      expect(decrypted).toBe(secret);
    });

    it('should fail decryption with wrong key', () => {
      const secret = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const correctKey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const wrongKey = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      
      const encrypted = encryptSecret(secret, correctKey);
      
      expect(() => {
        decryptSecret(encrypted, wrongKey);
      }).toThrow();
    });
  });

  describe('generateSecretWithHashlock', () => {
    it('should generate secret, hashlock, and encrypted secret', () => {
      const encryptionKey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = generateSecretWithHashlock(encryptionKey);
      
      expect(result.secret).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(result.hashlock).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(result.encryptedSecret).toBeTruthy();
    });

    it('should generate hashlock that matches the secret', () => {
      const encryptionKey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = generateSecretWithHashlock(encryptionKey);
      
      const generatedHashlock = generateHashlock(result.secret);
      expect(result.hashlock).toBe(generatedHashlock);
    });
  });

  describe('validateSecret', () => {
    it('should validate correct secret format', () => {
      const secret = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = validateSecret(secret);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject secret without 0x prefix', () => {
      const secret = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = validateSecret(secret);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must start with 0x');
    });

    it('should reject secret with wrong length', () => {
      const secret = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcde';
      const result = validateSecret(secret);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exactly 32 bytes');
    });

    it('should reject secret with invalid hex characters', () => {
      const secret = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdeg';
      const result = validateSecret(secret);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('valid hex string');
    });
  });

  describe('validateHashlock', () => {
    it('should validate correct hashlock format', () => {
      const hashlock = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = validateHashlock(hashlock);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject hashlock without 0x prefix', () => {
      const hashlock = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = validateHashlock(hashlock);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must start with 0x');
    });
  });

  describe('verifySecretHashlock', () => {
    it('should verify matching secret and hashlock', () => {
      const secret = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const hashlock = generateHashlock(secret);
      
      const result = verifySecretHashlock(secret, hashlock);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject mismatched secret and hashlock', () => {
      const secret = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const wrongHashlock = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      
      const result = verifySecretHashlock(secret, wrongHashlock);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not match hashlock');
    });

    it('should reject invalid secret format', () => {
      const invalidSecret = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcde';
      const hashlock = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      
      const result = verifySecretHashlock(invalidSecret, hashlock);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exactly 32 bytes');
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate 32-byte encryption key', () => {
      const key = generateEncryptionKey();
      
      expect(key).toMatch(/^[a-fA-F0-9]{64}$/);
      expect(key.length).toBe(64);
    });

    it('should generate unique keys', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('getEncryptionKey', () => {
    it('should return environment key if available', () => {
      const originalEnv = process.env['SECRET_KEY'];
      process.env['SECRET_KEY'] = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      
      const key = getEncryptionKey();
      
      expect(key).toBe(process.env['SECRET_KEY']);
      
      // Restore original environment
      if (originalEnv) {
        process.env['SECRET_KEY'] = originalEnv;
      } else {
        delete process.env['SECRET_KEY'];
      }
    });

    it('should generate new key if environment key is not available', () => {
      const originalEnv = process.env['SECRET_KEY'];
      delete process.env['SECRET_KEY'];
      
      const key = getEncryptionKey();
      
      expect(key).toMatch(/^[a-fA-F0-9]{64}$/);
      expect(key.length).toBe(64);
      
      // Restore original environment
      if (originalEnv) {
        process.env['SECRET_KEY'] = originalEnv;
      }
    });
  });
}); 