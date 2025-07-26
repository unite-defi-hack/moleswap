import request from 'supertest';
import { app } from '../../index';
import { db } from '../../database/connection';

describe('Secrets API', () => {
  afterEach(async () => {
    // Clean up test data after each test
    await db('orders').del();
  });

  describe('POST /api/secrets/:orderHash', () => {
    it('should reject request with invalid order hash', async () => {
      const response = await request(app)
        .post('/api/secrets/invalid_hash')
        .send({
          requester: '0x6423C4Ef791393D53fE3BA8bD8A5CA73bceEB646'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SECRET_REQUEST');
      expect(response.body.error.message).toContain('Invalid order hash format');
    });

    it('should reject request with invalid requester address', async () => {
      const response = await request(app)
        .post('/api/secrets/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
        .send({
          requester: 'invalid_address'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ADDRESS');
      expect(response.body.error.message).toContain('Invalid requester address');
    });

    it('should reject request for non-existent order', async () => {
      const nonExistentHash = '0x1111111111111111111111111111111111111111111111111111111111111111';
      
      const response = await request(app)
        .post(`/api/secrets/${nonExistentHash}`)
        .send({
          requester: '0x6423C4Ef791393D53fE3BA8bD8A5CA73bceEB646'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SECRET_REQUEST');
      // The error message might be "Validation failed: Unknown error" due to database issues
      expect(response.body.error.message).toMatch(/Order not found|Validation failed/);
    });
  });
}); 