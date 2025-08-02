import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { 
  ApiResponse, 
  OrderCreationResponse, 
  OrderErrorCode,
  OrderWithMetadataResponse,
  OrderStatus,
  OrderQueryResponse
} from '../types/orders';
import { 
  insertOrder, 
  getOrderByHash, 
  queryOrders, 
  updateOrderStatus 
} from '../database/orderService';
import { 
  validateSignedOrder, 
  validateCompleteOrder,
  validateOrderQuery 
} from '../types/validation';
import { 
  generateOrderHash, 
  verifyOrderSignature 
} from '../utils/orderHashing';
import { verifySecretHashlock } from '../utils/secretGeneration';


const router = Router();

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
            error: signatureVerification.error
          }
        }
      };
      return res.status(400).json(response);
    }

    // Generate order hash
    const { orderHash } = generateOrderHash(signedOrder.order);
    
    // Check for duplicate orders
    const existing = await getOrderByHash(orderHash);
    if (existing) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.ORDER_ALREADY_EXISTS,
          message: 'Order already exists',
          details: { orderHash }
        }
      };
      return res.status(409).json(response);
    }

    // Insert order into database
    const orderWithMeta = await insertOrder({
      order: signedOrder.order,
      orderHash,
      status: OrderStatus.ACTIVE,
      hashlock: signedOrder.order.makerTraits,
      orderData: signedOrder.order,
      signedData: {
        order: signedOrder.order,
        signature: signedOrder.signature
      },
    });

    const response: ApiResponse<OrderCreationResponse> = {
      success: true,
      data: {
        orderHash: orderWithMeta.orderHash,
        status: orderWithMeta.status,
        createdAt: orderWithMeta.createdAt
      }
    };

    logger.info('Order inserted successfully', { 
      maker: signedOrder.order.maker,
      orderHash: orderWithMeta.orderHash
    });
    return res.status(201).json(response);

  } catch (error) {
    logger.error('Error creating order:', error);
    throw createError('Failed to create order', 500);
  }
});

// POST /api/orders/complete - Create order with complete data (extension, secret, secretHash)
router.post('/complete', async (req: Request, res: Response) => {
  try {
    logger.info('Creating new complete order', { body: req.body });
    const validation = validateCompleteOrder(req.body);
    if (!validation.valid) {
      logger.error('Complete order validation failed', { 
        errors: validation.errors,
        body: req.body 
      });
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_ORDER,
          message: 'Invalid complete order data',
          details: {
            errors: validation.errors
          }
        }
      };
      return res.status(400).json(response);
    }

    const { completeOrder } = validation.value!;

    const signatureVerification = verifyOrderSignature(
      completeOrder.order,
      completeOrder.signature,
      completeOrder.order.maker
    );
    if (!signatureVerification.valid) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_SIGNATURE,
          message: signatureVerification.error || 'Signature verification failed',
          details: {
            error: signatureVerification.error
          }
        }
      };
      return res.status(400).json(response);
    }

    const { orderHash } = generateOrderHash(completeOrder.order);
    const existing = await getOrderByHash(orderHash);
    if (existing) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.ORDER_ALREADY_EXISTS,
          message: 'Order already exists',
          details: { orderHash }
        }
      };
      return res.status(409).json(response);
    }

    // Validate that secret corresponds to secretHash
    const secretValidation = verifySecretHashlock(completeOrder.secret, completeOrder.secretHash);
    if (!secretValidation.valid) {
      logger.error('Secret validation failed', { 
        error: secretValidation.error,
        orderHash 
      });
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_ORDER,
          message: 'Secret validation failed',
          details: {
            error: secretValidation.error
          }
        }
      };
      return res.status(400).json(response);
    }

    const orderWithMeta = await insertOrder({
      order: completeOrder.order,
      orderHash,
      status: OrderStatus.ACTIVE,
      hashlock: completeOrder.order.makerTraits,
      secret: completeOrder.secret,
      secretHash: completeOrder.secretHash,
      extension: completeOrder.extension,
      orderData: completeOrder.order,
      signedData: {
        order: completeOrder.order,
        signature: completeOrder.signature,
        extension: completeOrder.extension,
        secret: completeOrder.secret,
        secretHash: completeOrder.secretHash
      },
    });

    const response: ApiResponse<OrderCreationResponse> = {
      success: true,
      data: {
        orderHash: orderWithMeta.orderHash,
        status: orderWithMeta.status,
        createdAt: orderWithMeta.createdAt
      }
    };

    logger.info('Complete order inserted successfully', { 
      maker: completeOrder.order.maker,
      orderHash: orderWithMeta.orderHash
    });
    return res.status(201).json(response);

  } catch (error) {
    logger.error('Error creating complete order:', error);
    throw createError('Failed to create complete order', 500);
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
    if (!orderHash.startsWith('0x') || orderHash.length !== 66) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_ORDER,
          message: 'Invalid order hash format',
          details: {
            orderHash
          }
        }
      };
      return res.status(400).json(response);
    }
    
    // Validate request body
    // const validation = validateOrderStatusUpdate(req.body); // This line is removed as validateOrderStatusUpdate is no longer imported
    // if (!validation.valid) {
    //   const response: ApiResponse<null> = {
    //     success: false,
    //     error: {
    //       code: OrderErrorCode.INVALID_ORDER,
    //       message: 'Invalid status update data',
    //       details: {
    //         errors: validation.errors
    //       }
    //     }
    //   };
    //   return res.status(400).json(response);
    // }
    
    // const { status, reason } = validation.value!; // This line is removed as validateOrderStatusUpdate is no longer imported
    
    // Extract status from request body
    const { status, reason } = req.body;
    
    if (!status) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_ORDER,
          message: 'Status is required',
          details: {}
        }
      };
      return res.status(400).json(response);
    }
    
    // Validate status
    if (!Object.values(OrderStatus).includes(status)) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_ORDER,
          message: 'Invalid status',
          details: { status }
        }
      };
      return res.status(400).json(response);
    }
    
    // Update order status
    const updatedOrder = await updateOrderStatus(orderHash, status, reason || 'Status updated via API');
    
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
    
    const response: ApiResponse<OrderWithMetadataResponse> = {
      success: true,
      data: updatedOrder
    };
    
    logger.info('Order status updated successfully', { 
      orderHash,
      oldStatus: 'unknown', // We could track this if needed
      newStatus: updatedOrder.status, // Use updatedOrder.status
      reason: 'Status updated via API' // Placeholder for reason
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