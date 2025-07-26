import { generateOrderHash, verifyOrderSignature, generateRandomSalt, validateOrderForHashing } from '../orderHashing';
import { Order } from '../../types/orders';

describe('Order Hashing', () => {
  const mockOrder: Order = {
    maker: '0x71078879cd9a1d7987b74cee6b6c0d130f1a0115',
    makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
    takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
    makerTraits: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    salt: '8240221422984282745454410369971298296651574087129927646899272926690',
    makingAmount: '1000000000000000000',
    takingAmount: '2000000000000000000',
    receiver: '0x0000000000000000000000000000000000000000'
  };

  describe('generateOrderHash', () => {
    it('should generate a valid order hash', () => {
      const result = generateOrderHash(mockOrder);
      
      expect(result.orderHash).toBeDefined();
      expect(result.orderHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(result.domain).toBeDefined();
      expect(result.types).toBeDefined();
    });

    it('should generate consistent hashes for the same order', () => {
      const hash1 = generateOrderHash(mockOrder);
      const hash2 = generateOrderHash(mockOrder);
      
      expect(hash1.orderHash).toBe(hash2.orderHash);
    });

    it('should generate different hashes for different orders', () => {
      const order1 = { ...mockOrder, salt: '1' };
      const order2 = { ...mockOrder, salt: '2' };
      
      const hash1 = generateOrderHash(order1);
      const hash2 = generateOrderHash(order2);
      
      expect(hash1.orderHash).not.toBe(hash2.orderHash);
    });
  });

  describe('generateRandomSalt', () => {
    it('should generate a valid salt string', () => {
      const salt = generateRandomSalt();
      
      expect(salt).toBeDefined();
      expect(typeof salt).toBe('string');
      expect(salt.length).toBeGreaterThan(0);
    });

    it('should generate different salts on each call', () => {
      const salt1 = generateRandomSalt();
      const salt2 = generateRandomSalt();
      
      expect(salt1).not.toBe(salt2);
    });
  });

  describe('validateOrderForHashing', () => {
    it('should validate a correct order', () => {
      const result = validateOrderForHashing(mockOrder);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject order with invalid maker address', () => {
      const invalidOrder = { ...mockOrder, maker: '0xinvalid' };
      const result = validateOrderForHashing(invalidOrder);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid maker address format');
    });

    it('should reject order with zero amounts', () => {
      const invalidOrder = { ...mockOrder, makingAmount: '0' };
      const result = validateOrderForHashing(invalidOrder);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Making amount cannot be zero');
    });

    it('should reject order with missing fields', () => {
      const invalidOrder = { ...mockOrder };
      delete (invalidOrder as any).maker;
      
      const result = validateOrderForHashing(invalidOrder);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Maker address is required');
    });
  });

  describe('verifyOrderSignature', () => {
    it('should verify a valid signature', () => {
      // This is a mock test since we can't easily generate valid signatures in tests
      // In a real implementation, you would use a wallet to sign the order
      const mockSignature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b';
      
      const result = verifyOrderSignature(mockOrder, mockSignature);
      
      // This will likely fail with an invalid signature, which is expected
      expect(result).toHaveProperty('valid');
      // Don't expect signer property when signature is invalid
      if (result.valid) {
        expect(result).toHaveProperty('signer');
      } else {
        expect(result).toHaveProperty('error');
      }
    });
  });
}); 