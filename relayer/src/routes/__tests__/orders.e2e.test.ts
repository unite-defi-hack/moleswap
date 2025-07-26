import request from 'supertest';
import express from 'express';
import { orderRoutes } from '../orders';
import { initializeDatabase, closeDatabase } from '../../database/connection';
import { ethers } from 'ethers';

const app = express();
app.use(express.json());
app.use('/api/orders', orderRoutes);

describe('Orders API - End to End Tests', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('POST /api/orders/data - E2E', () => {
    it('should generate real order data with hashlock', async () => {
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
      
      // Store the generated data for the next test
      (global as any).generatedOrderData = response.body.data;
    });
  });

  describe('POST /api/orders - E2E', () => {
    it('should create a real order in the database', async () => {
      // Get the order data from the previous test
      const orderData = (global as any).generatedOrderData;
      expect(orderData).toBeDefined();

      // Create a real signature using ethers.js
      const wallet = ethers.Wallet.createRandom();
      // Update the order to use the wallet's address as the maker
      const orderToSign = {
        ...orderData.orderToSign,
        maker: wallet.address
      };
      
      // Create the typed data for signing - use the same domain as the orderHashing utility
      const domain = {
        name: 'MoleSwap Relayer',
        version: '1.0.0',
        chainId: 1,
        verifyingContract: '0x0000000000000000000000000000000000000000'
      };

      const types = {
        Order: [
          { name: 'maker', type: 'address' },
          { name: 'makerAsset', type: 'address' },
          { name: 'takerAsset', type: 'address' },
          { name: 'makerTraits', type: 'bytes32' },
          { name: 'salt', type: 'uint256' },
          { name: 'makingAmount', type: 'uint256' },
          { name: 'takingAmount', type: 'uint256' },
          { name: 'receiver', type: 'address' }
        ]
      };

      // Sign the order
      const signature = await wallet.signTypedData(domain, types, orderToSign);

      const signedOrder = {
        order: orderToSign,
        signature: signature
      };

      const response = await request(app)
        .post('/api/orders')
        .send({ signedOrder });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.orderHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(response.body.data.status).toBe('active');
      expect(response.body.data.createdAt).toBeDefined();

      // Store the order hash for verification
      (global as any).createdOrderHash = response.body.data.orderHash;
    });

    it('should reject duplicate order hash', async () => {
      const orderData = (global as any).generatedOrderData;
      
      // First, create a valid order with a wallet that matches the maker address
      const wallet1 = ethers.Wallet.createRandom();
      const orderToSign1 = {
        ...orderData.orderToSign,
        maker: wallet1.address
      };
      
      const domain = {
        name: 'MoleSwap Relayer',
        version: '1.0.0',
        chainId: 1,
        verifyingContract: '0x0000000000000000000000000000000000000000'
      };

      const types = {
        Order: [
          { name: 'maker', type: 'address' },
          { name: 'makerAsset', type: 'address' },
          { name: 'takerAsset', type: 'address' },
          { name: 'makerTraits', type: 'bytes32' },
          { name: 'salt', type: 'uint256' },
          { name: 'makingAmount', type: 'uint256' },
          { name: 'takingAmount', type: 'uint256' },
          { name: 'receiver', type: 'address' }
        ]
      };

      const signature1 = await wallet1.signTypedData(domain, types, orderToSign1);
      const signedOrder1 = {
        order: orderToSign1,
        signature: signature1
      };

      // Create the first order
      const response1 = await request(app)
        .post('/api/orders')
        .send({ signedOrder: signedOrder1 });

      expect(response1.status).toBe(201);
      
      // Now try to create the exact same order again
      const signature2 = await wallet1.signTypedData(domain, types, orderToSign1);
      const signedOrder2 = {
        order: orderToSign1,
        signature: signature2
      };

      const response2 = await request(app)
        .post('/api/orders')
        .send({ signedOrder: signedOrder2 });

      expect(response2.status).toBe(409);
      expect(response2.body.success).toBe(false);
      expect(response2.body.error).toBeDefined();
      expect(response2.body.error.code).toBe('ORDER_ALREADY_EXISTS');
    });

    it('should reject invalid signature', async () => {
      const orderData = (global as any).generatedOrderData;
      const orderToSign = orderData.orderToSign;
      
      // Create a valid format signature that will fail verification
      const invalidSignature = '0x' + '1'.repeat(130); // 65 bytes of 1s
      
      const signedOrder = {
        order: orderToSign,
        signature: invalidSignature
      };

      const response = await request(app)
        .post('/api/orders')
        .send({ signedOrder });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('should reject invalid order data', async () => {
      const orderData = (global as any).generatedOrderData;
      // Create an invalid order with wrong address format
      const orderToSign = { 
        ...orderData.orderToSign, 
        maker: '0x123' // Invalid address format
      };
      
      // This should fail validation before signing
      const signedOrder = {
        order: orderToSign,
        signature: '0xdeadbeef' // Invalid signature since we can't sign invalid data
      };

      const response = await request(app)
        .post('/api/orders')
        .send({ signedOrder })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });
  });

  describe('Database Verification', () => {
    it('should verify order was actually stored in database', async () => {
      const orderHash = (global as any).createdOrderHash;
      expect(orderHash).toBeDefined();

      // Import the database service
      const { getOrderByHash } = require('../../database/orderService');
      
      // Query the database for the order
      const storedOrder = await getOrderByHash(orderHash);
      
      expect(storedOrder).toBeDefined();
      expect(storedOrder.order_hash).toBe(orderHash);
      expect(storedOrder.status).toBe('active');
      // The maker address will be the wallet's address, not the original one
      expect(storedOrder.maker).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(storedOrder.maker_token).toBe('0x10563e509b718a279de002dfc3e94a8a8f642b03');
      expect(storedOrder.taker_token).toBe('0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c');
      expect(storedOrder.maker_amount).toBe('1000000000000000000');
      expect(storedOrder.taker_amount).toBe('2000000000000000000');
      expect(storedOrder.hashlock).toBeDefined();
      expect(storedOrder.order_data).toBeDefined();
      expect(storedOrder.signed_data).toBeDefined();
      expect(storedOrder.created_at).toBeDefined();
      expect(storedOrder.updated_at).toBeDefined();
    });
  });
}); 