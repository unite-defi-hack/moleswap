import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { 
  validateOrderData, 
  validateSignedOrder, 
  validateOrderQuery,
  OrderErrorCode,
  ApiResponse,
  OrderDataResponse,
  OrderCreationResponse,
  OrderQueryResponse,
  OrderStatus
} from '../types';
import { generateOrderHash, verifyOrderSignature, generateRandomSalt } from '../utils/orderHashing';
import { generateSecretWithHashlock, getEncryptionKey } from '../utils/secretGeneration';

const router = Router();

// POST /api/orders/data - Generate order data with hashlock
router.post('/data', async (req: Request, res: Response) => {
  try {
    logger.info('Generating order data with hashlock', { body: req.body });
    
    // Validate request data
    const validation = validateOrderData(req.body);
    if (!validation.valid) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_ORDER,
          message: 'Invalid order data',
          details: {
            errors: validation.errors
          }
        }
      };
      return res.status(400).json(response);
    }
    
    // Generate secret and hashlock
    const encryptionKey = getEncryptionKey();
    const { hashlock } = generateSecretWithHashlock(encryptionKey);
    const salt = generateRandomSalt();
    
    // Create order with hashlock
    const order = {
      ...validation.value!.order,
      makerTraits: hashlock,
      salt,
      receiver: validation.value!.order.receiver || '0x0000000000000000000000000000000000000000'
    };
    
    // Generate order hash
    const { orderHash } = generateOrderHash(order);
    
    const response: ApiResponse<OrderDataResponse> = {
      success: true,
      data: {
        orderToSign: order,
        orderHash
      }
    };
    
    logger.info('Order data generated successfully', { 
      orderHash,
      maker: order.maker,
      makerAsset: order.makerAsset,
      takerAsset: order.takerAsset,
      makingAmount: order.makingAmount,
      takingAmount: order.takingAmount,
      hashlock: hashlock.slice(0, 10) + '...', // Log partial hashlock for security
      salt: salt.slice(0, 10) + '...' // Log partial salt for security
    });
    return res.json(response);
    
  } catch (error) {
    logger.error('Error generating order data:', error);
    throw createError('Failed to generate order data', 500);
  }
});

// POST /api/orders - Create order with signed data
router.post('/', async (req: Request, res: Response) => {
  try {
    logger.info('Creating new order', { body: req.body });
    
    // Validate request data
    const validation = validateSignedOrder(req.body);
    if (!validation.valid) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_ORDER,
          message: 'Invalid signed order data',
          details: {
            errors: validation.errors
          }
        }
      };
      return res.status(400).json(response);
    }
    
    const { signedOrder } = validation.value!;
    
    // Verify signature
    const signatureVerification = verifyOrderSignature(
      signedOrder.order,
      signedOrder.signature,
      signedOrder.order.maker
    );
    
    if (!signatureVerification.valid) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_SIGNATURE,
          message: signatureVerification.error || 'Signature verification failed',
          details: {
            signer: signatureVerification.signer,
            expectedSigner: signedOrder.order.maker
          }
        }
      };
      return res.status(400).json(response);
    }
    
    // Generate order hash
    const { orderHash } = generateOrderHash(signedOrder.order);
    
    // TODO: Store order in database
    // For now, just return success response
    
    const response: ApiResponse<OrderCreationResponse> = {
      success: true,
      data: {
        orderHash,
        status: OrderStatus.ACTIVE,
        createdAt: new Date()
      }
    };
    
    logger.info('Order created successfully', { orderHash, maker: signedOrder.order.maker });
    return res.status(201).json(response);
    
  } catch (error) {
    logger.error('Error creating order:', error);
    throw createError('Failed to create order', 500);
  }
});

// GET /api/orders - Query orders with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    logger.info('Querying orders with filters', { query: req.query });
    
    // Validate query parameters
    const validation = validateOrderQuery(req.query);
    if (!validation.valid) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_ORDER,
          message: 'Invalid query parameters',
          details: {
            errors: validation.errors
          }
        }
      };
      return res.status(400).json(response);
    }
    
    const filters = validation.value!;
    
    // TODO: Query orders from database using filters
    // For now, return empty result
    const response: ApiResponse<OrderQueryResponse> = {
      success: true,
      data: {
        orders: [],
        total: 0,
        limit: filters.limit || 50,
        offset: filters.offset || 0,
        hasMore: false
      }
    };
    
    logger.info('Orders queried successfully', { filters });
    return res.json(response);
    
  } catch (error) {
    logger.error('Error querying orders:', error);
    throw createError('Failed to query orders', 500);
  }
});

export { router as orderRoutes }; 