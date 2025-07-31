import request from 'supertest';
import { createApp } from '../../index';


let app: any;

beforeAll(async () => {
  const { app: createdApp } = createApp();
  app = createdApp;
});

// Mock the order hashing utilities
jest.mock('../../utils/orderHashing', () => ({
  generateOrderHash: jest.fn(),
  verifyOrderSignature: jest.fn(),
  generateRandomSalt: jest.fn()
}));

// Mock the secret generation utilities
jest.mock('../../utils/secretGeneration', () => ({
  generateSecretWithHashlock: jest.fn(),
  getEncryptionKey: jest.fn()
}));

// Mock the database service
jest.mock('../../database/orderService', () => ({
  insertOrder: jest.fn(),
  getOrderByHash: jest.fn(),
  queryOrders: jest.fn(),
  updateOrderStatus: jest.fn()
}));

describe('Orders API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/orders', () => {
    const validOrder = {
      maker: '0xbd82E9C3D37B9c6F56Ca91B3f645D6B2c0165298',
      makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
      takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
      makerTraits: '0xeb6ee62b6c1f29db12fbaeb0143bd41579bc5df5338112bf05002f96dc035318',
      makingAmount: '1000000000000000000',
      takingAmount: '2000000000000000000',
      salt: '84992651106417184392985761085501441700963726352652015620030825343279768315625',
      receiver: '0x0000000000000000000000000000000000000000'
    };

    const validSignature = '0x96f2f054b555e1a6959bf0a22eb5adc74b8af78e9c7645db30e20c7fabeaf5381675e6dfc8ef612ec9f27f48750f451f82e6ccd452d5722cfdb925b737a1b92c1c';

    beforeEach(() => {
      const { generateOrderHash, verifyOrderSignature } = require('../../utils/orderHashing');
      const { insertOrder, getOrderByHash } = require('../../database/orderService');
      
      generateOrderHash.mockReturnValue({ 
        orderHash: '0xdda6e111169ef3e9ac17cf1e744aad5d5138c8c21c436bdf09faf8aef77d5a00' 
      });
      verifyOrderSignature.mockReturnValue({ valid: true });
      getOrderByHash.mockReturnValue(null); // No existing order
      insertOrder.mockResolvedValue({
        order: validOrder,
        orderHash: '0xdda6e111169ef3e9ac17cf1e744aad5d5138c8c21c436bdf09faf8aef77d5a00',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    it('should create a new order with valid signed data', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          signedOrder: {
            order: validOrder,
            signature: validSignature
          }
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orderHash).toBe('0xdda6e111169ef3e9ac17cf1e744aad5d5138c8c21c436bdf09faf8aef77d5a00');
      expect(response.body.data.status).toBe('active');
    });

    it('should reject order with invalid signature', async () => {
      const { verifyOrderSignature } = require('../../utils/orderHashing');
      verifyOrderSignature.mockReturnValue({ 
        valid: false, 
        error: 'Invalid signature' 
      });

      const response = await request(app)
        .post('/api/orders')
        .send({
          signedOrder: {
            order: validOrder,
            signature: '0x96f2f054b555e1a6959bf0a22eb5adc74b8af78e9c7645db30e20c7fabeaf5381675e6dfc8ef612ec9f27f48750f451f82e6ccd452d5722cfdb925b737a1b92c2c'
          }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('should reject duplicate order', async () => {
      const { getOrderByHash } = require('../../database/orderService');
      getOrderByHash.mockReturnValue({
        order_hash: '0xdda6e111169ef3e9ac17cf1e744aad5d5138c8c21c436bdf09faf8aef77d5a00',
        status: 'active'
      });

      const response = await request(app)
        .post('/api/orders')
        .send({
          signedOrder: {
            order: validOrder,
            signature: validSignature
          }
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ORDER_ALREADY_EXISTS');
    });

    it('should reject invalid order data', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          signedOrder: {
            order: {
              ...validOrder,
              maker: '0xinvalid'
            },
            signature: validSignature
          }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });
  });

  describe('POST /api/orders/complete', () => {
    const validOrder = {
      maker: '0x71078879cd9a1d7987b74cee6b6c0d130f1a0115',
      makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
      takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
      makerTraits: '0x00bd363c7762ace561ec85a122307bff99ee8832363f26c64e9a1545b1b45350',
      makingAmount: '1000000000000000000',
      takingAmount: '2000000000000000000',
      salt: '8055219788148251265908589343240715975237002832007417457800707733977',
      receiver: '0x0000000000000000000000000000000000000000'
    };

    const validSignature = '0xd2a930eafc1768097d2f49f70a87f4bae6ea93cd5ca8671ab40931529bcf022b27158a5bc7407796c8f0109a22b92e9079e3dc31f626c5430056031d38fafba61c';
    const validExtension = '0x0000010f0000004a0000004a0000004a0000004a000000250000000000000000b7dcd034d89bef6429ec80eaf77f8ffb73e5b40b00000000000000688a9ff4000384000000b7dcd034d89bef6429ec80eaf77f8ffb73e5b40b00000000000000688a9ff4000384000000b7dcd034d89bef6429ec80eaf77f8ffb73e5b40b688aa0008863b00397a9e212049500000800bd363c7762ace561ec85a122307bff99ee8832363f26c64e9a1545b1b453500000000000000000000000000000000000000000000000000000000000014a3400000000000000000000000010563e509b718a279de002dfc3e94a8a8f642b030000000000000000000000e8d4a510000000000000000000000000e8d4a5100000000000000000b4000000780000000a00005dc00000465000002ee00000000a';
    const validSecret = '0x63b5eefdca0982721a0a673399bef816ee7522a9e77483d14466a666e859f3aa';
    const validSecretHash = '0x00bd363c7762ace561ec85a122307bff99ee8832363f26c64e9a1545b1b45350';

    const completeOrder = {
      order: validOrder,
      extension: validExtension,
      signature: validSignature,
      secret: validSecret,
      secretHash: validSecretHash
    };

    beforeEach(() => {
      const { generateOrderHash, verifyOrderSignature } = require('../../utils/orderHashing');
      const { insertOrder, getOrderByHash } = require('../../database/orderService');
      
      generateOrderHash.mockReturnValue({ 
        orderHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' 
      });
      verifyOrderSignature.mockReturnValue({ valid: true });
      getOrderByHash.mockReturnValue(null); // No existing order
      insertOrder.mockResolvedValue({
        order: validOrder,
        orderHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        secret: validSecret,
        secretHash: validSecretHash,
        extension: validExtension,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    it('should create a new complete order with valid data', async () => {
      const response = await request(app)
        .post('/api/orders/complete')
        .send({ completeOrder })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orderHash).toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      expect(response.body.data.status).toBe('active');
    });

    it('should reject when secretHash does not match makerTraits', async () => {
      const invalidCompleteOrder = {
        ...completeOrder,
        secretHash: '0x1111111111111111111111111111111111111111111111111111111111111111'
      };

      const response = await request(app)
        .post('/api/orders/complete')
        .send({ completeOrder: invalidCompleteOrder })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.errors).toContain('Secret hash must match the makerTraits (hashlock)');
    });

    it('should reject when secret is not a valid 32-byte hex string', async () => {
      const invalidCompleteOrder = {
        ...completeOrder,
        secret: '0xinvalid'
      };

      const response = await request(app)
        .post('/api/orders/complete')
        .send({ completeOrder: invalidCompleteOrder })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });

    it('should reject when secretHash is not a valid 32-byte hex string', async () => {
      const invalidCompleteOrder = {
        ...completeOrder,
        secretHash: '0xinvalid'
      };

      const response = await request(app)
        .post('/api/orders/complete')
        .send({ completeOrder: invalidCompleteOrder })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });

    it('should reject when extension is missing', async () => {
      const invalidCompleteOrder = {
        ...completeOrder,
        extension: undefined
      };

      const response = await request(app)
        .post('/api/orders/complete')
        .send({ completeOrder: invalidCompleteOrder })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });

    it('should reject when secret is missing', async () => {
      const invalidCompleteOrder = {
        ...completeOrder,
        secret: undefined
      };

      const response = await request(app)
        .post('/api/orders/complete')
        .send({ completeOrder: invalidCompleteOrder })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });

    it('should reject when secretHash is missing', async () => {
      const invalidCompleteOrder = {
        ...completeOrder,
        secretHash: undefined
      };

      const response = await request(app)
        .post('/api/orders/complete')
        .send({ completeOrder: invalidCompleteOrder })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });

    it('should reject duplicate complete order', async () => {
      const { getOrderByHash } = require('../../database/orderService');
      getOrderByHash.mockReturnValue({
        order_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        status: 'active'
      });

      const response = await request(app)
        .post('/api/orders/complete')
        .send({ completeOrder })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ORDER_ALREADY_EXISTS');
    });

    it('should reject invalid signature', async () => {
      const { verifyOrderSignature } = require('../../utils/orderHashing');
      verifyOrderSignature.mockReturnValue({ 
        valid: false, 
        error: 'Invalid signature' 
      });

      const response = await request(app)
        .post('/api/orders/complete')
        .send({ completeOrder })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SIGNATURE');
    });
  });

  describe('GET /api/orders', () => {
    beforeEach(() => {
      const { queryOrders } = require('../../database/orderService');
      queryOrders.mockResolvedValue({
        orders: [
          {
            order: {
              maker: '0x1234567890123456789012345678901234567890',
              makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
              takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
              makerTraits: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
              makingAmount: '1000000000000000000',
              takingAmount: '2000000000000000000',
              salt: '1234567890123456789012345678901234567890',
              receiver: '0x0000000000000000000000000000000000000000'
            },
            orderHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false
      });
    });

    it('should return orders with default filters', async () => {
      const response = await request(app)
        .get('/api/orders')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toHaveLength(1);
      expect(response.body.data.total).toBe(1);
    });

    it('should return orders with status filter', async () => {
      const response = await request(app)
        .get('/api/orders?status=active')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toHaveLength(1);
    });

    it('should return orders with maker filter', async () => {
      const response = await request(app)
        .get('/api/orders?maker=0x1234567890123456789012345678901234567890')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toHaveLength(1);
    });

    it('should return orders with maker asset filter', async () => {
      const response = await request(app)
        .get('/api/orders?makerAsset=0x10563e509b718a279de002dfc3e94a8a8f642b03')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toHaveLength(1);
    });

    it('should return orders with taker asset filter', async () => {
      const response = await request(app)
        .get('/api/orders?takerAsset=0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toHaveLength(1);
    });

    it('should return orders with limit and offset', async () => {
      const response = await request(app)
        .get('/api/orders?limit=2&offset=0')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.limit).toBe(50);
      expect(response.body.data.offset).toBe(0);
    });

    it('should return orders with multiple filters', async () => {
      const response = await request(app)
        .get('/api/orders?makerAsset=0x10563e509b718a279de002dfc3e94a8a8f642b03&status=active&takerAsset=0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toHaveLength(1);
    });

    it('should reject invalid status filter', async () => {
      const response = await request(app)
        .get('/api/orders?status=invalid_status')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });
  });

  describe('PATCH /api/orders/:orderHash/status', () => {
    const orderHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    beforeEach(() => {
      const { updateOrderStatus } = require('../../database/orderService');
      updateOrderStatus.mockResolvedValue({
        order: {
          maker: '0x1234567890123456789012345678901234567890',
          makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
          takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
          makerTraits: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          makingAmount: '1000000000000000000',
          takingAmount: '2000000000000000000',
          salt: '1234567890123456789012345678901234567890',
          receiver: '0x0000000000000000000000000000000000000000'
        },
        orderHash,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    it('should update order status successfully', async () => {
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
      const { updateOrderStatus } = require('../../database/orderService');
      updateOrderStatus.mockResolvedValue(null);

      const response = await request(app)
        .patch(`/api/orders/${orderHash}/status`)
        .send({
          status: 'cancelled'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ORDER_NOT_FOUND');
    });

    it('should reject invalid status transition', async () => {
      const { updateOrderStatus } = require('../../database/orderService');
      updateOrderStatus.mockRejectedValue(new Error('Invalid status transition from completed to active'));

      const response = await request(app)
        .patch(`/api/orders/${orderHash}/status`)
        .send({
          status: 'active'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ORDER');
    });
  });
}); 