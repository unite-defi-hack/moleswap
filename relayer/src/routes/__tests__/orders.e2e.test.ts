// Set test environment before any imports
process.env['NODE_ENV'] = 'test';

import request from 'supertest';
import { createApp } from '../../index';
import { db, runMigrations } from '../../database/connection';
import { ethers } from 'ethers';

describe('Orders API - End to End Tests', () => {
  let app: any;

  beforeAll(async () => {
    // Initialize the app
    const { app: createdApp } = createApp();
    app = createdApp;
    
    // Ensure database is set up for tests
    await runMigrations();
  });

  afterAll(async () => {
    // Clean up test data
    await db('orders').del();
  });

  describe('POST /api/orders/data - E2E', () => {
    it('should generate real order data with hashlock', async () => {
      const validOrderData = {
        order: {
          maker: '0x71078879cd9a1d7987b74cee6b6c0d130f1a0115',
          srcAssetAddress: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
          dstAssetAddress: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
          srcAmount: '1000000000000000000',
          dstAmount: '2000000000000000000',
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
      expect(order.srcAssetAddress).toBe(validOrderData.order.srcAssetAddress);
      expect(order.dstAssetAddress).toBe(validOrderData.order.dstAssetAddress);
      expect(order.srcAmount).toBe(validOrderData.order.srcAmount);
      expect(order.dstAmount).toBe(validOrderData.order.dstAmount);
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
      // Create a real signature using ethers.js
      const wallet = ethers.Wallet.createRandom();
      
      // Generate order data first with the wallet's address
      const validOrderData = {
        order: {
          maker: wallet.address,
          srcAssetAddress: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
          dstAssetAddress: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
          srcAmount: '1000000000000000000',
          dstAmount: '2000000000000000000',
          receiver: '0x0000000000000000000000000000000000000000'
        }
      };

      const orderDataResponse = await request(app)
        .post('/api/orders/data')
        .send(validOrderData)
        .expect(200);

      const orderData = orderDataResponse.body.data;
      expect(orderData).toBeDefined();

      // Use the order data as is, since it already has the correct maker address
      const orderToSign = orderData.orderToSign;
      
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
          { name: 'srcAssetAddress', type: 'address' },
          { name: 'dstAssetAddress', type: 'address' },
          { name: 'makerTraits', type: 'bytes32' },
          { name: 'salt', type: 'uint256' },
          { name: 'srcAmount', type: 'uint256' },
          { name: 'dstAmount', type: 'uint256' },
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
      // First, create a valid order with a wallet that matches the maker address
      const wallet1 = ethers.Wallet.createRandom();
      
      // Generate order data first with the wallet's address
      const validOrderData = {
        order: {
          maker: wallet1.address,
          srcAssetAddress: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
          dstAssetAddress: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
          srcAmount: '1000000000000000000',
          dstAmount: '2000000000000000000',
          receiver: '0x0000000000000000000000000000000000000000'
        }
      };

      const orderDataResponse = await request(app)
        .post('/api/orders/data')
        .send(validOrderData)
        .expect(200);

      const orderData = orderDataResponse.body.data;
      
      // Use the order data as is, since it already has the correct maker address
      const orderToSign1 = orderData.orderToSign;
      
      const domain = {
        name: 'MoleSwap Relayer',
        version: '1.0.0',
        chainId: 1,
        verifyingContract: '0x0000000000000000000000000000000000000000'
      };

      const types = {
        Order: [
          { name: 'maker', type: 'address' },
          { name: 'srcAssetAddress', type: 'address' },
          { name: 'dstAssetAddress', type: 'address' },
          { name: 'makerTraits', type: 'bytes32' },
          { name: 'salt', type: 'uint256' },
          { name: 'srcAmount', type: 'uint256' },
          { name: 'dstAmount', type: 'uint256' },
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
      // Create an invalid order with wrong address format
      const wallet = ethers.Wallet.createRandom();
      
      // Generate order data first with the wallet's address
      const validOrderData = {
        order: {
          maker: wallet.address,
          srcAssetAddress: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
          dstAssetAddress: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
          srcAmount: '1000000000000000000',
          dstAmount: '2000000000000000000',
          receiver: '0x0000000000000000000000000000000000000000'
        }
      };

      const orderDataResponse = await request(app)
        .post('/api/orders/data')
        .send(validOrderData)
        .expect(200);

      const orderData = orderDataResponse.body.data;
      
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

  describe('GET /api/orders - E2E', () => {
    let testOrders: string[] = [];

    beforeAll(async () => {
      // Create multiple test orders for querying
      const domain = {
        name: 'MoleSwap Relayer',
        version: '1.0.0',
        chainId: 1,
        verifyingContract: '0x0000000000000000000000000000000000000000'
      };
      const types = {
        Order: [
          { name: 'maker', type: 'address' },
          { name: 'srcAssetAddress', type: 'address' },
          { name: 'dstAssetAddress', type: 'address' },
          { name: 'makerTraits', type: 'bytes32' },
          { name: 'salt', type: 'uint256' },
          { name: 'srcAmount', type: 'uint256' },
          { name: 'dstAmount', type: 'uint256' },
          { name: 'receiver', type: 'address' }
        ]
      };

      // Create 3 test orders with different makers
      for (let i = 0; i < 3; i++) {
        const wallet = ethers.Wallet.createRandom();
        
        // Generate order data for this wallet
        const validOrderData = {
          order: {
            maker: wallet.address,
            srcAssetAddress: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
            dstAssetAddress: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
            srcAmount: '1000000000000000000',
            dstAmount: '2000000000000000000',
            receiver: '0x0000000000000000000000000000000000000000'
          }
        };

        const orderDataResponse = await request(app)
          .post('/api/orders/data')
          .send(validOrderData)
          .expect(200);

        const orderData = orderDataResponse.body.data;
        
        // Use the order data as is, since it already has the correct maker address
        const orderToSign = orderData.orderToSign;
        const signature = await wallet.signTypedData(domain, types, orderToSign);
        const signedOrder = { order: orderToSign, signature };

        const response = await request(app)
          .post('/api/orders')
          .send({ signedOrder });

        if (response.status === 201) {
          testOrders.push(response.body.data.orderHash);
        }
      }
    });

    it('should query all orders without filters', async () => {
      const response = await request(app)
        .get('/api/orders')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.orders).toBeDefined();
      expect(response.body.data.total).toBeGreaterThanOrEqual(3);
      expect(response.body.data.limit).toBe(50);
      expect(response.body.data.offset).toBe(0);
      expect(response.body.data.hasMore).toBeDefined();

      // Validate order structure
      if (response.body.data.orders.length > 0) {
        const order = response.body.data.orders[0];
        expect(order.order).toBeDefined();
        expect(order.orderHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        expect(order.status).toBeDefined();
        expect(order.createdAt).toBeDefined();
        expect(order.updatedAt).toBeDefined();
      }
    });

    it('should query orders with status filter', async () => {
      const response = await request(app)
        .get('/api/orders?status=active')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeDefined();
      
      // All returned orders should have active status
      response.body.data.orders.forEach((order: any) => {
        expect(order.status).toBe('active');
      });
    });

    it('should query orders with maker filter', async () => {
      // Get the first test order to use its maker
      const { getOrderByHash } = require('../../database/orderService');
      const firstOrder = await getOrderByHash(testOrders[0]);
      const maker = firstOrder.maker;

      const response = await request(app)
        .get(`/api/orders?maker=${maker}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeDefined();
      
      // All returned orders should have the specified maker
      response.body.data.orders.forEach((order: any) => {
        expect(order.order.maker).toBe(maker);
      });
    });

    it('should query orders with makerAsset filter', async () => {
      const makerAsset = '0x10563e509b718a279de002dfc3e94a8a8f642b03';

      const response = await request(app)
        .get(`/api/orders?makerAsset=${makerAsset}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeDefined();
      
      // All returned orders should have the specified makerAsset
      response.body.data.orders.forEach((order: any) => {
        expect(order.order.srcAssetAddress).toBe(makerAsset);
      });
    });

    it('should query orders with takerAsset filter', async () => {
      const takerAsset = '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c';

      const response = await request(app)
        .get(`/api/orders?takerAsset=${takerAsset}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeDefined();
      
      // All returned orders should have the specified takerAsset
      response.body.data.orders.forEach((order: any) => {
        expect(order.order.dstAssetAddress).toBe(takerAsset);
      });
    });

    it('should query orders with pagination', async () => {
      const response = await request(app)
        .get('/api/orders?limit=2&offset=0')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeDefined();
      expect(response.body.data.limit).toBe(2);
      expect(response.body.data.offset).toBe(0);
      expect(response.body.data.orders.length).toBeLessThanOrEqual(2);
      expect(response.body.data.hasMore).toBeDefined();
    });

    it('should query orders with multiple filters', async () => {
      const makerAsset = '0x10563e509b718a279de002dfc3e94a8a8f642b03';
      const takerAsset = '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c';

      const response = await request(app)
        .get(`/api/orders?status=active&makerAsset=${makerAsset}&takerAsset=${takerAsset}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeDefined();
      
      // All returned orders should match all filters
      response.body.data.orders.forEach((order: any) => {
        expect(order.status).toBe('active');
        expect(order.order.srcAssetAddress).toBe(makerAsset);
        expect(order.order.dstAssetAddress).toBe(takerAsset);
      });
    });

    it('should handle invalid filter parameters', async () => {
      const response = await request(app)
        .get('/api/orders?status=invalid_status')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });
  });

  describe('PATCH /api/orders/:orderHash/status - E2E', () => {
    let testOrderHash: string;

    beforeAll(async () => {
      // Create a test order for status updates
      const wallet = ethers.Wallet.createRandom();
      
      // Generate order data first with the wallet's address
      const validOrderData = {
        order: {
          maker: wallet.address,
          srcAssetAddress: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
          dstAssetAddress: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
          srcAmount: '1000000000000000000',
          dstAmount: '2000000000000000000',
          receiver: '0x0000000000000000000000000000000000000000'
        }
      };

      const orderDataResponse = await request(app)
        .post('/api/orders/data')
        .send(validOrderData)
        .expect(200);

      const orderData = orderDataResponse.body.data;
      
      // Use the order data as is, since it already has the correct maker address
      const orderToSign = orderData.orderToSign;
      
      const domain = {
        name: 'MoleSwap Relayer',
        version: '1.0.0',
        chainId: 1,
        verifyingContract: '0x0000000000000000000000000000000000000000'
      };
      const types = {
        Order: [
          { name: 'maker', type: 'address' },
          { name: 'srcAssetAddress', type: 'address' },
          { name: 'dstAssetAddress', type: 'address' },
          { name: 'makerTraits', type: 'bytes32' },
          { name: 'salt', type: 'uint256' },
          { name: 'srcAmount', type: 'uint256' },
          { name: 'dstAmount', type: 'uint256' },
          { name: 'receiver', type: 'address' }
        ]
      };

      const signature = await wallet.signTypedData(domain, types, orderToSign);
      const signedOrder = { order: orderToSign, signature };

      const response = await request(app)
        .post('/api/orders')
        .send({ signedOrder });

      testOrderHash = response.body.data.orderHash;
    });

    it('should update order status from active to completed', async () => {
      const response = await request(app)
        .patch(`/api/orders/${testOrderHash}/status`)
        .send({ status: 'completed', reason: 'Order fulfilled' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.orderHash).toBe(testOrderHash);
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.order).toBeDefined();
      expect(response.body.data.createdAt).toBeDefined();
      expect(response.body.data.updatedAt).toBeDefined();
    });

    it('should reject invalid status transition', async () => {
      // Try to change from completed back to active (invalid transition)
      const response = await request(app)
        .patch(`/api/orders/${testOrderHash}/status`)
        .send({ status: 'active', reason: 'Invalid transition' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Invalid status transition');
    });

    it('should reject invalid order hash', async () => {
      const response = await request(app)
        .patch('/api/orders/invalid_hash/status')
        .send({ status: 'active' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });

    it('should reject non-existent order', async () => {
      const fakeHash = '0x' + '1'.repeat(64);
      const response = await request(app)
        .patch(`/api/orders/${fakeHash}/status`)
        .send({ status: 'cancelled' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('ORDER_NOT_FOUND');
    });

    it('should reject invalid status update data', async () => {
      const response = await request(app)
        .patch(`/api/orders/${testOrderHash}/status`)
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });

    it('should update status without reason', async () => {
      // Create a new order for this test
      const wallet = ethers.Wallet.createRandom();
      
      // Generate order data first with the wallet's address
      const validOrderData = {
        order: {
          maker: wallet.address,
          srcAssetAddress: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
          dstAssetAddress: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
          srcAmount: '1000000000000000000',
          dstAmount: '2000000000000000000',
          receiver: '0x0000000000000000000000000000000000000000'
        }
      };

      const orderDataResponse = await request(app)
        .post('/api/orders/data')
        .send(validOrderData)
        .expect(200);

      const orderData = orderDataResponse.body.data;
      
      // Use the order data as is, since it already has the correct maker address
      const orderToSign = orderData.orderToSign;
      
      const domain = {
        name: 'MoleSwap Relayer',
        version: '1.0.0',
        chainId: 1,
        verifyingContract: '0x0000000000000000000000000000000000000000'
      };
      const types = {
        Order: [
          { name: 'maker', type: 'address' },
          { name: 'srcAssetAddress', type: 'address' },
          { name: 'dstAssetAddress', type: 'address' },
          { name: 'makerTraits', type: 'bytes32' },
          { name: 'salt', type: 'uint256' },
          { name: 'srcAmount', type: 'uint256' },
          { name: 'dstAmount', type: 'uint256' },
          { name: 'receiver', type: 'address' }
        ]
      };

      const signature = await wallet.signTypedData(domain, types, orderToSign);
      const signedOrder = { order: orderToSign, signature };

      const createResponse = await request(app)
        .post('/api/orders')
        .send({ signedOrder });

      const newOrderHash = createResponse.body.data.orderHash;

      const response = await request(app)
        .patch(`/api/orders/${newOrderHash}/status`)
        .send({ status: 'cancelled' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
    });
  });

  describe('Database Verification', () => {
    it('should verify order was actually stored in database', async () => {
      // Create a real signature using ethers.js
      const wallet = ethers.Wallet.createRandom();
      
      // Generate order data first with the wallet's address
      const validOrderData = {
        order: {
          maker: wallet.address,
          srcAssetAddress: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
          dstAssetAddress: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
          srcAmount: '1000000000000000000',
          dstAmount: '2000000000000000000',
          receiver: '0x0000000000000000000000000000000000000000'
        }
      };

      const orderDataResponse = await request(app)
        .post('/api/orders/data')
        .send(validOrderData)
        .expect(200);

      const orderData = orderDataResponse.body.data;
      
      // Use the order data as is, since it already has the correct maker address
      const orderToSign = orderData.orderToSign;
      
      const domain = {
        name: 'MoleSwap Relayer',
        version: '1.0.0',
        chainId: 1,
        verifyingContract: '0x0000000000000000000000000000000000000000'
      };

      const types = {
        Order: [
          { name: 'maker', type: 'address' },
          { name: 'srcAssetAddress', type: 'address' },
          { name: 'dstAssetAddress', type: 'address' },
          { name: 'makerTraits', type: 'bytes32' },
          { name: 'salt', type: 'uint256' },
          { name: 'srcAmount', type: 'uint256' },
          { name: 'dstAmount', type: 'uint256' },
          { name: 'receiver', type: 'address' }
        ]
      };

      const signature = await wallet.signTypedData(domain, types, orderToSign);
      const signedOrder = { order: orderToSign, signature };

      const createResponse = await request(app)
        .post('/api/orders')
        .send({ signedOrder })
        .expect(201);

      const orderHash = createResponse.body.data.orderHash;
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