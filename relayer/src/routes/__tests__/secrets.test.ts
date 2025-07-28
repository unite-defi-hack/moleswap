import request from 'supertest';
import { createApp } from '../../index';
import { db } from '../../database/connection';

describe('Secrets API', () => {
  let app: any;

  beforeAll(async () => {
    // Initialize the app
    const { app: createdApp } = createApp();
    app = createdApp;
  });

  afterEach(async () => {
    // Clean up test data after each test
    await db('orders').del();
  });

  describe('POST /api/secrets/:orderHash', () => {
    it('should reject request with invalid order hash', async () => {
      const response = await request(app)
        .post('/api/secrets/invalid_hash')
        .send({
          srcEscrowAddress: '0x1234567890123456789012345678901234567890',
          dstEscrowAddress: '0x0987654321098765432109876543210987654321',
          srcChainId: '1',
          dstChainId: '137'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SECRET_REQUEST');
      expect(response.body.error.message).toContain('Invalid order hash format');
    });

    it('should reject request with invalid escrow address', async () => {
      const response = await request(app)
        .post('/api/secrets/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
        .send({
          srcEscrowAddress: 'invalid_address',
          dstEscrowAddress: '0x0987654321098765432109876543210987654321',
          srcChainId: '1',
          dstChainId: '137'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SECRET_REQUEST');
      expect(response.body.error.message).toContain('Invalid request data');
    });

    it('should reject request for non-existent order', async () => {
      const nonExistentHash = '0x1111111111111111111111111111111111111111111111111111111111111111';
      
      const response = await request(app)
        .post(`/api/secrets/${nonExistentHash}`)
        .send({
          srcEscrowAddress: '0x1234567890123456789012345678901234567890',
          dstEscrowAddress: '0x0987654321098765432109876543210987654321',
          srcChainId: '1',
          dstChainId: '137'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SECRET_REQUEST');
      expect(response.body.error.message).toContain('Order not found');
    });
  });
}); 