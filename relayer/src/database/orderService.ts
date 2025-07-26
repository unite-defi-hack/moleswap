import { db } from './connection';
import { Order, OrderStatus, OrderWithMetadata } from '../types/orders';

export interface InsertOrderParams {
  order: Order;
  orderHash: string;
  status: OrderStatus;
  secret?: string;
  hashlock: string;
  orderData: any;
  signedData: any;
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