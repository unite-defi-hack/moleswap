#!/usr/bin/env ts-node

import axios from 'axios';
import { ethers } from 'ethers';
import { logger } from '../src/utils/logger';

// Configuration
const RELAYER_URL = process.env['RELAYER_URL'] || 'http://localhost:3000';

// Function to generate unique salt
function generateUniqueSalt(): string {
  return (BigInt(Date.now()) + BigInt(Math.floor(Math.random() * 1000000))).toString();
}

// Function to generate unique secret
function generateUniqueSecret(): string {
  return "0x" + Buffer.from(require('crypto').randomBytes(32)).toString('hex');
}

// Function to generate unique secret hash
function generateSecretHash(secret: string): string {
  return ethers.keccak256(secret);
}

// Generate unique order data each time
function generateUniqueOrders() {
  const uniqueSalt = generateUniqueSalt();
  const uniqueSecret = generateUniqueSecret();
  const uniqueSecretHash = generateSecretHash(uniqueSecret);
  
  const REAL_ORDERS = [
    {
      maker: '0x71078879cd9a1d7987b74cee6b6c0d130f1a0115',
      makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03', // EVM token address
      takerAsset: '0x0000000000000000000000000000000000000000', // TON native token (placeholder for TON address)
      makerTraits: uniqueSecretHash, // Use unique secret hash as makerTraits
      salt: uniqueSalt,
      makingAmount: '881220000000000', // 0.00088122 ETH, ~3.31$ (matching the example)
      takingAmount: '200000000', // 0.2 TON (matching the example)
      receiver: '0QCDScvyElUG1_R9Zm60degE6gUfWBXr-dwmdJasz4D7YwYb' // TON address format
    }
  ];

  // Complete order data with extension, secret, and secretHash
  const COMPLETE_ORDERS = [
    {
      order: {
        maker: "0x71078879cd9a1d7987b74cee6b6c0d130f1a0115",
        makerAsset: "0x10563e509b718a279de002dfc3e94a8a8f642b03", // EVM token address
        takerAsset: "0x0000000000000000000000000000000000000000", // TON native token (placeholder for TON address)
        makerTraits: uniqueSecretHash, // Use unique secret hash as makerTraits
        salt: uniqueSalt,
        makingAmount: "881220000000000", // 0.00088122 ETH, ~3.31$ (matching the example)
        takingAmount: "200000000", // 0.2 TON (matching the example)
        receiver: "0QCDScvyElUG1_R9Zm60degE6gUfWBXr-dwmdJasz4D7YwYb" // TON address format
      },
      extension: "0x0000010f0000004a0000004a0000004a0000004a000000250000000000000000b7dcd034d89bef6429ec80eaf77f8ffb73e5b40b00000000000000688a9ff4000384000000b7dcd034d89bef6429ec80eaf77f8ffb73e5b40b00000000000000688a9ff4000384000000b7dcd034d89bef6429ec80eaf77f8ffb73e5b40b688aa0008863b00397a9e212049500000800bd363c7762ace561ec85a122307bff99ee8832363f26c64e9a1545b1b453500000000000000000000000000000000000000000000000000000000000014a3400000000000000000000000010563e509b718a279de002dfc3e94a8a8f642b03",
      signature: "", // Will be generated dynamically
      secret: uniqueSecret,
      secretHash: uniqueSecretHash
    }
  ];

  return { REAL_ORDERS, COMPLETE_ORDERS };
}

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

interface CompleteOrder {
  order: RealOrder;
  extension: string;
  signature: string;
  secret: string;
  secretHash: string;
}

interface SignedOrder {
  order: RealOrder;
  signature: string;
}

interface CreateOrderRequest {
  signedOrder: SignedOrder;
}

interface CreateCompleteOrderRequest {
  completeOrder: CompleteOrder;
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
      logger.info('Creating order with user-provided hashlock...');
      
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
          { name: 'receiver', type: 'string' }
        ]
      };
      
      // Create a proper EIP-712 signature for testing
      // For testing, we'll use a known private key
      const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const testWallet = new ethers.Wallet(testPrivateKey);
      
      // Create a test order with the test wallet's address
      const testOrder = {
        ...order,
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

  async createCompleteOrder(completeOrder: CompleteOrder): Promise<CreateOrderResponse> {
    try {
      logger.info('Creating complete order with extension, secret, and secretHash...');
      
      // Generate a proper signature for the complete order
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
          { name: 'receiver', type: 'string' }
        ]
      };
      
      // Use a test private key that corresponds to the maker address
      const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const testWallet = new ethers.Wallet(testPrivateKey);
      
      // Create a test order with the test wallet's address
      const testCompleteOrder = {
        ...completeOrder,
        order: {
          ...completeOrder.order,
          maker: testWallet.address
        }
      };
      
      const signature = await testWallet.signTypedData(domain, types, testCompleteOrder.order);
      
      const request: CreateCompleteOrderRequest = { 
        completeOrder: {
          ...testCompleteOrder,
          signature: signature
        }
      };
      
      const response = await axios.post(`${this.baseURL}/api/orders/complete`, request);
      
      logger.info('Complete order created successfully:', response.data);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to create complete order:', error.response?.data || error.message);
      return {
        success: false,
        error: {
          code: 'CREATE_COMPLETE_ORDER_FAILED',
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

  // Generate unique order for this run
  const { COMPLETE_ORDERS } = generateUniqueOrders();
  
  // Create a single complete order
  logger.info('Creating a single complete EVM-to-TON cross-chain order...');
  const createdCompleteOrders: string[] = [];
  
  const completeOrder = COMPLETE_ORDERS[0];
  if (completeOrder) {
    logger.info('Creating complete EVM-to-TON cross-chain order...');
    logger.info(`Using unique salt: ${completeOrder.order.salt}`);
    logger.info(`Using unique secret: ${completeOrder.secret}`);
    logger.info(`Using unique secret hash: ${completeOrder.secretHash}`);
    
    const result = await client.createCompleteOrder(completeOrder);
    if (result.success && result.data?.orderHash) {
      createdCompleteOrders.push(result.data.orderHash);
      logger.info(`Complete EVM-to-TON cross-chain order created with hash: ${result.data.orderHash}`);
      logger.info(`Complete order details:`, {
        maker: completeOrder.order.maker,
        makerAsset: completeOrder.order.makerAsset,
        takerAsset: completeOrder.order.takerAsset,
        receiver: completeOrder.order.receiver,
        makingAmount: completeOrder.order.makingAmount,
        takingAmount: completeOrder.order.takingAmount,
        salt: completeOrder.order.salt,
        makerTraits: completeOrder.order.makerTraits,
        secret: completeOrder.secret,
        secretHash: completeOrder.secretHash
      });
      logger.info(`Complete EVM token -> TON native token cross-chain order`);
    } else {
      logger.error(`Failed to create complete EVM-to-TON cross-chain order:`, result.error);
    }
  }

  // Test secret request with the created complete order
  if (createdCompleteOrders.length > 0) {
    logger.info('Testing secret request...');
    const testOrderHash = createdCompleteOrders[0];
    
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

export { RelayerClient, generateUniqueOrders }; 