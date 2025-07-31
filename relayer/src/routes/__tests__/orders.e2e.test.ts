// Set test environment before any imports
process.env['NODE_ENV'] = 'test';

import request from 'supertest';
import { createApp } from '../../index';
import { db, runMigrations } from '../../database/connection';
import { ethers } from 'ethers';

// Helper function to generate a proper salt for orders
function generateSalt(): string {
  const randomBytes = ethers.randomBytes(32);
  return ethers.toBigInt(ethers.hexlify(randomBytes)).toString();
}

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

  describe('POST /api/orders/complete - E2E', () => {
    it('should create a complete order with extension, secret, and secretHash', async () => {
      // Create a real signature using ethers.js
      const wallet = ethers.Wallet.createRandom();
      
      // Create a complete order with user-generated secret
      const secret = ethers.randomBytes(32);
      const secretHash = ethers.keccak256(secret);
      
      const completeOrder = {
        order: {
          maker: wallet.address,
          makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
          takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
          makerTraits: secretHash, // Use secret hash as hashlock
          makingAmount: '1000000000000000000',
          takingAmount: '2000000000000000000',
          salt: generateSalt(),
          receiver: '0x0000000000000000000000000000000000000000'
        },
        extension: '0x0000010f0000004a0000004a0000004a0000004a000000250000000000000000b7dcd034d89bef6429ec80eaf77f8ffb73e5b40b00000000000000688a9ff4000384000000b7dcd034d89bef6429ec80eaf77f8ffb73e5b40b00000000000000688a9ff4000384000000b7dcd034d89bef6429ec80eaf77f8ffb73e5b40b688aa0008863b00397a9e212049500000800bd363c7762ace561ec85a122307bff99ee8832363f26c64e9a1545b1b453500000000000000000000000000000000000000000000000000000000000014a3400000000000000000000000010563e509b718a279de002dfc3e94a8a8f642b030000000000000000000000e8d4a510000000000000000000000000e8d4a5100000000000000000b4000000780000000a00005dc00000465000002ee00000000a',
        secret: ethers.hexlify(secret),
        secretHash: secretHash
      };

      // Create the typed data for signing
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
      const signature = await wallet.signTypedData(domain, types, completeOrder.order);

      const requestData = {
        completeOrder: {
          ...completeOrder,
          signature: signature
        }
      };

      const response = await request(app)
        .post('/api/orders/complete')
        .send(requestData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orderHash).toBeDefined();
      expect(response.body.data.status).toBe('active');
      
      // Store the order hash for later tests
      (global as any).createdOrderHash = response.body.data.orderHash;
    });

    it('should reject duplicate complete order', async () => {
      const wallet = ethers.Wallet.createRandom();
      const secret = ethers.randomBytes(32);
      const secretHash = ethers.keccak256(secret);
      
      const completeOrder = {
        order: {
          maker: wallet.address,
          makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
          takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
          makerTraits: secretHash,
          makingAmount: '1000000000000000000',
          takingAmount: '2000000000000000000',
          salt: generateSalt(),
          receiver: '0x0000000000000000000000000000000000000000'
        },
        extension: '0x0000010f0000004a0000004a0000004a0000004a000000250000000000000000b7dcd034d89bef6429ec80eaf77f8ffb73e5b40b00000000000000688a9ff4000384000000b7dcd034d89bef6429ec80eaf77f8ffb73e5b40b00000000000000688a9ff4000384000000b7dcd034d89bef6429ec80eaf77f8ffb73e5b40b688aa0008863b00397a9e212049500000800bd363c7762ace561ec85a122307bff99ee8832363f26c64e9a1545b1b453500000000000000000000000000000000000000000000000014a3400000000000000000000000010563e509b718a279de002dfc3e94a8a8f642b030000000000000000000000e8d4a510000000000000000000000000e8d4a5100000000000000000b4000000780000000a00005dc00000465000002ee00000000a',
        secret: ethers.hexlify(secret),
        secretHash: secretHash
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

      const signature = await wallet.signTypedData(domain, types, completeOrder.order);

      const requestData = {
        completeOrder: {
          ...completeOrder,
          signature: signature
        }
      };

      // First request should succeed
      await request(app)
        .post('/api/orders/complete')
        .send(requestData)
        .expect(201);

      // Second request with same order should fail
      const response = await request(app)
        .post('/api/orders/complete')
        .send(requestData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ORDER_ALREADY_EXISTS');
    });

    it('should reject invalid signature', async () => {
      const wallet = ethers.Wallet.createRandom();
      const secret = ethers.randomBytes(32);
      const secretHash = ethers.keccak256(secret);
      
      const completeOrder = {
        order: {
          maker: wallet.address,
          makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
          takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
          makerTraits: secretHash,
          makingAmount: '1000000000000000000',
          takingAmount: '2000000000000000000',
          salt: generateSalt(),
          receiver: '0x0000000000000000000000000000000000000000'
        },
        extension: '0x0000010f0000004a0000004a0000004a0000004a000000250000000000000000b7dcd034d89bef6429ec80eaf77f8ffb73e5b40b00000000000000688a9ff4000384000000b7dcd034d89bef6429ec80eaf77f8ffb73e5b40b00000000000000688a9ff4000384000000b7dcd034d89bef6429ec80eaf77f8ffb73e5b40b688aa0008863b00397a9e212049500000800bd363c7762ace561ec85a122307bff99ee8832363f26c64e9a1545b1b453500000000000000000000000000000000000000000000000014a3400000000000000000000000010563e509b718a279de002dfc3e94a8a8f642b030000000000000000000000e8d4a510000000000000000000000000e8d4a5100000000000000000b4000000780000000a00005dc00000465000002ee00000000a',
        secret: ethers.hexlify(secret),
        secretHash: secretHash
      };

      const requestData = {
        completeOrder: {
          ...completeOrder,
          signature: '0x' + '1'.repeat(130) // Invalid signature
        }
      };

      const response = await request(app)
        .post('/api/orders/complete')
        .send(requestData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('should reject when secretHash does not match makerTraits', async () => {
      const wallet = ethers.Wallet.createRandom();
      const secret = ethers.randomBytes(32);
      const wrongSecretHash = ethers.keccak256(ethers.randomBytes(32)); // Different hash
      
      const completeOrder = {
        order: {
          maker: wallet.address,
          makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
          takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
          makerTraits: ethers.keccak256(secret), // Correct hash
          makingAmount: '1000000000000000000',
          takingAmount: '2000000000000000000',
          salt: generateSalt(),
          receiver: '0x0000000000000000000000000000000000000000'
        },
        extension: '0x0000010f0000004a0000004a0000004a0000004a000000250000000000000000b7dcd034d89bef6429ec80eaf77f8ffb73e5b40b00000000000000688a9ff4000384000000b7dcd034d89bef6429ec80eaf77f8ffb73e5b40b00000000000000688a9ff4000384000000b7dcd034d89bef6429ec80eaf77f8ffb73e5b40b688aa0008863b00397a9e212049500000800bd363c7762ace561ec85a122307bff99ee8832363f26c64e9a1545b1b453500000000000000000000000000000000000000000000000014a3400000000000000000000000010563e509b718a279de002dfc3e94a8a8f642b030000000000000000000000e8d4a510000000000000000000000000e8d4a5100000000000000000b4000000780000000a00005dc00000465000002ee00000000a',
        secret: ethers.hexlify(secret),
        secretHash: wrongSecretHash // Wrong hash
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

      const signature = await wallet.signTypedData(domain, types, completeOrder.order);

      const requestData = {
        completeOrder: {
          ...completeOrder,
          signature: signature
        }
      };

      const response = await request(app)
        .post('/api/orders/complete')
        .send(requestData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.errors).toContain('Secret hash must match the makerTraits (hashlock)');
    });
  });

  describe('POST /api/orders - E2E', () => {
    it('should create a regular order in the database', async () => {
      // Create a real signature using ethers.js
      const wallet = ethers.Wallet.createRandom();
      
      // Create order with user-provided hashlock
      const order = {
        maker: wallet.address,
        makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
        takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
        makerTraits: ethers.keccak256(ethers.randomBytes(32)), // User-generated hashlock
        makingAmount: '1000000000000000000',
        takingAmount: '2000000000000000000',
        salt: generateSalt(),
        receiver: '0x0000000000000000000000000000000000000000'
      };

      // Create the typed data for signing
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
      const signature = await wallet.signTypedData(domain, types, order);

      const signedOrder = {
        order: order,
        signature: signature
      };

      const response = await request(app)
        .post('/api/orders')
        .send({ signedOrder })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orderHash).toBeDefined();
      expect(response.body.data.status).toBe('active');
    });

    it('should reject duplicate order hash', async () => {
      const wallet = ethers.Wallet.createRandom();
      
      const order = {
        maker: wallet.address,
        makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
        takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
        makerTraits: ethers.keccak256(ethers.randomBytes(32)),
        makingAmount: '1000000000000000000',
        takingAmount: '2000000000000000000',
        salt: generateSalt(),
        receiver: '0x0000000000000000000000000000000000000000'
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

      const signature = await wallet.signTypedData(domain, types, order);

      const signedOrder = {
        order: order,
        signature: signature
      };

      // First request should succeed
      await request(app)
        .post('/api/orders')
        .send({ signedOrder })
        .expect(201);

      // Second request with same order should fail
      const response = await request(app)
        .post('/api/orders')
        .send({ signedOrder })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ORDER_ALREADY_EXISTS');
    });

    it('should reject invalid signature', async () => {
      const wallet = ethers.Wallet.createRandom();
      
      const order = {
        maker: wallet.address,
        makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
        takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
        makerTraits: ethers.keccak256(ethers.randomBytes(32)),
        makingAmount: '1000000000000000000',
        takingAmount: '2000000000000000000',
        salt: generateSalt(),
        receiver: '0x0000000000000000000000000000000000000000'
      };

      const signedOrder = {
        order: order,
        signature: '0x' + '1'.repeat(130) // Invalid signature
      };

      const response = await request(app)
        .post('/api/orders')
        .send({ signedOrder })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('should reject invalid order data', async () => {
      const order = {
        maker: '0xinvalid', // Invalid address
        makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
        takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
        makerTraits: ethers.keccak256(ethers.randomBytes(32)),
        makingAmount: '1000000000000000000',
        takingAmount: '2000000000000000000',
        salt: generateSalt(),
        receiver: '0x0000000000000000000000000000000000000000'
      };

      const signedOrder = {
        order: order,
        signature: '0x' + '1'.repeat(130) // Dummy signature
      };

      const response = await request(app)
        .post('/api/orders')
        .send({ signedOrder })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });
  });

  describe('GET /api/orders - E2E', () => {
    beforeEach(async () => {
      // Create some test orders first
      const wallet1 = ethers.Wallet.createRandom();
      const wallet2 = ethers.Wallet.createRandom();
      
      const order1 = {
        maker: wallet1.address,
        makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
        takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
        makerTraits: ethers.keccak256(ethers.randomBytes(32)),
        makingAmount: '1000000000000000000',
        takingAmount: '2000000000000000000',
        salt: generateSalt(),
        receiver: '0x0000000000000000000000000000000000000000'
      };

      const order2 = {
        maker: wallet2.address,
        makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
        takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
        makerTraits: ethers.keccak256(ethers.randomBytes(32)),
        makingAmount: '2000000000000000000',
        takingAmount: '4000000000000000000',
        salt: generateSalt(),
        receiver: '0x0000000000000000000000000000000000000000'
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

      const signature1 = await wallet1.signTypedData(domain, types, order1);
      const signature2 = await wallet2.signTypedData(domain, types, order2);

      await request(app)
        .post('/api/orders')
        .send({ signedOrder: { order: order1, signature: signature1 } })
        .expect(201);

      await request(app)
        .post('/api/orders')
        .send({ signedOrder: { order: order2, signature: signature2 } })
        .expect(201);
    });

    it('should query all orders without filters', async () => {
      const response = await request(app)
        .get('/api/orders')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeDefined();
      expect(response.body.data.total).toBeGreaterThan(0);
    });

    it('should query orders with status filter', async () => {
      const response = await request(app)
        .get('/api/orders?status=active')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeDefined();
      expect(response.body.data.total).toBeGreaterThan(0);
    });

    it('should query orders with maker filter', async () => {
      const wallet = ethers.Wallet.createRandom();
      
      const response = await request(app)
        .get(`/api/orders?maker=${wallet.address}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeDefined();
    });

    it('should query orders with makerAsset filter', async () => {
      const response = await request(app)
        .get('/api/orders?makerAsset=0x10563e509b718a279de002dfc3e94a8a8f642b03')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeDefined();
      expect(response.body.data.total).toBeGreaterThan(0);
    });

    it('should query orders with takerAsset filter', async () => {
      const response = await request(app)
        .get('/api/orders?takerAsset=0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeDefined();
      expect(response.body.data.total).toBeGreaterThan(0);
    });

    it('should query orders with pagination', async () => {
      const response = await request(app)
        .get('/api/orders?limit=2&offset=0')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeDefined();
      expect(response.body.data.limit).toBe(2);
      expect(response.body.data.offset).toBe(0);
    });

    it('should query orders with multiple filters', async () => {
      const response = await request(app)
        .get('/api/orders?makerAsset=0x10563e509b718a279de002dfc3e94a8a8f642b03&status=active&takerAsset=0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeDefined();
    });

    it('should handle invalid filter parameters', async () => {
      const response = await request(app)
        .get('/api/orders?status=invalid_status')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });
  });

  describe('PATCH /api/orders/:orderHash/status - E2E', () => {
    let orderHash: string;

    beforeEach(async () => {
      // Create a test order
      const wallet = ethers.Wallet.createRandom();
      
      const order = {
        maker: wallet.address,
        makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
        takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
        makerTraits: ethers.keccak256(ethers.randomBytes(32)),
        makingAmount: '1000000000000000000',
        takingAmount: '2000000000000000000',
        salt: generateSalt(),
        receiver: '0x0000000000000000000000000000000000000000'
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

      const signature = await wallet.signTypedData(domain, types, order);

      const response = await request(app)
        .post('/api/orders')
        .send({ signedOrder: { order: order, signature: signature } })
        .expect(201);

      orderHash = response.body.data.orderHash;
    });

    it('should update order status from active to completed', async () => {
      const response = await request(app)
        .patch(`/api/orders/${orderHash}/status`)
        .send({
          status: 'completed',
          reason: 'Order fulfilled'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('completed');
    });

    it('should reject invalid status transition', async () => {
      // First update to completed
      await request(app)
        .patch(`/api/orders/${orderHash}/status`)
        .send({
          status: 'completed',
          reason: 'Order fulfilled'
        })
        .expect(200);

      // Then try to go back to active (should fail)
      const response = await request(app)
        .patch(`/api/orders/${orderHash}/status`)
        .send({
          status: 'active',
          reason: 'Invalid transition'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });

    it('should reject invalid order hash', async () => {
      const response = await request(app)
        .patch('/api/orders/invalid_hash/status')
        .send({
          status: 'active'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });

    it('should reject non-existent order', async () => {
      const response = await request(app)
        .patch('/api/orders/0x1111111111111111111111111111111111111111111111111111111111111111/status')
        .send({
          status: 'cancelled'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ORDER_NOT_FOUND');
    });

    it('should reject invalid status update data', async () => {
      const response = await request(app)
        .patch(`/api/orders/${orderHash}/status`)
        .send({
          status: 'invalid_status'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });

    it('should update status without reason', async () => {
      const response = await request(app)
        .patch(`/api/orders/${orderHash}/status`)
        .send({
          status: 'cancelled'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
    });
  });

  describe('Database Verification', () => {
    it('should verify order was actually stored in database', async () => {
      const wallet = ethers.Wallet.createRandom();
      
      const order = {
        maker: wallet.address,
        makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
        takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
        makerTraits: ethers.keccak256(ethers.randomBytes(32)),
        makingAmount: '1000000000000000000',
        takingAmount: '2000000000000000000',
        salt: generateSalt(),
        receiver: '0x0000000000000000000000000000000000000000'
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

      const signature = await wallet.signTypedData(domain, types, order);

      const response = await request(app)
        .post('/api/orders')
        .send({ signedOrder: { order: order, signature: signature } })
        .expect(201);

      const orderHash = response.body.data.orderHash;

      // Verify the order exists in the database
      const dbOrder = await db('orders')
        .where({ order_hash: orderHash })
        .first();

      expect(dbOrder).toBeDefined();
      expect(dbOrder.maker).toBe(order.maker);
      expect(dbOrder.maker_token).toBe(order.makerAsset);
      expect(dbOrder.taker_token).toBe(order.takerAsset);
      expect(dbOrder.maker_amount).toBe(order.makingAmount);
      expect(dbOrder.taker_amount).toBe(order.takingAmount);
      expect(dbOrder.hashlock).toBe(order.makerTraits);
      expect(dbOrder.status).toBe('active');
    });
  });
}); 