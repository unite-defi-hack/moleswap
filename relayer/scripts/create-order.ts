#!/usr/bin/env ts-node

import axios from 'axios';
import { ethers } from 'ethers';
import { logger } from '../src/utils/logger';
import { 
  EvmAddress, 
  HashLock, 
  randBigInt,
  Address,
  TimeLocks,
  EvmCrossChainOrder,
  AuctionDetails,
  TonAddress
} from '@1inch/cross-chain-sdk';
import { randomBytes } from 'crypto';
import { Wallet } from 'ethers';

// Configuration - using the same as working example
const RELAYER_URL = process.env['RELAYER_URL'] || 'http://localhost:3000';
const UINT_40_MAX = (1n << 40n) - 1n;

const safeBigInt = (val: string, fallback = 0n): bigint => {
  try {
    return val ? BigInt(val) : fallback;
  } catch {
    return fallback;
  }
};

// Generate unique order data each time using proper Cross-Chain SDK (EXACT same as working example)
async function generateUniqueOrders() {
  // Use the EXACT same wallets as working example
  const makerWallet = new Wallet('e9db769d24d997149156061e06424dce78968b6b9d2fef6ef9fbf701bdb3a331'); // Working example's maker
  const takerWallet = new Wallet('7f8d1d2239ec86ad679c74f28afd032d94816eb0b0e43f48c71d4e52a86f7f85'); // Working example's taker
  
  logger.info(`👤 Maker wallet: ${makerWallet.address}`);
  logger.info(`👤 Taker wallet: ${takerWallet.address}`);
  
  // ----------------------------------------------------------------------------
  // 1. Secret & Hash-lock (EXACT same as working example)
  // ----------------------------------------------------------------------------
  const secretBytes = randomBytes(32);
  const secret = "0x" + Buffer.from(secretBytes).toString("hex");
  const hashLock = HashLock.forSingleFill(secret);
  const secretHash = hashLock.toString();
  
  logger.info(`🔐 Secret and hashlock created:`, {
    secret: secret.substring(0, 20) + '...',
    secretHash: secretHash
  });

  // ----------------------------------------------------------------------------
  // 2. Time-locks & Safety deposits (EXACT same as working example)
  // ----------------------------------------------------------------------------
  const timeLocks = TimeLocks.new({
    srcWithdrawal: 0n,
    srcPublicWithdrawal: 12000n,
    srcCancellation: 18000n,
    srcPublicCancellation: 24000n,
    dstWithdrawal: 0n,
    dstPublicWithdrawal: 120n,
    dstCancellation: 180n,
  });

  const SRC_SAFETY_DEPOSIT = safeBigInt("1000000000000");
  const DST_SAFETY_DEPOSIT = safeBigInt("1000000000000");

  // ----------------------------------------------------------------------------
  // 3. Auction parameters (EXACT same as working example)
  // ----------------------------------------------------------------------------
  const auctionDetails = AuctionDetails.noAuction();

  // ----------------------------------------------------------------------------
  // 4. Build Cross-Chain Order (EXACT same as working example)
  // ----------------------------------------------------------------------------
  const MAKING_AMOUNT = safeBigInt("881220000000000"); // 0.00088122 ETH, ~3.31$
  const TAKING_AMOUNT = safeBigInt("200000000"); // 0.2 TON

  const nonce = randBigInt(UINT_40_MAX);

  // Use EXACT same tokens as working example
  const TOKEN_A = "0xa360725f46f43ad1b1aae09acfae96c2b59d1013"; // Working example's maker asset (EVM)
  const TOKEN_B = TonAddress.NATIVE; // Working example's taker asset (TON)

  // Configuration matching working example
  const config = {
    escrowFactoryAddress: "0x5e7854fC41247FD537FE45d7Ada070b9Bfba41DA",
    sourceChainId: 11155111, // Sepolia
    destinationChainId: 608, // TON testnet
    resolverProxyAddress: "0xAa15bcf840eb0454C87710E6578E6C77Cd3DC402"
  };

  const order = EvmCrossChainOrder.new(
    new EvmAddress(new Address(config.escrowFactoryAddress)),
    {
      makerAsset: new EvmAddress(new Address(TOKEN_A)),
      takerAsset: TOKEN_B,
      makingAmount: MAKING_AMOUNT,
      takingAmount: TAKING_AMOUNT,
      maker: new EvmAddress(new Address(makerWallet.address)),
      receiver: new TonAddress("0QCDScvyElUG1_R9Zm60degE6gUfWBXr-dwmdJasz4D7YwYb"),
    },
    {
      hashLock,
      srcChainId: config.sourceChainId as unknown as any,
      dstChainId: config.destinationChainId as unknown as any,
      srcSafetyDeposit: SRC_SAFETY_DEPOSIT,
      dstSafetyDeposit: DST_SAFETY_DEPOSIT,
      timeLocks,
    },
    {
      auction: auctionDetails,
      whitelist: [
        {
          address: new EvmAddress(new Address(config.resolverProxyAddress)),
          allowFrom: 0n,
        },
      ],
    },
    {
      allowPartialFills: false,
      allowMultipleFills: false,
      nonce: nonce,
    }
  );

  logger.info(`📋 Order created with parameters:`, {
    maker: order.maker.toString(),
    makerAsset: order.makerAsset.toString(),
    takerAsset: order.takerAsset.toString(),
    makingAmount: order.makingAmount.toString(),
    takingAmount: order.takingAmount.toString(),
    receiver: order.receiver.toString()
  });

  // Use SDK's order.build() output for the payload
  const orderData = order.build();

  // Use SDK's EIP-712 domain/types/message for signing
  const typedData = order.getTypedData(config.sourceChainId);
  const signature = await makerWallet.signTypedData(
    typedData.domain,
    { Order: typedData.types['Order'] as any },
    typedData.message
  );
  const orderHash = order.getOrderHash(config.sourceChainId);

  const output = {
    order: orderData,
    extension: order.extension.encode(),
    signature,
    secret,
    hashlock: orderData.makerTraits, // Use the uint256 string for hashlock
    orderHash: orderHash,
    expirationTime: new Date(Number(order.deadline) * 1000).toISOString(),
  };

  logger.info(`✍️ Order signed successfully:`, {
    orderHash: output.orderHash,
    signature: signature.substring(0, 20) + '...'
  });
  
  const COMPLETE_ORDERS = [
    {
      order: output.order,
      extension: output.extension,
      signature: output.signature,
      secret: output.secret,
      secretHash: output.hashlock
    }
  ];

  return { COMPLETE_ORDERS };
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
  signature: string | Promise<string>;
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
        chainId: 11155111,
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
      
      // Handle async signature if needed
      const signature = typeof completeOrder.signature === 'string' 
        ? completeOrder.signature 
        : await completeOrder.signature;
      
      const request: CreateCompleteOrderRequest = { 
        completeOrder: {
          ...completeOrder,
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
  const { COMPLETE_ORDERS } = await generateUniqueOrders();
  
  // Create a single complete order
  logger.info('Creating a single complete EVM-to-TON cross-chain order...');
  const createdCompleteOrders: string[] = [];
  
  const completeOrder = COMPLETE_ORDERS[0];
  if (completeOrder) {
    logger.info('Creating complete EVM-to-TON cross-chain order...');
    logger.info(`Using unique salt: ${completeOrder.order.salt}`);
    logger.info(`Using unique secret: ${completeOrder.secret}`);
    logger.info(`Using unique secret hash: ${completeOrder.secretHash}`);
    
    // Wait for the signature to be generated
    const signature = await completeOrder.signature;
    const orderWithSignature = {
      ...completeOrder,
      signature: signature
    };
    
    const result = await client.createCompleteOrder(orderWithSignature);
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