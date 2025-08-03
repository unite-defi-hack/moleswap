import "dotenv/config";
import { Wallet, JsonRpcProvider } from "ethers";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  EvmCrossChainOrder,
  Extension,
} from "@1inch/cross-chain-sdk";
import { loadConfig } from './config';

/**
 * Test that loads an order from JSON file and executes deposit
 */
class DepositFromJsonTest {
  private config: any;
  private provider: JsonRpcProvider;
  private takerWallet: Wallet;

  constructor() {
    this.config = loadConfig();
    this.provider = new JsonRpcProvider(this.config.execution.rpcUrl);
    
    // Use the same taker wallet as working example
    this.takerWallet = new Wallet("7f8d1d2239ec86ad679c74f28afd032d94816eb0b0e43f48c71d4e52a86f7f85", this.provider);
  }

  /**
   * Load order from JSON file
   */
  loadOrderFromFile(filename: string): any {
    console.log(`📁 Loading order from file: ${filename}`);
    
    const filePath = join(process.cwd(), filename);
    
    if (!existsSync(filePath)) {
      throw new Error(`Order file not found: ${filePath}`);
    }
    
    try {
      const fileContent = readFileSync(filePath, 'utf8');
      const orderData = JSON.parse(fileContent);
      
      console.log('✅ Order loaded successfully from file');
      console.log(`📋 Order Hash: ${orderData.orderHash}`);
      console.log(`⏰ Expires: ${orderData.expirationTime}`);
      console.log(`👤 Maker: ${orderData.metadata?.maker || 'Unknown'}`);
      console.log(`💰 Making Amount: ${orderData.metadata?.amounts?.making || 'Unknown'}`);
      console.log(`💰 Taking Amount: ${orderData.metadata?.amounts?.taking || 'Unknown'}`);
      
      return orderData;
    } catch (error) {
      console.error('❌ Failed to load order from file:', error);
      throw error;
    }
  }

  /**
   * Validate order data structure
   */
  validateOrderData(orderData: any): void {
    console.log('🔍 Validating order data structure...');
    
    const requiredFields = ['order', 'extension', 'signature', 'orderHash'];
    const missingFields = requiredFields.filter(field => !orderData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields in order data: ${missingFields.join(', ')}`);
    }
    
    console.log('✅ Order data validation passed');
  }

  /**
   * Test deposit with the loaded order using taker wallet
   */
  async testDeposit(orderData: any): Promise<void> {
    console.log(`\n🚀 Testing deposit with loaded order: ${orderData.orderHash}`);
    
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

      // Re-create the order object from loaded data
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

      // Check wallet balance before deposit
      const takerBalance = await this.provider.getBalance(this.takerWallet.address);
      console.log(`💰 Taker wallet balance: ${takerBalance.toString()} wei`);

      // Execute deposit using taker wallet
      console.log("🚀 Executing deposit to source escrow...");
      
      const depositResult = await evmAdapter.deployAndDepositToSrcEscrow(
        evmOrder,
        orderData.signature,
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

    } catch (error) {
      console.error('❌ Deposit failed:', error);
      throw error;
    }
  }

  /**
   * Run the complete test with loaded order
   */
  async run(filename: string): Promise<void> {
    console.log('🚀 Starting Deposit From JSON Test');
    console.log('==================================');

    try {
      // Step 1: Load order from JSON file
      const orderData = this.loadOrderFromFile(filename);
      console.log('✅ Step 1: Order loaded successfully');

      // Step 2: Validate order data structure
      this.validateOrderData(orderData);
      console.log('✅ Step 2: Order validation passed');

      // Step 3: Wait for one block (like working example)
      // due to LOP check allowedTime > block.timestamp
      console.log(
        'Waiting for one block - before "resolver" starts to execute order'
      );
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Step 4: Test deposit with taker wallet
      await this.testDeposit(orderData);
      console.log('✅ Step 4: Deposit completed successfully');

      console.log('\n✅ Deposit from JSON test completed successfully!');
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      throw error;
    }
  }

  /**
   * List available order files in current directory
   */
  listOrderFiles(): void {
    console.log('📁 Available order files in current directory:');
    console.log('==============================================');
    
    const fs = require('fs');
    const files = fs.readdirSync(process.cwd());
    const orderFiles = files.filter((file: string) => file.endsWith('.json') && file.includes('order'));
    
    if (orderFiles.length === 0) {
      console.log('❌ No order files found. Create one first with:');
      console.log('   npx ts-node src/test-deposit-exact-maker.ts --order-only --save-to-file');
    } else {
      orderFiles.forEach((file: string, index: number) => {
        const stats = fs.statSync(file);
        const size = (stats.size / 1024).toFixed(2);
        console.log(`${index + 1}. ${file} (${size} KB)`);
      });
    }
  }
}

// Main execution
async function main() {
  const test = new DepositFromJsonTest();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const filename = args[0];
  const showHelp = args.includes('--help') || args.includes('-h');
  const listFiles = args.includes('--list') || args.includes('-l');
  
  if (showHelp) {
    console.log('🚀 Deposit From JSON Test - Usage:');
    console.log('===================================');
    console.log('npx ts-node src/test-deposit-from-json.ts <filename>');
    console.log('');
    console.log('📝 Arguments:');
    console.log('  <filename>           : JSON file containing order data');
    console.log('  --list, -l           : List available order files');
    console.log('  --help, -h           : Show this help message');
    console.log('');
    console.log('📝 Examples:');
    console.log('  npx ts-node src/test-deposit-from-json.ts order-abc123.json');
    console.log('  npx ts-node src/test-deposit-from-json.ts --list');
    console.log('  npx ts-node src/test-deposit-from-json.ts --help');
    console.log('');
    console.log('📝 To create an order file first:');
    console.log('  npx ts-node src/test-deposit-exact-maker.ts --order-only --save-to-file');
    return;
  }
  
  if (listFiles) {
    test.listOrderFiles();
    return;
  }
  
  if (!filename) {
    console.error('❌ Error: Please provide a filename');
    console.log('');
    console.log('📝 Usage: npx ts-node src/test-deposit-from-json.ts <filename>');
    console.log('📝 Use --help for more information');
    process.exit(1);
  }
  
  await test.run(filename);
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { DepositFromJsonTest }; 