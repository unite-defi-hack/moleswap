import "dotenv/config";
import { Wallet, JsonRpcProvider } from "ethers";
import axios from "axios";
import {
  EvmCrossChainOrder,
  Extension,
  TakerTraits,
  AmountMode,
  EvmAddress,
  Address,
} from "@1inch/cross-chain-sdk";
import { loadConfig } from './config';
import { Signature } from "ethers";

interface RelayerOrder {
  order: {
    maker: string;
    makerAsset: string;
    takerAsset: string;
    makerTraits: string;
    salt: string;
    makingAmount: string;
    takingAmount: string;
    receiver: string;
    srcChainId?: number;
    dstChainId?: number;
    srcEscrowAddress?: string;
    dstEscrowAddress?: string;
  };
  orderHash: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  secretHash?: string;
  extension?: string;
  signature?: string;
}

interface RelayerResponse {
  success: boolean;
  data?: {
    orders: RelayerOrder[];
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

/**
 * Test that directly uses stored orders from the relayer without recreation
 * This simulates the real flow: maker creates order -> stored in DB -> taker executes directly
 */
class DirectOrderDepositTest {
  private config: any;
  private provider: JsonRpcProvider;
  private takerWallet: Wallet;
  private makerWallet: Wallet;
  private relayerUrl: string;

  constructor() {
    this.config = loadConfig();
    this.provider = new JsonRpcProvider(this.config.execution.rpcUrl);
    this.relayerUrl = process.env.RELAYER_URL || 'http://localhost:3000';
    
    // Need both maker and taker wallets for the working flow test
    this.makerWallet = new Wallet("e9db769d24d997149156061e06424dce78968b6b9d2fef6ef9fbf701bdb3a331");
    this.takerWallet = new Wallet("7f8d1d2239ec86ad679c74f28afd032d94816eb0b0e43f48c71d4e52a86f7f85", this.provider);
  }

  /**
   * Load stored orders from relayer service
   */
  async loadStoredOrders(filters: {
    status?: string;
    limit?: number;
    offset?: number;
    maker?: string;
    makerAsset?: string;
    takerAsset?: string;
    srcChainId?: number;
    dstChainId?: number;
  } = {}): Promise<RelayerOrder[]> {
    console.log('📁 Loading stored orders from relayer:', this.relayerUrl);
    console.log('🔍 Filters:', filters);
    
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());
      if (filters.maker) params.append('maker', filters.maker);
      if (filters.makerAsset) params.append('makerAsset', filters.makerAsset);
      if (filters.takerAsset) params.append('takerAsset', filters.takerAsset);
      if (filters.srcChainId) params.append('srcChainId', filters.srcChainId.toString());
      if (filters.dstChainId) params.append('dstChainId', filters.dstChainId.toString());

      const response = await axios.get(`${this.relayerUrl}/api/orders?${params.toString()}`);
      const result: RelayerResponse = response.data;

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to load orders from relayer');
      }

      console.log('✅ Stored orders loaded successfully');
      console.log('📊 Order summary:', {
        total: result.data.total,
        returned: result.data.orders.length,
        hasMore: result.data.hasMore
      });

      // Log order details
      result.data.orders.forEach((order, index) => {
        console.log(`📋 Order ${index + 1}:`, {
          orderHash: order.orderHash,
          status: order.status,
          maker: order.order.maker,
          makerAsset: order.order.makerAsset,
          takerAsset: order.order.takerAsset,
          makingAmount: order.order.makingAmount,
          takingAmount: order.order.takingAmount,
          hasExtension: !!order.extension,
          hasSecretHash: !!order.secretHash,
          hasSignature: !!order.signature,
          createdAt: order.createdAt
        });
      });

      return result.data.orders;
    } catch (error) {
      console.error('❌ Failed to load stored orders:', error);
      throw error;
    }
  }

  /**
   * Execute deposit directly using stored order data
   */
  async executeDepositWithStoredOrder(storedOrder: RelayerOrder): Promise<void> {
    console.log(`🚀 Executing deposit with stored order: ${storedOrder.orderHash}`);
    
    // Validate that we have all required data
    if (!storedOrder.signature) {
      throw new Error('Stored order missing signature - cannot execute without maker signature');
    }
    
    if (!storedOrder.extension) {
      throw new Error('Stored order missing extension data - cannot execute without extension');
    }

    console.log('✅ Stored order validation passed:', {
      hasSignature: !!storedOrder.signature,
      hasExtension: !!storedOrder.extension,
      signatureLength: storedOrder.signature.length,
      extensionLength: storedOrder.extension.length
    });

    try {
      // Import the EvmAdapter
      const { EvmAdapter } = await import('./services/lib/evmAdapter');
      
      // Create EVM adapter config
      const evmConfig = {
        resolverProxyAddress: this.config.crossChain.resolverProxyAddress,
        sourceChainId: this.config.crossChain.sourceNetworkId,
        lopAddress: this.config.crossChain.lopAddress,
        escrowFactoryAddress: this.config.crossChain.escrowFactoryAddress,
      };

      console.log('🔧 EVM Adapter config:', evmConfig);

      const evmAdapter = new EvmAdapter(this.provider, evmConfig);

      // Re-create the order object from stored data
      console.log('🔍 Extension data analysis:', {
        extensionLength: storedOrder.extension.length,
        extensionPreview: storedOrder.extension.substring(0, 50) + '...',
        isHex: /^0x[0-9a-fA-F]+$/.test(storedOrder.extension)
      });
      
      let evmOrder;
      try {
        const extension = Extension.decode(storedOrder.extension);
        evmOrder = EvmCrossChainOrder.fromDataAndExtension(
          storedOrder.order,
          extension
        );
      } catch (extensionError) {
        console.error('❌ Extension decode failed:', extensionError);
        console.log('🔍 Raw extension data:', storedOrder.extension);
        throw extensionError;
      }

      console.log("🔧 EVM Order recreated from stored data successfully");
      console.log("📋 EVM Order details:", {
        maker: evmOrder.maker.toString(),
        makerAsset: evmOrder.makerAsset.toString(),
        takerAsset: evmOrder.takerAsset.toString(),
        makingAmount: evmOrder.makingAmount.toString(),
        takingAmount: evmOrder.takingAmount.toString(),
        receiver: evmOrder.receiver.toString()
      });

      // Try to debug the transaction data first
      console.log("🔍 Debugging transaction data...");
      
      // Get the transaction data without executing
      const { r, yParityAndS: vs } = Signature.from(storedOrder.signature);
      const takerTraits = TakerTraits.default()
        .setExtension(evmOrder.extension)
        .setAmountMode(AmountMode.maker)
        .setAmountThreshold(evmOrder.takingAmount);

      const { args, trait } = takerTraits.encode();
      const immutables = evmOrder.toSrcImmutables(
        this.config.crossChain.sourceNetworkId,
        new EvmAddress(new Address(this.config.crossChain.resolverProxyAddress)),
        BigInt(storedOrder.order.makingAmount),
        evmOrder.escrowExtension.hashLockInfo
      );

      const transactionData = {
        to: this.config.crossChain.resolverProxyAddress,
        data: evmAdapter['resolverInterface'].encodeFunctionData("deploySrc", [
          immutables.build(),
          evmOrder.build(),
          r,
          vs,
          BigInt(storedOrder.order.makingAmount),
          trait,
          args,
        ]),
        value: evmOrder.escrowExtension.srcSafetyDeposit,
      };

      console.log("🔍 Transaction data:", {
        to: transactionData.to,
        value: transactionData.value.toString(),
        dataLength: transactionData.data.length,
        dataPreview: transactionData.data.substring(0, 100) + '...'
      });

      // Try to call the contract directly to see what error we get
      console.log("🔍 Testing direct contract call...");
      try {
        const result = await this.provider.call({
          ...transactionData,
          from: this.takerWallet.address,
        });
        console.log("✅ Direct call succeeded:", result);
      } catch (callError: any) {
        console.log("❌ Direct call failed:", {
          error: callError.message,
          data: callError.data,
          code: callError.code
        });
      }

      // Execute deposit using taker wallet with stored signature
      console.log("🚀 Executing deposit to source escrow using stored signature...");
      
      const depositResult = await evmAdapter.deployAndDepositToSrcEscrow(
        evmOrder,
        storedOrder.signature, // Use stored signature directly
        this.takerWallet,
        BigInt(storedOrder.order.makingAmount)
      );

      console.log("✅ Real deposit completed successfully!");
      console.log("📊 Deposit result:", {
        escrowAddress: depositResult.escrowAddress,
        transactionHash: depositResult.transactionHash,
        blockHash: depositResult.blockHash,
        blockTimestamp: depositResult.blockTimestamp
      });

    } catch (error) {
      console.error('❌ Deposit failed:', error);
      throw error;
    }
  }

  /**
   * Create a new valid order and store it in the database
   */
  async createAndStoreValidOrder(): Promise<void> {
    console.log('🔧 Creating new valid order and storing in database...');
    
    try {
      // Import the working order creation logic
      const { ExactMakerDepositTest } = await import('./test-deposit-exact-maker');
      const orderCreator = new ExactMakerDepositTest();
      
      // Create a new valid order
      const orderData = await orderCreator.createOrder();
      
      console.log('✅ New valid order created:', {
        orderHash: orderData.orderHash,
        secretHash: orderData.hashlock,
        hasExtension: !!orderData.extension,
        hasSignature: !!orderData.signature
      });

      // Store the order in the database using the complete endpoint
      const orderPayload = {
        completeOrder: {
          order: orderData.order,
          orderHash: orderData.orderHash,
          secretHash: orderData.hashlock,
          extension: orderData.extension,
          signature: orderData.signature,
          secret: orderData.secret,
          status: 'active'
        }
      };

      const response = await axios.post(`${this.relayerUrl}/api/orders/complete`, orderPayload);
      
      if (response.data.success) {
        console.log('✅ Order stored successfully in database');
        console.log('📋 New order hash:', orderData.orderHash);
      } else {
        throw new Error('Failed to store order in database');
      }

    } catch (error) {
      console.error('❌ Failed to create and store valid order:', error);
      throw error;
    }
  }

  /**
   * Test with the newly created valid order (without storage)
   */
  async testWithNewValidOrder(): Promise<void> {
    console.log('🚀 Testing with newly created valid order (no storage)');
    
    try {
      // Step 1: Create a new valid order using the working example's method
      const { ExactMakerDepositTest } = await import('./test-deposit-exact-maker');
      const orderCreator = new ExactMakerDepositTest();
      
      // Create a new valid order using the exact same method as working example
      const orderData = await orderCreator.createOrder();
      
      console.log('✅ New valid order created:', {
        orderHash: orderData.orderHash,
        secretHash: orderData.hashlock,
        hasExtension: !!orderData.extension,
        hasSignature: !!orderData.signature
      });

      // Step 2: Execute deposit directly with the fresh order (no storage)
      console.log('🚀 Executing deposit with fresh order (no storage)...');
      
      // Import the EvmAdapter
      const { EvmAdapter } = await import('./services/lib/evmAdapter');
      
      // Create EVM adapter config
      const evmConfig = {
        resolverProxyAddress: this.config.crossChain.resolverProxyAddress,
        sourceChainId: this.config.crossChain.sourceNetworkId,
        lopAddress: this.config.crossChain.lopAddress,
        escrowFactoryAddress: this.config.crossChain.escrowFactoryAddress,
      };

      console.log('🔧 EVM Adapter config:', evmConfig);

      const evmAdapter = new EvmAdapter(this.provider, evmConfig);

      // Re-create the order object from fresh data (same as working example)
      const extension = Extension.decode(orderData.extension);
      const evmOrder = EvmCrossChainOrder.fromDataAndExtension(
        orderData.order,
        extension
      );

      console.log("🔧 EVM Order recreated from fresh data successfully");
      console.log("📋 EVM Order details:", {
        maker: evmOrder.maker.toString(),
        makerAsset: evmOrder.makerAsset.toString(),
        takerAsset: evmOrder.takerAsset.toString(),
        makingAmount: evmOrder.makingAmount.toString(),
        takingAmount: evmOrder.takingAmount.toString(),
        receiver: evmOrder.receiver.toString()
      });

      // Execute deposit using taker wallet with fresh signature
      console.log("🚀 Executing deposit to source escrow using fresh signature...");
      
      // Use the exact same approach as the working example
      const depositResult = await evmAdapter.deployAndDepositToSrcEscrow(
        evmOrder,
        orderData.signature, // Use fresh signature directly
        this.takerWallet,
        BigInt(orderData.order.makingAmount)
      );

      console.log("✅ Real deposit completed successfully!");
      console.log("📊 Deposit result:", {
        escrowAddress: depositResult.escrowAddress,
        transactionHash: depositResult.transactionHash,
        blockHash: depositResult.blockHash,
        blockTimestamp: depositResult.blockTimestamp
      });
      
      console.log('✅ Test with fresh order completed successfully!');
      
    } catch (error) {
      console.error('❌ Test with fresh order failed:', error);
      throw error;
    }
  }

  /**
   * Test with the exact same flow as working example but different nonce
   */
  async testWithWorkingFlow(): Promise<void> {
    console.log('🚀 Testing with exact working example flow...');
    
    try {
      // Step 1: Create order using EXACT same logic as working example
      console.log('🔧 Creating order with EXACT same maker wallet as working example...');
      console.log('👤 Maker wallet:', this.makerWallet.address);
      console.log('👤 Taker wallet:', this.takerWallet.address);
      
      // Import the same dependencies as working example
      const { randomBytes } = await import("crypto");
      const {
        Address,
        HashLock,
        TimeLocks,
        EvmCrossChainOrder,
        AuctionDetails,
        randBigInt,
        EvmAddress,
        TonAddress,
      } = await import("@1inch/cross-chain-sdk");

      const UINT_40_MAX = (1n << 40n) - 1n;

      const safeBigInt = (val: string, fallback = 0n): bigint => {
        try {
          return val ? BigInt(val) : fallback;
        } catch {
          return fallback;
        }
      };

      // ----------------------------------------------------------------------------
      // 1. Secret & Hash-lock (EXACT same as working example)
      // ----------------------------------------------------------------------------
      const secretBytes = randomBytes(32);
      const secret = "0x" + Buffer.from(secretBytes).toString("hex");
      const hashLock = HashLock.forSingleFill(secret);
      const secretHash = hashLock.toString();

      console.log('🔐 Secret and hashlock created:', {
        secret: secret.substring(0, 20) + '...',
        secretHash: secretHash.substring(0, 20) + '...'
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

      console.log('⏰ Timelocks and safety deposits configured');

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
      const TOKEN_A = "0xa360725F46f43aD1B1aae09AcFae96c2b59D1013"; // Working example's maker asset (EVM)
      // Use TonAddress.NATIVE like the working example
      const TOKEN_B = TonAddress.NATIVE; // Working example's taker asset (TON)

      const order = EvmCrossChainOrder.new(
        new EvmAddress(new Address(this.config.crossChain.escrowFactoryAddress)),
        {
          makerAsset: new EvmAddress(new Address(TOKEN_A)), // Working example's maker asset (EVM)
          takerAsset: TOKEN_B, // Working example's taker asset (TON)
          makingAmount: MAKING_AMOUNT,
          takingAmount: TAKING_AMOUNT,
          maker: new EvmAddress(new Address(this.makerWallet.address)), // Use maker wallet
          receiver: new TonAddress("0QCDScvyElUG1_R9Zm60degE6gUfWBXr-dwmdJasz4D7YwYb"), // Working example's receiver
        },
        {
          hashLock,
          srcChainId: this.config.crossChain.sourceNetworkId as unknown as any,
          dstChainId: this.config.crossChain.destinationNetworkId as unknown as any,
          srcSafetyDeposit: SRC_SAFETY_DEPOSIT,
          dstSafetyDeposit: DST_SAFETY_DEPOSIT,
          timeLocks,
        },
        {
          auction: auctionDetails,
          whitelist: [
            {
              address: new EvmAddress(new Address(this.config.crossChain.resolverProxyAddress)),
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

      console.log('📋 Order created with parameters:', {
        maker: order.maker.toString(),
        makerAsset: order.makerAsset.toString(),
        takerAsset: order.takerAsset.toString(),
        makingAmount: order.makingAmount.toString(),
        takingAmount: order.takingAmount.toString(),
        receiver: order.receiver.toString()
      });

      // ----------------------------------------------------------------------------
      // 5. Sign the order (EIP-712) - Updated to match working example
      // ----------------------------------------------------------------------------
      const typedData = order.getTypedData(this.config.crossChain.sourceNetworkId);
      console.log("typedData", typedData);

      const signature = await this.makerWallet.signTypedData(
        typedData.domain,
        { Order: typedData.types['Order'] as any },
        typedData.message
      );

      console.log('✍️ Order signed successfully:', {
        orderHash: order.getOrderHash(this.config.crossChain.sourceNetworkId),
        signature: signature.substring(0, 20) + '...'
      });

      // Step 2: Execute deposit using EXACT same approach as working example
      console.log('🚀 Testing deposit with created order:', order.getOrderHash(this.config.crossChain.sourceNetworkId));
      
      // Import the EvmAdapter (same as working example)
      const { EvmAdapter } = await import('./services/lib/evmAdapter');
      
      // Create EVM adapter config (same as working example)
      const evmConfig = {
        resolverProxyAddress: this.config.crossChain.resolverProxyAddress,
        sourceChainId: this.config.crossChain.sourceNetworkId,
        lopAddress: this.config.crossChain.lopAddress,
        escrowFactoryAddress: this.config.crossChain.escrowFactoryAddress,
      };

      console.log('🔧 EVM Adapter config:', evmConfig);

      const evmAdapter = new EvmAdapter(this.provider, evmConfig);

      // Re-create the order object (same as working example)
      console.log("🔧 EVM Order recreated successfully");
      console.log("📋 EVM Order details:", {
        maker: order.maker.toString(),
        makerAsset: order.makerAsset.toString(),
        takerAsset: order.takerAsset.toString(),
        makingAmount: order.makingAmount.toString(),
        takingAmount: order.takingAmount.toString(),
        receiver: order.receiver.toString()
      });

      // Step 3: Wait for one block (like working example)
      // due to LOP check allowedTime > block.timestamp
      console.log(
        'Waiting for one block - before "resolver" starts to execute order'
      );
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Execute deposit using taker wallet (same as working example)
      console.log("🚀 Executing deposit to source escrow...");
      
      const depositResult = await evmAdapter.deployAndDepositToSrcEscrow(
        order,
        signature, // Use signature directly
        this.takerWallet,
        BigInt(order.makingAmount.toString())
      );

      console.log("✅ Real deposit completed successfully!");
      console.log("📊 Deposit result:", {
        escrowAddress: depositResult.escrowAddress,
        transactionHash: depositResult.transactionHash,
        blockHash: depositResult.blockHash,
        blockTimestamp: depositResult.blockTimestamp
      });
      
      console.log('✅ Test with working flow completed successfully!');
      
    } catch (error) {
      console.error('❌ Test with working flow failed:', error);
      throw error;
    }
  }

  /**
   * Run the complete test with stored orders from relayer
   */
  async run(filters: {
    status?: string;
    limit?: number;
    offset?: number;
    maker?: string;
    makerAsset?: string;
    takerAsset?: string;
    srcChainId?: number;
    dstChainId?: number;
  } = {}): Promise<void> {
    console.log('🚀 Starting Direct Order Deposit Test (No Recreation)');
    console.log('=====================================================');

    try {
      // Check wallet balance
      const takerBalance = await this.provider.getBalance(this.takerWallet.address);
      console.log(`💰 Taker wallet balance: ${takerBalance.toString()} wei`);

      // Step 1: Load stored orders from relayer
      const storedOrders = await this.loadStoredOrders(filters);
      console.log('✅ Step 1: Stored orders loaded successfully');

      if (storedOrders.length === 0) {
        console.log('⚠️ No orders found with the specified filters');
        console.log('💡 Try different filters or create some orders first');
        return;
      }

      // Step 2: Find an order with complete data (signature + extension)
      const completeOrder = storedOrders.find(order => 
        order.signature && order.extension
      );

      if (!completeOrder) {
        console.log('⚠️ No orders found with complete data (signature + extension)');
        console.log('💡 Orders need both signature and extension data for direct execution');
        console.log('📊 Available orders:');
        storedOrders.forEach((order, index) => {
          console.log(`${index + 1}. ${order.orderHash}: signature=${!!order.signature}, extension=${!!order.extension}`);
        });
        return;
      }

      console.log('✅ Step 2: Found order with complete data');

      // Step 3: Wait for one block (like working example)
      console.log(
        'Waiting for one block - before "resolver" starts to execute order'
      );
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Step 4: Execute deposit directly with stored order
      await this.executeDepositWithStoredOrder(completeOrder);
      console.log('✅ Step 4: Direct deposit completed successfully');

      console.log('\n✅ Direct order test completed successfully!');
      
      // Summary of available orders
      console.log('\n📊 Available Orders Summary:');
      storedOrders.forEach((order, index) => {
        const hasCompleteData = order.signature && order.extension;
        console.log(`${index + 1}. ${order.orderHash} (${order.status}) - ${order.order.makerAsset} -> ${order.order.takerAsset} [${hasCompleteData ? '✅ Complete' : '❌ Incomplete'}]`);
      });
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      throw error;
    }
  }

  /**
   * Test with specific order hash from relayer
   */
  async testWithSpecificOrder(orderHash: string): Promise<void> {
    console.log(`🚀 Testing with specific order hash: ${orderHash}`);
    
    try {
      // Load specific order from relayer
      const response = await axios.get(`${this.relayerUrl}/api/orders?orderHash=${orderHash}`);
      const result: RelayerResponse = response.data;

      if (!result.success || !result.data || result.data.orders.length === 0) {
        throw new Error(`Order not found: ${orderHash}`);
      }

      const storedOrder = result.data.orders[0]!;
      console.log('✅ Specific order loaded successfully');

      // Validate order has complete data
      if (!storedOrder.signature || !storedOrder.extension) {
        throw new Error(`Order ${orderHash} missing required data: signature=${!!storedOrder.signature}, extension=${!!storedOrder.extension}`);
      }

      // Execute deposit directly
      await this.executeDepositWithStoredOrder(storedOrder);
      
      console.log('✅ Specific order test completed successfully!');
      
    } catch (error) {
      console.error('❌ Specific order test failed:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0];
  
  const test = new DirectOrderDepositTest();
  
  if (command === 'specific' && args[1]) {
    // Test with specific order hash
    await test.testWithSpecificOrder(args[1]);
  } else if (command === 'new') {
    // Test with newly created valid order
    await test.testWithNewValidOrder();
  } else if (command === 'working') {
    // Test with exact working example flow
    await test.testWithWorkingFlow();
  } else {
    // Default filters - you can modify these
    const filters = {
      status: 'active', // Only active orders
      limit: 10, // Limit to 10 orders
      // Add more filters as needed:
      // maker: '0x...',
      // makerAsset: '0x...',
      // srcChainId: 11155111, // Sepolia
      // dstChainId: 84532, // Base Sepolia
    };
    
    await test.run(filters);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { DirectOrderDepositTest }; 