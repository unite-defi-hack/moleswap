#!/usr/bin/env ts-node

import axios from 'axios';
import { logger } from '../src/utils/logger';

// Configuration
const RELAYER_URL = process.env['RELAYER_URL'] || 'http://localhost:3000';

// Hardcoded filter options for demonstration
const FILTER_OPTIONS = {
  // Status filters
  status: {
    active: 'active',
    completed: 'completed',
    cancelled: 'cancelled',
    expired: 'expired'
  },
  
  // Asset filters (example addresses)
  assets: {
    usdc: '0xA0b86a33E6441b8C4C8C0C4C8C0C4C8C0C4C8C0C4',
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    dai: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  },
  
  // Time ranges (in hours)
  timeRanges: {
    lastHour: 1,
    lastDay: 24,
    lastWeek: 168,
    lastMonth: 720
  },
  
  // Pagination
  pagination: {
    small: 10,
    medium: 50,
    large: 100
  }
};

interface Order {
  maker: string;
  makerAsset: string;
  takerAsset: string;
  makerTraits: string;
  salt: string;
  makingAmount: string;
  takingAmount: string;
  receiver: string;
}

interface OrderWithMetadata {
  order: Order;
  orderHash: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
}

interface GetOrdersResponse {
  success: boolean;
  data?: {
    orders: OrderWithMetadata[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

class RelayerClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseURL}/health`);
      logger.info('Health check response:', response.data);
      return response.data.status === 'ok';
    } catch (error) {
      logger.error('Health check failed:', error);
      return false;
    }
  }

  async getOrders(limit: number = 50, offset: number = 0): Promise<GetOrdersResponse> {
    try {
      const response = await axios.get(`${this.baseURL}/api/orders?limit=${limit}&offset=${offset}`);
      logger.info(`Retrieved ${response.data.data?.orders?.length || 0} orders`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get orders:', error.response?.data || error.message);
      return {
        success: false,
        error: {
          code: 'GET_ORDERS_FAILED',
          message: error.response?.data?.error?.message || error.message,
          details: error.response?.data?.error?.details
        }
      };
    }
  }

  async getOrdersByStatus(status: string, limit: number = 50, offset: number = 0): Promise<GetOrdersResponse> {
    try {
      const response = await axios.get(`${this.baseURL}/api/orders?status=${status}&limit=${limit}&offset=${offset}`);
      logger.info(`Retrieved ${response.data.data?.orders?.length || 0} orders with status: ${status}`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get orders by status:', error.response?.data || error.message);
      return {
        success: false,
        error: {
          code: 'GET_ORDERS_BY_STATUS_FAILED',
          message: error.response?.data?.error?.message || error.message,
          details: error.response?.data?.error?.details
        }
      };
    }
  }

  async getOrdersByAsset(assetAddress: string, limit: number = 50, offset: number = 0): Promise<GetOrdersResponse> {
    try {
      const response = await axios.get(`${this.baseURL}/api/orders?asset=${assetAddress}&limit=${limit}&offset=${offset}`);
      logger.info(`Retrieved ${response.data.data?.orders?.length || 0} orders for asset: ${assetAddress}`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get orders by asset:', error.response?.data || error.message);
      return {
        success: false,
        error: {
          code: 'GET_ORDERS_BY_ASSET_FAILED',
          message: error.response?.data?.error?.message || error.message,
          details: error.response?.data?.error?.details
        }
      };
    }
  }
}

function formatOrder(orderWithMetadata: OrderWithMetadata): string {
  const { order, orderHash, status, createdAt, updatedAt } = orderWithMetadata;
  
  return `
Order Hash: ${orderHash}
Status: ${status}
Maker: ${order.maker}
Maker Asset: ${order.makerAsset}
Taker Asset: ${order.takerAsset}
Making Amount: ${order.makingAmount}
Taking Amount: ${order.takingAmount}
Receiver: ${order.receiver}
Salt: ${order.salt}
Created: ${createdAt || 'N/A'}
Updated: ${updatedAt || 'N/A'}
Maker Traits: ${order.makerTraits}
---`;
}

function displayOrders(orders: OrderWithMetadata[], title: string = 'Orders'): void {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${title.toUpperCase()}`);
  console.log(`${'='.repeat(50)}`);
  
  if (orders.length === 0) {
    console.log('No orders found.');
    return;
  }
  
  orders.forEach((order, index) => {
    console.log(`\n${index + 1}. ${formatOrder(order)}`);
  });
  
  console.log(`\nTotal: ${orders.length} orders`);
}

