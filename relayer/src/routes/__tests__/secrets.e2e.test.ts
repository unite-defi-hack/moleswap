process.env['USE_DUMMY_PLUGIN'] = 'true';
process.env['SECRET_KEY'] = '1234567890123456789012345678901234567890123456789012345678901234';
import request from 'supertest';
import { createApp } from '../../index';
import { loadPluginConfig } from '../../plugins/config';
import { db } from '../../database/connection';
import { 
  insertOrder
} from '../../database/orderService';
import { 
  generateSecretWithHashlock, 
  getEncryptionKey 
} from '../../utils/secretGeneration';
import { OrderStatus } from '../../types/orders';

let app: any;

beforeAll(async () => {
  const { app: createdApp, pluginRegistry } = createApp();
  app = createdApp;
  const pluginConfigs = loadPluginConfig();
  await pluginRegistry.loadPlugins(pluginConfigs);
});

describe('POST /api/secrets/:orderHash', () => {
  const testOrderHash = '0x1234567890123456789012345678901234567890123456789012345678901234';
  const testOrder = {
    maker: '0x1234567890123456789012345678901234567890',
    makerAsset: '0x1234567890123456789012345678901234567890',
    takerAsset: '0x0987654321098765432109876543210987654321',
    makerTraits: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    salt: '123456789',
    makingAmount: '1000000000000000000',
    takingAmount: '2000000000000000000',
    receiver: '0x0000000000000000000000000000000000000000'
  };

  beforeEach(async () => {
    // Clean up database
    await db('orders').del();
    await db('escrow_validations').del();
    
    // Insert test order
    const encryptionKey = getEncryptionKey();
    const { hashlock, encryptedSecret } = generateSecretWithHashlock(encryptionKey);
    
    await insertOrder({
      order: testOrder,
      orderHash: testOrderHash,
      status: OrderStatus.ACTIVE,
      hashlock,
      secret: encryptedSecret, // Store the encrypted secret
      orderData: { ...testOrder, salt: testOrder.salt },
      signedData: { order: testOrder, signature: '0x' + 'a'.repeat(130) }
    });
  });

  afterEach(async () => {
    // Clean up
    await db('orders').del();
    await db('escrow_validations').del();
  });

  it('should return secret when escrow validation passes', async () => {
    const response = await request(app)
      .post(`/api/secrets/${testOrderHash}`)
      .send({
        srcEscrowAddress: '0x1234567890123456789012345678901234567890',
        dstEscrowAddress: '0x0987654321098765432109876543210987654321',
        srcChainId: '1',
        dstChainId: '137'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.secret).toBeDefined();
    expect(response.body.data.orderHash).toBe(testOrderHash);
    expect(response.body.data.validationResult).toBeDefined();
    expect(response.body.data.validationResult.srcEscrow.valid).toBe(true);
    expect(response.body.data.validationResult.dstEscrow.valid).toBe(true);
  });

  it('should return error for invalid order hash', async () => {
    const response = await request(app)
      .post('/api/secrets/invalid-hash')
      .send({
        srcEscrowAddress: '0x1234567890123456789012345678901234567890',
        dstEscrowAddress: '0x0987654321098765432109876543210987654321',
        srcChainId: '1',
        dstChainId: '137'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_SECRET_REQUEST');
  });

  it('should return error for invalid request data', async () => {
    const response = await request(app)
      .post(`/api/secrets/${testOrderHash}`)
      .send({
        srcEscrowAddress: 'invalid-address',
        dstEscrowAddress: '0x0987654321098765432109876543210987654321',
        srcChainId: '1',
        dstChainId: '137'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_SECRET_REQUEST');
  });

  it('should return error for unsupported chain', async () => {
    const response = await request(app)
      .post(`/api/secrets/${testOrderHash}`)
      .send({
        srcEscrowAddress: '0x1234567890123456789012345678901234567890',
        dstEscrowAddress: '0x0987654321098765432109876543210987654321',
        srcChainId: '999', // Unsupported chain
        dstChainId: '137'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('ESCROW_VALIDATION_FAILED');
  });

  it('should return error for non-existent order', async () => {
    const response = await request(app)
      .post('/api/secrets/0x9999999999999999999999999999999999999999999999999999999999999999')
      .send({
        srcEscrowAddress: '0x1234567890123456789012345678901234567890',
        dstEscrowAddress: '0x0987654321098765432109876543210987654321',
        srcChainId: '1',
        dstChainId: '137'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_SECRET_REQUEST');
  });

  it('should return error for order not in valid state', async () => {
    // Update order to pending state
    await db('orders')
      .where({ order_hash: testOrderHash })
      .update({ status: OrderStatus.PENDING });

    const response = await request(app)
      .post(`/api/secrets/${testOrderHash}`)
      .send({
        srcEscrowAddress: '0x1234567890123456789012345678901234567890',
        dstEscrowAddress: '0x0987654321098765432109876543210987654321',
        srcChainId: '1',
        dstChainId: '137'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_SECRET_REQUEST');

    // Reset order status back to active for other tests
    await db('orders')
      .where({ order_hash: testOrderHash })
      .update({ status: OrderStatus.ACTIVE });
  });
}); 