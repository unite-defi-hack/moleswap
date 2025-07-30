#!/usr/bin/env ts-node

import axios from 'axios';
import { ethers } from 'ethers';
import { logger } from '../src/utils/logger';

// Configuration
const RELAYER_URL = process.env['RELAYER_URL'] || 'http://localhost:3000';

// Real order data matching the 1inch cross-chain SDK format
const REAL_ORDERS = [
  {
    maker: '0x71078879cd9a1d7987b74cee6b6c0d130f1a0115',
    makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
    takerAsset: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
    makerTraits: '62419173104490761595518734107500191045118193502286569769834485471068666462208',
    salt: '8055219788148251265908589343240715975237002832007417457800707733977',
    makingAmount: '1000000000000000000',
    takingAmount: '2000000000000000000',
    receiver: '0x0000000000000000000000000000000000000000'
  }
];

interface RealOrder {
  maker: string;
  makerAsset: string;
  takerAsset: string;
  makerTraits: string;
  salt: string;
  makingAmount: string;
  takingAmount: string;
  receiver: string;
}

interface SignedOrder {
  order: RealOrder;
  signature: string;
}

interface CreateOrderRequest {
  signedOrder: SignedOrder;
}

interface CreateOrderResponse {
  success: boolean;
  data?: {
    orderHash: string;
    order: RealOrder;
    status: string;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

interface GetOrdersResponse {
  success: boolean;
  data?: {
    orders: Array<{
      order: RealOrder;
      orderHash: string;
      status: string;
      createdAt: string | null;
      updatedAt: string | null;
    }>;
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

  async createOrder(order: RealOrder): Promise<CreateOrderResponse> {
    try {
      // First, get the order data with hashlock from the /data endpoint
      const orderDataRequest = { 
        order: {
          maker: order.maker,
          makerAsset: order.makerAsset,
          takerAsset: order.takerAsset,
          makingAmount: order.makingAmount,
          takingAmount: order.takingAmount,
          receiver: order.receiver
        }
      };
      
      const dataResponse = await axios.post(`${this.baseURL}/api/orders/data`, orderDataRequest);
      
      if (!dataResponse.data.success) {
        throw new Error('Failed to get order data: ' + dataResponse.data.error?.message);
      }
      
      const { orderToSign } = dataResponse.data.data;
      
      // Define the EIP-712 domain and types (matching the relayer's format exactly)
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
      
      // Create a proper EIP-712 signature for testing
      // For the real order, we need to use a private key that corresponds to the maker address
      // The maker address is 0x71078879cd9a1d7987b74cee6b6c0d130f1a0115
      // For testing purposes, we'll use a known private key that generates this address
      const makerPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234'; // This should generate the maker address
      const makerWallet = new ethers.Wallet(makerPrivateKey);
      
      // Verify the wallet address matches the maker
      if (makerWallet.address.toLowerCase() !== orderToSign.maker.toLowerCase()) {
        logger.warn(`Wallet address ${makerWallet.address} doesn't match maker ${orderToSign.maker}. Using a different approach.`);
        
        // For testing, we'll create a signature that matches the expected maker
        // In a real scenario, you would use the actual private key of the maker
        const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        const testWallet = new ethers.Wallet(testPrivateKey);
        
        // Create a test order with the test wallet's address
        const testOrder = {
          ...orderToSign,
          maker: testWallet.address
        };
        
        const signature = await testWallet.signTypedData(domain, types, testOrder);
        
        const signedOrder: SignedOrder = {
          order: testOrder,
          signature: signature
        };
        
        const request: CreateOrderRequest = { signedOrder };
        const response = await axios.post(`${this.baseURL}/api/orders`, request);
        logger.info('Order created successfully:', response.data);
        return response.data;
      }
      
      // Sign the order using EIP-712
      const signature = await makerWallet.signTypedData(domain, types, orderToSign);
      
      const signedOrder: SignedOrder = {
        order: orderToSign,
        signature: signature
      };
      
      const request: CreateOrderRequest = { signedOrder };
      const response = await axios.post(`${this.baseURL}/api/orders`, request);
      logger.info('Order created successfully:', response.data);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to create order:', error.response?.data || error.message);
      return {
        success: false,
        error: {
          code: 'CREATE_ORDER_FAILED',
          message: error.response?.data?.error?.message || error.message,
          details: error.response?.data?.error?.details
        }
      };
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

  async requestSecret(orderHash: string, escrowData: {
    srcEscrowAddress: string;
    dstEscrowAddress: string;
    srcChainId: string;
    dstChainId: string;
  }): Promise<any> {
    try {
      const response = await axios.post(`${this.baseURL}/api/secrets/${orderHash}`, escrowData);
      logger.info('Secret requested successfully:', response.data);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to request secret:', error.response?.data || error.message);
      return {
        success: false,
        error: {
          code: 'REQUEST_SECRET_FAILED',
          message: error.response?.data?.error?.message || error.message,
          details: error.response?.data?.error?.details
        }
      };
    }
  }
}

async function main() {
  logger.info('Starting Relayer Client Test Script');
  
  const client = new RelayerClient(RELAYER_URL);
  
  // Check if relayer is healthy
  logger.info('Checking relayer health...');
  const isHealthy = await client.healthCheck();
  if (!isHealthy) {
    logger.error('Relayer is not healthy. Exiting.');
    process.exit(1);
  }
  logger.info('Relayer is healthy!');

  // Get existing orders
  logger.info('Getting existing orders...');
  const existingOrders = await client.getOrders();
  if (existingOrders.success) {
    logger.info(`Found ${existingOrders.data?.total || 0} existing orders`);
  }

  // Create new orders
  logger.info('Creating real orders...');
  const createdOrders: string[] = [];
  
  for (let i = 0; i < REAL_ORDERS.length; i++) {
    const order = REAL_ORDERS[i];
    if (!order) continue;
    
    logger.info(`Creating order ${i + 1}/${REAL_ORDERS.length}...`);
    
    const result = await client.createOrder(order);
    if (result.success && result.data?.orderHash) {
      createdOrders.push(result.data.orderHash);
      logger.info(`Order created with hash: ${result.data.orderHash}`);
    } else {
      logger.error(`Failed to create order ${i + 1}:`, result.error);
    }
    
    // Add a small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Test secret request with one of the created orders
  if (createdOrders.length > 0) {
    logger.info('Testing secret request...');
    const testOrderHash = createdOrders[0];
    
    if (testOrderHash) {
      const secretRequest = await client.requestSecret(testOrderHash, {
        srcEscrowAddress: '0x1234567890123456789012345678901234567890',
        dstEscrowAddress: '0x0987654321098765432109876543210987654321',
        srcChainId: '1',
        dstChainId: '137'
      });
      
      if (secretRequest.success) {
        logger.info('Secret request successful!');
      } else {
        logger.info('Secret request failed (expected for dummy orders):', secretRequest.error?.message);
      }
    }
  }

  // Get updated orders list
  logger.info('Getting updated orders list...');
  const updatedOrders = await client.getOrders();
  if (updatedOrders.success) {
    logger.info(`Total orders after creation: ${updatedOrders.data?.total || 0}`);
  }

  logger.info('Script completed successfully!');
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

export { RelayerClient, REAL_ORDERS }; 