async function main() {
  logger.info('Starting Order Listing Script');
  
  const client = new RelayerClient(RELAYER_URL);
  
  // Check if relayer is healthy
  logger.info('Checking relayer health...');
  const isHealthy = await client.healthCheck();
  if (!isHealthy) {
    logger.error('Relayer is not healthy. Exiting.');
    process.exit(1);
  }
  logger.info('Relayer is healthy!');

  // Example 1: List all orders (default pagination)
  console.log('\n📋 EXAMPLE 1: All Orders (Default)');
  const allOrders = await client.getOrders();
  if (allOrders.success && allOrders.data) {
    displayOrders(allOrders.data.orders, `All Orders (${allOrders.data.total} total)`);
    console.log(`Pagination: ${allOrders.data.orders.length}/${allOrders.data.total} (limit: ${allOrders.data.limit}, offset: ${allOrders.data.offset})`);
    console.log(`Has more: ${allOrders.data.hasMore}`);
  } else {
    console.log('Failed to get orders:', allOrders.error?.message);
  }

  // Example 2: List orders with small pagination
  console.log('\n📋 EXAMPLE 2: Orders with Small Pagination');
  const smallPaginationOrders = await client.getOrders(FILTER_OPTIONS.pagination.small, 0);
  if (smallPaginationOrders.success && smallPaginationOrders.data) {
    displayOrders(smallPaginationOrders.data.orders, `Orders (Small Pagination - ${FILTER_OPTIONS.pagination.small} per page)`);
  } else {
    console.log('Failed to get orders with small pagination:', smallPaginationOrders.error?.message);
  }

  // Example 3: List active orders
  console.log('\n📋 EXAMPLE 3: Active Orders Only');
  const activeOrders = await client.getOrdersByStatus(FILTER_OPTIONS.status.active);
  if (activeOrders.success && activeOrders.data) {
    displayOrders(activeOrders.data.orders, `Active Orders (${activeOrders.data.total} total)`);
  } else {
    console.log('Failed to get active orders:', activeOrders.error?.message);
  }

  // Example 4: List completed orders
  console.log('\n📋 EXAMPLE 4: Completed Orders Only');
  const completedOrders = await client.getOrdersByStatus(FILTER_OPTIONS.status.completed);
  if (completedOrders.success && completedOrders.data) {
    displayOrders(completedOrders.data.orders, `Completed Orders (${completedOrders.data.total} total)`);
  } else {
    console.log('Failed to get completed orders:', completedOrders.error?.message);
  }

  // Example 5: List orders by asset (USDC)
  console.log('\n📋 EXAMPLE 5: Orders Involving USDC');
  const usdcOrders = await client.getOrdersByAsset(FILTER_OPTIONS.assets.usdc);
  if (usdcOrders.success && usdcOrders.data) {
    displayOrders(usdcOrders.data.orders, `USDC Orders (${usdcOrders.data.total} total)`);
  } else {
    console.log('Failed to get USDC orders:', usdcOrders.error?.message);
  }

  // Example 6: List orders by asset (WETH)
  console.log('\n📋 EXAMPLE 6: Orders Involving WETH');
  const wethOrders = await client.getOrdersByAsset(FILTER_OPTIONS.assets.weth);
  if (wethOrders.success && wethOrders.data) {
    displayOrders(wethOrders.data.orders, `WETH Orders (${wethOrders.data.total} total)`);
  } else {
    console.log('Failed to get WETH orders:', wethOrders.error?.message);
  }

  // Example 7: Large pagination for bulk operations
  console.log('\n📋 EXAMPLE 7: Large Pagination (Bulk Operations)');
  const largePaginationOrders = await client.getOrders(FILTER_OPTIONS.pagination.large, 0);
  if (largePaginationOrders.success && largePaginationOrders.data) {
    displayOrders(largePaginationOrders.data.orders, `Orders (Large Pagination - ${FILTER_OPTIONS.pagination.large} per page)`);
  } else {
    console.log('Failed to get orders with large pagination:', largePaginationOrders.error?.message);
  }

  // Summary
  console.log('\n📊 SUMMARY');
  console.log('='.repeat(50));
  console.log('Filter Options Available:');
  console.log(`- Status: ${Object.keys(FILTER_OPTIONS.status).join(', ')}`);
  console.log(`- Assets: ${Object.keys(FILTER_OPTIONS.assets).join(', ')}`);
  console.log(`- Time Ranges: ${Object.keys(FILTER_OPTIONS.timeRanges).join(', ')}`);
  console.log(`- Pagination: ${Object.keys(FILTER_OPTIONS.pagination).join(', ')}`);
  console.log('\nUsage Examples:');
  console.log('- Get all orders: client.getOrders()');
  console.log('- Get orders by status: client.getOrdersByStatus("active")');
  console.log('- Get orders by asset: client.getOrdersByAsset("0x...")');
  console.log('- Pagination: client.getOrders(limit, offset)');

  logger.info('Order listing script completed successfully!');
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main().catch((error) => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
}

export { RelayerClient, FILTER_OPTIONS }; 