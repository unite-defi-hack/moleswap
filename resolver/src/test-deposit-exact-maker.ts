import "dotenv/config";
import { randomBytes } from "crypto";
import { Wallet, JsonRpcProvider } from "ethers";
import {
  Address,
  HashLock,
  TimeLocks,
  EvmCrossChainOrder,
  AuctionDetails,
  randBigInt,
  EvmAddress,
  TonAddress,
  Extension,
} from "@1inch/cross-chain-sdk";
import { loadConfig } from './config';

const UINT_40_MAX = (1n << 40n) - 1n;

const safeBigInt = (val: string, fallback = 0n): bigint => {
  try {
    return val ? BigInt(val) : fallback;
  } catch {
    return fallback;
  }
};

/**
 * Test that uses the EXACT same maker wallet as the working example
 */
class ExactMakerDepositTest {
  private config: any;
  private provider: JsonRpcProvider;
  private takerWallet: Wallet;
  private makerWallet: Wallet;

  constructor() {
    this.config = loadConfig();
    this.provider = new JsonRpcProvider(this.config.execution.rpcUrl);
    
    // Use the EXACT same wallets as working example
    this.makerWallet = new Wallet("e9db769d24d997149156061e06424dce78968b6b9d2fef6ef9fbf701bdb3a331"); // Working example's maker
    this.takerWallet = new Wallet("7f8d1d2239ec86ad679c74f28afd032d94816eb0b0e43f48c71d4e52a86f7f85", this.provider); // Working example's taker
  }

  /**
   * Create order using EXACT same maker wallet as working example
   */
  async createOrder(): Promise<any> {
    console.log('🔧 Creating order with EXACT same maker wallet as working example...');
    console.log('👤 Maker wallet:', this.makerWallet.address);
    console.log('👤 Taker wallet:', this.takerWallet.address);
    
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

    // Log the complete order data for comparison
    const orderData = order.build();
    console.log('🔍 Complete order data for comparison:');
    console.log('Order:', JSON.stringify(orderData, null, 2));
    console.log('Extension:', order.extension.encode());
    console.log('Order Hash:', order.getOrderHash(this.config.crossChain.sourceNetworkId));
    console.log('Deadline:', order.deadline.toString());
    console.log('Nonce:', nonce.toString());
    console.log('Hash Lock:', hashLock.toString());
    console.log('Secret Hash:', secretHash);

    // ----------------------------------------------------------------------------
    // 5. Sign the order (EIP-712) - Updated to match working example
    // ----------------------------------------------------------------------------
    const typedData = order.getTypedData(this.config.crossChain.sourceNetworkId);
    console.log("typedData", typedData);

    const signature = await this.makerWallet.signTypedData(
      typedData.domain,
      { Order: typedData.types.Order as any },
      typedData.message
    );

    const output = {
      order: order.build(),
      extension: order.extension.encode(),
      signature,
      secret,
      hashlock: secretHash,
      orderHash: order.getOrderHash(this.config.crossChain.sourceNetworkId),
      expirationTime: new Date(Number(order.deadline) * 1000).toISOString(),
      // Additional metadata for comparison with create-order script
      metadata: {
        maker: this.makerWallet.address,
        taker: this.takerWallet.address,
        nonce: nonce.toString(),
        chainIds: {
          source: this.config.crossChain.sourceNetworkId,
          destination: this.config.crossChain.destinationNetworkId,
        },
        amounts: {
          making: MAKING_AMOUNT.toString(),
          taking: TAKING_AMOUNT.toString(),
        },
        safetyDeposits: {
          source: SRC_SAFETY_DEPOSIT.toString(),
          destination: DST_SAFETY_DEPOSIT.toString(),
        },
      }
    };

    console.log('✍️ Order signed successfully:', {
      orderHash: output.orderHash,
      signature: signature.substring(0, 20) + '...'
    });

    return output;
  }

  /**
   * Print order in JSON format for comparison with create-order script
   */
  printOrderAsJson(orderData: any): void {
    console.log('\n📄 Order JSON Output (from test-deposit-exact-maker):');
    console.log('='.repeat(60));
    console.log(JSON.stringify(orderData, null, 2));
    console.log('='.repeat(60));
    console.log('\n✅ Order JSON printed successfully!');
    console.log(`📋 Order Hash: ${orderData.orderHash}`);
    console.log(`⏰ Expires: ${orderData.expirationTime}`);
  }

  /**
   * Test deposit with the created order using taker wallet
   */
  async testDeposit(orderData: any): Promise<void> {
    console.log(`\n🚀 Testing deposit with created order: ${orderData.orderHash}`);
    
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

      // Re-create the order object from serialized data - Updated to match working example
      const extension = Extension.decode(orderData.extension);
      const evmOrder = EvmCrossChainOrder.fromDataAndExtension(
        orderData.order,
        extension
      );

      console.log("🔧 EVM Order recreated successfully");
      console.log("📋 EVM Order details:", {
        maker: evmOrder.maker.toString(),
        makerAsset: evmOrder.makerAsset.toString(),
        takerAsset: evmOrder.takerAsset.toString(),
        makingAmount: evmOrder.makingAmount.toString(),
        takingAmount: evmOrder.takingAmount.toString(),
        receiver: evmOrder.receiver.toString()
      });

      // Execute deposit using taker wallet (like working example)
      console.log("🚀 Executing deposit to source escrow...");
      
      const depositResult = await evmAdapter.deployAndDepositToSrcEscrow(
        evmOrder,
        orderData.signature,
        this.takerWallet, // Use taker wallet like working example
        BigInt(orderData.order.makingAmount)
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
   * Run only order creation and print JSON (for comparison with create-order script)
   */
  async runOrderCreationOnly(): Promise<void> {
    console.log('🚀 Starting Order Creation Only (for JSON comparison)');
    console.log('=====================================================');

    try {
      // Step 1: Create order with maker wallet
      const orderData = await this.createOrder();
      console.log('✅ Step 1: Order created successfully');

      // Step 2: Print order in JSON format
      this.printOrderAsJson(orderData);
      console.log('✅ Step 2: Order JSON printed successfully');

      console.log('\n✅ Order creation test completed successfully!');
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      throw error;
    }
  }

  /**
   * Run the complete test
   */
  async  run(): Promise<void> {
    console.log('🚀 Starting Exact Maker Deposit Test');
    console.log('=====================================');

    try {
      // Check wallet balances
      const makerBalance = await this.provider.getBalance(this.makerWallet.address);
      const takerBalance = await this.provider.getBalance(this.takerWallet.address);
      console.log(`💰 Maker wallet balance: ${makerBalance.toString()} wei`);
      console.log(`💰 Taker wallet balance: ${takerBalance.toString()} wei`);

      // Step 1: Create order with maker wallet
      const orderData = await this.createOrder();
      console.log('✅ Step 1: Order created successfully');

      // Step 2: Print order in JSON format for comparison
      this.printOrderAsJson(orderData);

      // Step 3: Wait for one block (like working example)
      // due to LOP check allowedTime > block.timestamp
      console.log(
        'Waiting for one block - before "resolver" starts to execute order'
      );
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Step 4: Test deposit with taker wallet
      await this.testDeposit(orderData);
      console.log('✅ Step 4: Deposit completed successfully');

      console.log('\n✅ Exact maker test completed successfully!');
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const test = new ExactMakerDepositTest();
  
  // Check if we want to run only order creation for JSON comparison
  const args = process.argv.slice(2);
  const orderOnly = args.includes('--order-only');
  
  if (orderOnly) {
    await test.runOrderCreationOnly();
  } else {
    await test.run();
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { ExactMakerDepositTest }; 