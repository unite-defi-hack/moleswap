// Mock modules before imports
jest.mock('../../utils/orderHashing', () => ({
  generateOrderHash: jest.fn(),
  verifyOrderSignature: jest.fn(),
  generateRandomSalt: jest.fn(),
}));

jest.mock('../../utils/secretGeneration', () => ({
  generateSecretWithHashlock: jest.fn(),
  getEncryptionKey: jest.fn(),
}));

jest.mock('../../database/orderService', () => ({
  insertOrder: jest.fn(),
  getOrderByHash: jest.fn(),
}));

import request from 'supertest';
import express from 'express';
import { orderRoutes } from '../orders';

const app = express();
app.use(express.json());
app.use('/api/orders', orderRoutes);

describe('Orders API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/orders/data', () => {
    const validOrderData = {
      order: {
        maker: '0x71078879cd9a1d7987b74cee6b6c0d130f1a0115',
        makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
        takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
        makingAmount: '1000000000000000000',
        takingAmount: '2000000000000000000',
        receiver: '0x0000000000000000000000000000000000000000'
      }
    };

    beforeEach(() => {
      // Mock the functions for /data endpoint
      const { generateOrderHash, generateRandomSalt } = require('../../utils/orderHashing');
      const { generateSecretWithHashlock } = require('../../utils/secretGeneration');
      
      generateOrderHash.mockReturnValue({ 
        orderHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' 
      });
      generateRandomSalt.mockReturnValue('1234567890123456789012345678901234567890');
      generateSecretWithHashlock.mockReturnValue({
        secret: 'test-secret',
        hashlock: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        encryptedSecret: 'encrypted-secret'
      });
    });

    it('should generate order data with hashlock for valid request', async () => {
      const response = await request(app)
        .post('/api/orders/data')
        .send(validOrderData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.orderToSign).toBeDefined();
      expect(response.body.data.orderHash).toBeDefined();
      
      // Validate order structure
      const order = response.body.data.orderToSign;
      expect(order.maker).toBe(validOrderData.order.maker);
      expect(order.makerAsset).toBe(validOrderData.order.makerAsset);
      expect(order.takerAsset).toBe(validOrderData.order.takerAsset);
      expect(order.makingAmount).toBe(validOrderData.order.makingAmount);
      expect(order.takingAmount).toBe(validOrderData.order.takingAmount);
      expect(order.receiver).toBe(validOrderData.order.receiver);
      
      // Validate generated fields
      expect(order.makerTraits).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(order.salt).toBeDefined();
      expect(order.salt.length).toBeGreaterThan(0);
      
      // Validate order hash
      expect(response.body.data.orderHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should reject request with invalid maker address', async () => {
      const invalidOrderData = {
        ...validOrderData,
        order: {
          ...validOrderData.order,
          maker: '0xinvalid'
        }
      };

      const response = await request(app)
        .post('/api/orders/data')
        .send(invalidOrderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_ORDER');
      expect(response.body.error.message).toBe('Invalid order data');
    });

    it('should reject request with invalid maker asset address', async () => {
      const invalidOrderData = {
        ...validOrderData,
        order: {
          ...validOrderData.order,
          makerAsset: '0xinvalid'
        }
      };

      const response = await request(app)
        .post('/api/orders/data')
        .send(invalidOrderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });

    it('should reject request with zero making amount', async () => {
      const invalidOrderData = {
        ...validOrderData,
        order: {
          ...validOrderData.order,
          makingAmount: '0'
        }
      };

      const response = await request(app)
        .post('/api/orders/data')
        .send(invalidOrderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });

    it('should reject request with zero taking amount', async () => {
      const invalidOrderData = {
        ...validOrderData,
        order: {
          ...validOrderData.order,
          takingAmount: '0'
        }
      };

      const response = await request(app)
        .post('/api/orders/data')
        .send(invalidOrderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });

    it('should reject request with same maker and taker assets', async () => {
      const invalidOrderData = {
        ...validOrderData,
        order: {
          ...validOrderData.order,
          takerAsset: validOrderData.order.makerAsset
        }
      };

      const response = await request(app)
        .post('/api/orders/data')
        .send(invalidOrderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });

    it('should reject request with missing required fields', async () => {
      const invalidOrderData = {
        order: {
          maker: '0x71078879cd9a1d7987b74cee6b6c0d130f1a0115',
          // Missing makerAsset, takerAsset, makingAmount, takingAmount
        }
      };

      const response = await request(app)
        .post('/api/orders/data')
        .send(invalidOrderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });

    it('should use default receiver when not provided', async () => {
      const orderDataWithoutReceiver = {
        order: {
          maker: '0x71078879cd9a1d7987b74cee6b6c0d130f1a0115',
          makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
          takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
          makingAmount: '1000000000000000000',
          takingAmount: '2000000000000000000'
          // receiver not provided
        }
      };

      const response = await request(app)
        .post('/api/orders/data')
        .send(orderDataWithoutReceiver)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orderToSign.receiver).toBe('0x0000000000000000000000000000000000000000');
    });

    it('should generate different hashlocks for different requests', async () => {
      // Mock different hashlocks for each call
      const { generateSecretWithHashlock } = require('../../utils/secretGeneration');
      const { generateOrderHash: generateOrderHashMock } = require('../../utils/orderHashing');
      generateSecretWithHashlock
        .mockReturnValueOnce({
          secret: 'test-secret-1',
          hashlock: '0x1111111111111111111111111111111111111111111111111111111111111111',
          encryptedSecret: 'encrypted-secret-1'
        })
        .mockReturnValueOnce({
          secret: 'test-secret-2',
          hashlock: '0x2222222222222222222222222222222222222222222222222222222222222222',
          encryptedSecret: 'encrypted-secret-2'
        });
      
      // Mock different order hashes for each call
      generateOrderHashMock
        .mockReturnValueOnce({ 
          orderHash: '0x1111111111111111111111111111111111111111111111111111111111111111' 
        })
        .mockReturnValueOnce({ 
          orderHash: '0x2222222222222222222222222222222222222222222222222222222222222222' 
        });

      const response1 = await request(app)
        .post('/api/orders/data')
        .send(validOrderData)
        .expect(200);

      const response2 = await request(app)
        .post('/api/orders/data')
        .send(validOrderData)
        .expect(200);

      expect(response1.body.data.orderToSign.makerTraits).not.toBe(response2.body.data.orderToSign.makerTraits);
      expect(response1.body.data.orderHash).not.toBe(response2.body.data.orderHash);
    });

    it('should generate different salts for different requests', async () => {
      // Mock different salts for each call
      const { generateRandomSalt } = require('../../utils/orderHashing');
      generateRandomSalt
        .mockReturnValueOnce('1111111111111111111111111111111111111111111111111111111111111111')
        .mockReturnValueOnce('2222222222222222222222222222222222222222222222222222222222222222');

      const response1 = await request(app)
        .post('/api/orders/data')
        .send(validOrderData)
        .expect(200);

      const response2 = await request(app)
        .post('/api/orders/data')
        .send(validOrderData)
        .expect(200);

      expect(response1.body.data.orderToSign.salt).not.toBe(response2.body.data.orderToSign.salt);
    });
  });

  describe('POST /api/orders', () => {
    const validOrder = {
      maker: '0x71078879cd9a1d7987b74cee6b6c0d130f1a0115',
      makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
      takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
      makerTraits: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      salt: '8240221422984282745454410369971298296651574087129927646899272926690',
      makingAmount: '1000000000000000000',
      takingAmount: '2000000000000000000',
      receiver: '0x0000000000000000000000000000000000000000'
    };
    const validSignature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b';
    const signedOrder = {
      order: validOrder,
      signature: validSignature
    };

    beforeEach(() => {
      // Mock successful signature verification
      const { verifyOrderSignature, generateOrderHash } = require('../../utils/orderHashing');
      verifyOrderSignature.mockReturnValue({ valid: true, signer: validOrder.maker });
      generateOrderHash.mockReturnValue({ orderHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' });
      
      // Mock database operations
      const { getOrderByHash, insertOrder } = require('../../database/orderService');
      getOrderByHash.mockResolvedValue(null); // No existing order
      insertOrder.mockResolvedValue({
        order: validOrder,
        orderHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    it('should create a new order with valid signed data', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({ signedOrder })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.orderHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(response.body.data.status).toBe('active');
      expect(response.body.data.createdAt).toBeDefined();
    });

    it('should reject duplicate order hash', async () => {
      // Mock existing order
      const { getOrderByHash } = require('../../database/orderService');
      getOrderByHash.mockResolvedValue({ 
        order_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        status: 'active'
      });

      const response = await request(app)
        .post('/api/orders')
        .send({ signedOrder })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('ORDER_ALREADY_EXISTS');
    });

    it('should reject invalid signature', async () => {
      // Mock failed signature verification
      const { verifyOrderSignature } = require('../../utils/orderHashing');
      verifyOrderSignature.mockReturnValue({ 
        valid: false, 
        error: 'Invalid signature',
        signer: '0x1234567890123456789012345678901234567890'
      });

      const response = await request(app)
        .post('/api/orders')
        .send({ signedOrder })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('should reject invalid order data', async () => {
      const badOrder = { ...validOrder, maker: '0xinvalid' };
      const response = await request(app)
        .post('/api/orders')
        .send({ signedOrder: { order: badOrder, signature: validSignature } })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });
  });
}); 