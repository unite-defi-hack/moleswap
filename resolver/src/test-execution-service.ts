import "dotenv/config";
import { Wallet, JsonRpcProvider } from "ethers";
import axios from "axios";
import { loadConfig } from './config';
import { ExecutionService } from './services/executionService';
import { RelayerService } from './services/relayerService';
import { OrderWithMetadata } from './types';

/**
 * Test the updated ExecutionService with automatic profitable order execution
 */
class ExecutionServiceTest {
  private config: any;
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  private relayerUrl: string;
  private executionService: ExecutionService;
  private relayerService: RelayerService;

  constructor() {
    this.config = loadConfig();
    this.provider = new JsonRpcProvider(this.config.execution.rpcUrl);
    this.wallet = new Wallet(this.config.execution.privateKey, this.provider);
    this.relayerUrl = process.env.RELAYER_URL || 'http://localhost:3000';
    
    // Initialize services
    this.relayerService = new RelayerService(this.relayerUrl);
    this.executionService = new ExecutionService(
      this.config.execution,
      this.relayerService,
      this.config
    );
  }

  /**
   * Load orders from relayer and test execution
   */
  async testExecutionService(): Promise<void> {
    console.log('🚀 Testing ExecutionService with automatic profitable order execution');
    console.log('==============================================================');

    try {
      // Check wallet balance
      const balance = await this.provider.getBalance(this.wallet.address);
      console.log(`💰 Wallet balance: ${balance.toString()} wei`);

      // Load orders from relayer
      console.log('📁 Loading orders from relayer...');
      const orders = await this.loadOrdersFromRelayer();
      
      if (orders.length === 0) {
        console.log('⚠️ No orders found in relayer');
        return;
      }

      console.log(`📊 Found ${orders.length} orders to check for profitability`);

      // Test profitability check for each order
      console.log('🔍 Checking orders for profitability...');
      for (const orderWithMetadata of orders) {
        const { order } = orderWithMetadata;
        const isProfitable = await this.executionService.isOrderProfitable(order);
        
        console.log(`Order ${orderWithMetadata.orderHash}: ${isProfitable ? '💰 Profitable' : '❌ Not profitable'}`);
      }

      // Execute profitable orders automatically
      console.log('🚀 Executing profitable orders automatically...');
      const results = await this.executionService.executeProfitableOrders(orders);

      // Summary
      console.log('\n📊 Execution Summary:');
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      console.log(`✅ Successful executions: ${successful.length}`);
      console.log(`❌ Failed executions: ${failed.length}`);
      
      if (successful.length > 0) {
        console.log('\n🎉 Successful executions:');
        successful.forEach(result => {
          console.log(`- ${result.orderHash}: Profit=${result.profit}, Time=${result.executionTime}ms`);
          if (result.additionalTransactions) {
            console.log(`  TON Withdraw: ${result.additionalTransactions.tonWithdraw}`);
            console.log(`  EVM Withdraw: ${result.additionalTransactions.evmWithdraw}`);
          }
        });
      }

      if (failed.length > 0) {
        console.log('\n❌ Failed executions:');
        failed.forEach(result => {
          console.log(`- ${result.orderHash}: ${result.error}`);
        });
      }

    } catch (error) {
      console.error('❌ Test failed:', error);
      throw error;
    }
  }

  /**
   * Load orders from relayer
   */
  async loadOrdersFromRelayer(): Promise<OrderWithMetadata[]> {
    try {
      const response = await axios.get(`${this.relayerUrl}/api/orders?status=active&limit=10`);
      const result = response.data;

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to load orders from relayer');
      }

      return result.data.orders;
    } catch (error) {
      console.error('❌ Failed to load orders from relayer:', error);
      throw error;
    }
  }

  /**
   * Test with a specific order hash
   */
  async testWithSpecificOrder(orderHash: string): Promise<void> {
    console.log(`🚀 Testing ExecutionService with specific order: ${orderHash}`);
    
    try {
      // Load specific order from relayer
      const response = await axios.get(`${this.relayerUrl}/api/orders?orderHash=${orderHash}`);
      const result = response.data;

      if (!result.success || !result.data || result.data.orders.length === 0) {
        throw new Error(`Order not found: ${orderHash}`);
      }

      const orderWithMetadata = result.data.orders[0]!;
      
      // Check profitability
      const isProfitable = await this.executionService.isOrderProfitable(orderWithMetadata.order);
      console.log(`💰 Order profitability: ${isProfitable ? 'Profitable' : 'Not profitable'}`);

      if (isProfitable) {
        // Execute the order
        console.log('🚀 Executing profitable order...');
        const result = await this.executionService.executeOrder(orderWithMetadata);
        
        console.log('📊 Execution result:', {
          success: result.success,
          profit: result.profit,
          executionTime: result.executionTime,
          additionalTransactions: result.additionalTransactions
        });
      } else {
        console.log('❌ Order is not profitable - skipping execution');
      }

    } catch (error) {
      console.error('❌ Test with specific order failed:', error);
      throw error;
    }
  }

  /**
   * Test complete execution flow bypassing profitability check
   */
  async testCompleteExecutionFlow(orderHash: string): Promise<void> {
    console.log(`🚀 Testing complete execution flow (bypassing profitability): ${orderHash}`);
    
    try {
      // Load specific order from relayer
      const response = await axios.get(`${this.relayerUrl}/api/orders?orderHash=${orderHash}`);
      const result = response.data;

      if (!result.success || !result.data || result.data.orders.length === 0) {
        throw new Error(`Order not found: ${orderHash}`);
      }

      const orderWithMetadata = result.data.orders[0]!;
      
      // Execute the order directly (bypassing profitability check)
      console.log('🚀 Executing order (bypassing profitability check)...');
      const executionResult = await this.executionService.executeOrder(orderWithMetadata);
      
      console.log('📊 Complete execution result:', {
        success: executionResult.success,
        profit: executionResult.profit,
        executionTime: executionResult.executionTime,
        additionalTransactions: executionResult.additionalTransactions
      });

      if (executionResult.success) {
        console.log('🎉 Complete cross-chain atomic swap executed successfully!');
      } else {
        console.log('❌ Execution failed:', executionResult.error);
      }

    } catch (error) {
      console.error('❌ Complete execution flow test failed:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const test = new ExecutionServiceTest();
  
  if (command === 'specific' && args[1]) {
    // Test with specific order hash
    await test.testWithSpecificOrder(args[1]);
  } else if (command === 'complete' && args[1]) {
    // Test complete execution flow (bypassing profitability)
    await test.testCompleteExecutionFlow(args[1]);
  } else {
    // Test with all orders
    await test.testExecutionService();
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { ExecutionServiceTest }; 