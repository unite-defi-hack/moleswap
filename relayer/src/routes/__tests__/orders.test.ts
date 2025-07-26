import request from 'supertest';
import express from 'express';
import { orderRoutes } from '../orders';

const app = express();
app.use(express.json());
app.use('/api/orders', orderRoutes);

describe('Orders API', () => {
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
}); 