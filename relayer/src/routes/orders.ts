import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { 
  validateOrderData, 
  validateSignedOrder, 
  validateOrderQuery,
  validateOrderStatusUpdate,
  validateOrderHash,
  OrderErrorCode,
  ApiResponse,
  OrderDataResponse,
  OrderCreationResponse,
  OrderQueryResponse,
  OrderWithMetadata,
  OrderStatus
} from '../types';
import { generateOrderHash, verifyOrderSignature, generateRandomSalt } from '../utils/orderHashing';
import { generateSecretWithHashlock, getEncryptionKey } from '../utils/secretGeneration';
import { insertOrder, getOrderByHash, queryOrders, updateOrderStatus } from '../database/orderService';

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
      srcAssetAddress: order.srcAssetAddress,
      dstAssetAddress: order.dstAssetAddress,
      srcAmount: order.srcAmount,
      dstAmount: order.dstAmount,
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
      logger.error('Order validation failed', { 
        errors: validation.errors,
        body: req.body 
      });
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
    // Check for duplicate order
    const existing = await getOrderByHash(orderHash);
    if (existing) {
      logger.warn('Order already exists', { orderHash });
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.ORDER_ALREADY_EXISTS,
          message: 'Order with this hash already exists',
          details: {
            orderHash,
            existingStatus: existing.status
          }
        }
      };
      return res.status(409).json(response);
    }
    // Insert order (secret will be generated when requested)
    const orderWithMeta = await insertOrder({
      order: signedOrder.order,
      orderHash,
      status: OrderStatus.ACTIVE,
      hashlock: signedOrder.order.makerTraits,
      orderData: signedOrder.order,
      signedData: signedOrder,
    });
    logger.info('Order inserted successfully', { orderHash, maker: signedOrder.order.maker });
    const response: ApiResponse<OrderCreationResponse> = {
      success: true,
      data: {
        orderHash,
        status: orderWithMeta.status,
        createdAt: orderWithMeta.createdAt
      }
    };
    return res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating order:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: OrderErrorCode.INVALID_ORDER,
        message: 'Failed to create order',
        details: error instanceof Error ? error.message : error
      }
    });
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
    
    // Query orders from database using filters
    const result = await queryOrders(filters);
    
    const response: ApiResponse<OrderQueryResponse> = {
      success: true,
      data: result
    };
    
    logger.info('Orders queried successfully', { 
      filters,
      total: result.total,
      returned: result.orders.length,
      hasMore: result.hasMore
    });
    return res.json(response);
    
  } catch (error) {
    logger.error('Error querying orders:', error);
    throw createError('Failed to query orders', 500);
  }
});

// PATCH /api/orders/:orderHash/status - Update order status
router.patch('/:orderHash/status', async (req: Request, res: Response) => {
  try {
    const orderHash = req.params['orderHash'];
    if (!orderHash) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_ORDER,
          message: 'Order hash is required',
          details: {}
        }
      };
      return res.status(400).json(response);
    }
    
    logger.info('Updating order status', { 
      orderHash, 
      body: req.body 
    });
    
    // Validate order hash parameter
    const hashValidation = validateOrderHash(orderHash);
    if (!hashValidation.valid) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_ORDER,
          message: 'Invalid order hash',
          details: {
            errors: hashValidation.errors
          }
        }
      };
      return res.status(400).json(response);
    }
    
    // Validate request body
    const validation = validateOrderStatusUpdate(req.body);
    if (!validation.valid) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_ORDER,
          message: 'Invalid status update data',
          details: {
            errors: validation.errors
          }
        }
      };
      return res.status(400).json(response);
    }
    
    const { status, reason } = validation.value!;
    
    // Update order status
    const updatedOrder = await updateOrderStatus(orderHash, status, reason);
    
    if (!updatedOrder) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.ORDER_NOT_FOUND,
          message: 'Order not found',
          details: {
            orderHash
          }
        }
      };
      return res.status(404).json(response);
    }
    
    const response: ApiResponse<OrderWithMetadata> = {
      success: true,
      data: updatedOrder
    };
    
    logger.info('Order status updated successfully', { 
      orderHash,
      oldStatus: 'unknown', // We could track this if needed
      newStatus: status,
      reason
    });
    return res.json(response);
    
  } catch (error) {
    logger.error('Error updating order status:', error);
    
    // Handle specific error for invalid status transition
    if (error instanceof Error && error.message.includes('Invalid status transition')) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_ORDER,
          message: error.message,
          details: {
            orderHash: req.params['orderHash']
          }
        }
      };
      return res.status(400).json(response);
    }
    
    throw createError('Failed to update order status', 500);
  }
});

export { router as orderRoutes }; 