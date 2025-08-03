import "dotenv/config";
import { randomBytes } from "crypto";
import { Wallet, JsonRpcProvider } from "ethers";
import { writeFileSync } from "fs";
import { join } from "path";
import {
  Address,
  HashLock,
  TimeLocks,
  EvmCrossChainOrder,
  AuctionDetails,
  randBigInt,
  EvmAddress,
  TonAddress,
} from "@1inch/cross-chain-sdk";

const UINT_40_MAX = (1n << 40n) - 1n;

const safeBigInt = (val: string, fallback = 0n): bigint => {
  try {
    return val ? BigInt(val) : fallback;
  } catch {
    return fallback;
  }
};

/**
 * Create order using the working logic from resolver
 */
export async function createOrder(): Promise<any> {
  console.log('🔧 Creating order with working logic...');
  
  // Load config from environment variables (using same names as resolver)
  const config = {
    execution: {
      rpcUrl: process.env['RPC_URL'] || "https://sepolia.infura.io/v3/your-project-id"
    },
    crossChain: {
      escrowFactoryAddress: process.env['ESCROW_FACTORY'] || "0x5e7854fC41247FD537FE45d7Ada070b9Bfba41DA",
      resolverProxyAddress: process.env['RESOLVER_PROXY'] || "0xAa15bcf840eb0454C87710E6578E6C77Cd3DC402",
      sourceNetworkId: parseInt(process.env['SOURCE_NETWORK_ID'] || "11155111"), // Sepolia
      destinationNetworkId: parseInt(process.env['DESTINATION_NETWORK_ID'] || "608"), // TON
    }
  };

  const provider = new JsonRpcProvider(config.execution.rpcUrl);
  
  // Use the EXACT same wallets as working example
  const makerWallet = new Wallet("e9db769d24d997149156061e06424dce78968b6b9d2fef6ef9fbf701bdb3a331"); // Working example's maker
  const takerWallet = new Wallet("7f8d1d2239ec86ad679c74f28afd032d94816eb0b0e43f48c71d4e52a86f7f85", provider); // Working example's taker

  console.log('👤 Maker wallet:', makerWallet.address);
  console.log('👤 Taker wallet:', takerWallet.address);
  
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
    new EvmAddress(new Address(config.crossChain.escrowFactoryAddress)),
    {
      makerAsset: new EvmAddress(new Address(TOKEN_A)), // Working example's maker asset (EVM)
      takerAsset: TOKEN_B, // Working example's taker asset (TON)
      makingAmount: MAKING_AMOUNT,
      takingAmount: TAKING_AMOUNT,
      maker: new EvmAddress(new Address(makerWallet.address)), // Use maker wallet
      receiver: new TonAddress("0QCDScvyElUG1_R9Zm60degE6gUfWBXr-dwmdJasz4D7YwYb"), // Working example's receiver
    },
    {
      hashLock,
      srcChainId: config.crossChain.sourceNetworkId as unknown as any,
      dstChainId: config.crossChain.destinationNetworkId as unknown as any,
      srcSafetyDeposit: SRC_SAFETY_DEPOSIT,
      dstSafetyDeposit: DST_SAFETY_DEPOSIT,
      timeLocks,
    },
    {
      auction: auctionDetails,
      whitelist: [
        {
          address: new EvmAddress(new Address(config.crossChain.resolverProxyAddress)),
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
  const typedData = order.getTypedData(config.crossChain.sourceNetworkId);
  console.log("typedData", typedData);

  const signature = await makerWallet.signTypedData(
    typedData.domain,
    { Order: typedData.types['Order'] as any },
    typedData.message
  );

  const output = {
    order: order.build(),
    extension: order.extension.encode(),
    signature,
    secret,
    hashlock: secretHash,
    orderHash: order.getOrderHash(config.crossChain.sourceNetworkId),
    expirationTime: new Date(Number(order.deadline) * 1000).toISOString(),
    // Additional metadata for comparison with create-order script
    metadata: {
      maker: makerWallet.address,
      taker: takerWallet.address,
      nonce: nonce.toString(),
      chainIds: {
        source: config.crossChain.sourceNetworkId,
        destination: config.crossChain.destinationNetworkId,
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
 * Save order to JSON file
 */
export function saveOrderToFile(orderData: any, filename?: string): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultFilename = `order-${orderData.orderHash}-${timestamp}.json`;
  const finalFilename = filename || defaultFilename;
  
  const filePath = join(process.cwd(), finalFilename);
  
  try {
    writeFileSync(filePath, JSON.stringify(orderData, null, 2), 'utf8');
    console.log(`💾 Order saved to file: ${filePath}`);
    console.log(`📁 File size: ${JSON.stringify(orderData).length} bytes`);
  } catch (error) {
    console.error('❌ Failed to save order to file:', error);
    throw error;
  }
}

/**
 * Print order in JSON format
 */
export function printOrderAsJson(orderData: any): void {
  console.log('\n📄 Order JSON Output (from create-order):');
  console.log('='.repeat(60));
  console.log(JSON.stringify(orderData, null, 2));
  console.log('='.repeat(60));
  console.log('\n✅ Order JSON printed successfully!');
  console.log(`📋 Order Hash: ${orderData.orderHash}`);
  console.log(`⏰ Expires: ${orderData.expirationTime}`);
}

// Main execution function
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const saveToFile = args.includes('--save-to-file');
  const filename = args.find(arg => arg.startsWith('--filename='))?.split('=')[1];
  const showHelp = args.includes('--help') || args.includes('-h');
  
  if (showHelp) {
    console.log('🚀 Create Order Script - Available Flags:');
    console.log('==========================================');
    console.log('--save-to-file        : Save order to JSON file');
    console.log('--filename=<name>     : Custom filename for saved order');
    console.log('--help, -h            : Show this help message');
    console.log('');
    console.log('📝 Examples:');
    console.log('  npx ts-node create-order.ts --save-to-file');
    console.log('  npx ts-node create-order.ts --save-to-file --filename=my-order.json');
    console.log('  npx ts-node create-order.ts');
    console.log('  npx ts-node create-order.ts --help');
    return;
  }
  
  try {
    // Create order
    const orderData = await createOrder();
    console.log('✅ Order created successfully');
    
    // Print order in JSON format
    printOrderAsJson(orderData);
    
    // Save to file if requested
    if (saveToFile) {
      saveOrderToFile(orderData, filename);
    }
    
    console.log('\n✅ Order creation completed successfully!');
  } catch (error) {
    console.error('❌ Order creation failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
} 