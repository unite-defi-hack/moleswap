import { db } from './connection';
import { Order, OrderStatus, OrderWithMetadata, OrderQueryFilters, OrderQueryResponse } from '../types/orders';
import { logger } from '../utils/logger';

export interface InsertOrderParams {
  order: Order;
  orderHash: string;
  status: OrderStatus;
  secret?: string;
  hashlock: string;
  orderData: any;
  signedData: any;
}

export interface SecretRequestParams {
  orderHash: string;
  requester: string;
  validationProof?: any;
}

export async function insertOrder(params: InsertOrderParams): Promise<OrderWithMetadata> {
  const now = new Date();
  await db('orders').insert({
    order_hash: params.orderHash,
    maker: params.order.maker,
    taker: '', // Taker is not known at creation
    maker_token: params.order.makerAsset,
    taker_token: params.order.takerAsset,
    maker_amount: params.order.makingAmount,
    taker_amount: params.order.takingAmount,
    source_chain: '', // Not known at creation
    destination_chain: '', // Not known at creation
    source_escrow: '', // Not known at creation
    destination_escrow: '', // Not known at creation
    hashlock: params.hashlock,
    secret: params.secret || null,
    status: params.status,
    order_data: JSON.stringify(params.orderData),
    signed_data: JSON.stringify(params.signedData),
    created_at: now,
    updated_at: now,
  });
  return {
    order: params.order,
    orderHash: params.orderHash,
    status: params.status,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getOrderByHash(orderHash: string) {
  return db('orders').where({ order_hash: orderHash }).first();
}

export async function queryOrders(filters: OrderQueryFilters): Promise<OrderQueryResponse> {
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  
  // Build query with filters
  let query = db('orders').select('*');
  
  // Apply filters
  if (filters.status) {
    query = query.where({ status: filters.status });
  }
  
  if (filters.maker) {
    query = query.where({ maker: filters.maker });
  }
  
  if (filters.makerAsset) {
    query = query.where({ maker_token: filters.makerAsset });
  }
  
  if (filters.takerAsset) {
    query = query.where({ taker_token: filters.takerAsset });
  }
  
  // Get total count for pagination
  const countQuery = query.clone();
  const totalResult = await countQuery.count('* as total').first();
  const total = totalResult ? Number(totalResult['total']) : 0;
  
  // Apply pagination and ordering
  const orders = await query
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);
  
  // Transform database records to OrderWithMetadata format
  const transformedOrders: OrderWithMetadata[] = orders.map(order => {
    const orderData = JSON.parse(order.order_data);
    return {
      order: {
        maker: order.maker,
        makerAsset: order.maker_token,
        takerAsset: order.taker_token,
        makerTraits: order.hashlock,
        salt: orderData.salt || '',
        makingAmount: order.maker_amount,
        takingAmount: order.taker_amount,
        receiver: orderData.receiver || '0x0000000000000000000000000000000000000000'
      },
      orderHash: order.order_hash,
      status: order.status as OrderStatus,
      createdAt: new Date(order.created_at),
      updatedAt: new Date(order.updated_at)
    };
  });
  
  return {
    orders: transformedOrders,
    total,
    limit,
    offset,
    hasMore: offset + limit < total
  };
}

export async function updateOrderStatus(orderHash: string, newStatus: OrderStatus, _reason?: string): Promise<OrderWithMetadata | null> {
  // Get current order
  const currentOrder = await getOrderByHash(orderHash);
  if (!currentOrder) {
    return null;
  }
  
  // Validate status transition
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.ACTIVE, OrderStatus.CANCELLED],
    [OrderStatus.ACTIVE]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
    [OrderStatus.COMPLETED]: [], // No further transitions
    [OrderStatus.CANCELLED]: [] // No further transitions
  };
  
  const currentStatus = currentOrder.status as OrderStatus;
  const allowedTransitions = validTransitions[currentStatus];
  
  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
  }
  
  // Update order status
  const now = new Date();
  await db('orders')
    .where({ order_hash: orderHash })
    .update({
      status: newStatus,
      updated_at: now
    });
  
  // Get updated order
  const updatedOrder = await getOrderByHash(orderHash);
  if (!updatedOrder) {
    throw new Error('Failed to retrieve updated order');
  }
  
  // Transform to OrderWithMetadata format
  const orderData = JSON.parse(updatedOrder.order_data);
  return {
    order: {
      maker: updatedOrder.maker,
      makerAsset: updatedOrder.maker_token,
      takerAsset: updatedOrder.taker_token,
      makerTraits: updatedOrder.hashlock,
      salt: orderData.salt || '',
      makingAmount: updatedOrder.maker_amount,
      takingAmount: updatedOrder.taker_amount,
      receiver: orderData.receiver || '0x0000000000000000000000000000000000000000'
    },
    orderHash: updatedOrder.order_hash,
    status: updatedOrder.status as OrderStatus,
    createdAt: new Date(updatedOrder.created_at),
    updatedAt: new Date(updatedOrder.updated_at)
  };
}

/**
 * Store secret for an order
 * @param orderHash - The order hash
 * @param secret - The encrypted secret to store
 * @returns Success status
 */
export async function storeOrderSecret(orderHash: string, secret: string): Promise<boolean> {
  try {
    const result = await db('orders')
      .where({ order_hash: orderHash })
      .update({
        secret,
        updated_at: new Date()
      });
    
    return result > 0;
  } catch (error) {
    logger.error('Error storing order secret:', error);
    return false;
  }
}

/**
 * Retrieve secret for an order
 * @param orderHash - The order hash
 * @returns The encrypted secret or null if not found
 */
export async function getOrderSecret(orderHash: string): Promise<string | null> {
  try {
    const order = await db('orders')
      .select('secret')
      .where({ order_hash: orderHash })
      .first();
    
    return order?.secret || null;
  } catch (error) {
    logger.error('Error retrieving order secret:', error);
    return null;
  }
}

/**
 * Validate that an order exists and is in a valid state for secret sharing
 * @param orderHash - The order hash
 * @returns Validation result
 */
export async function validateOrderForSecretSharing(orderHash: string): Promise<{
  valid: boolean;
  order?: any;
  error?: string;
}> {
  try {
    const order = await getOrderByHash(orderHash);
    
    if (!order) {
      return {
        valid: false,
        error: 'Order not found'
      };
    }
    
    // Check if order is in a valid state for secret sharing
    if (order.status !== 'active' && order.status !== 'completed') {
      return {
        valid: false,
        error: `Order is in invalid state for secret sharing: ${order.status}`
      };
    }
    
    // Check if secret has already been shared (not just if it exists)
    // For now, we'll allow sharing if the order is in active state, regardless of secret existence
    // In a real implementation, you might want to track if the secret was actually shared
    if (order.status === 'completed') {
      return {
        valid: false,
        error: 'Order has already been completed'
      };
    }
    
    return {
      valid: true,
      order
    };
  } catch (error) {
    return {
      valid: false,
      error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
} 