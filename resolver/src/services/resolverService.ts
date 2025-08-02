import { RelayerService } from './relayerService';
import { OracleService } from './oracleService';
import { ExecutionService } from './executionService';
import { 
  OrderWithMetadata, 
  ExecutionConfig, 
  ExecutionResult, 
  ResolverState,
  PriceComparison
} from '../types';
import { ResolverConfig } from '../config';

export class ResolverService {
  private relayerService: RelayerService;
  private oracleService: OracleService;
  private executionService: ExecutionService;
  private state: ResolverState;
  private isRunning: boolean = false;
  private config: ResolverConfig;

  constructor(
    relayerService: RelayerService,
    oracleService: OracleService,
    executionService: ExecutionService,
    config: ResolverConfig
  ) {
    this.relayerService = relayerService;
    this.oracleService = oracleService;
    this.executionService = executionService;
    this.config = config;
    this.state = {
      isRunning: false,
      lastPollTime: 0,
      totalOrdersProcessed: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalProfit: 0
    };
  }

  /**
   * Start the resolver service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Resolver service is already running');
      return;
    }

    console.log('Starting MoleSwap Resolver Service...');
    
    // Check relayer health
    const isHealthy = await this.relayerService.healthCheck();
    if (!isHealthy) {
      throw new Error('Relayer is not healthy');
    }

    // Check wallet balance
    const hasBalance = await this.executionService.checkBalance();
    if (!hasBalance) {
      throw new Error('Insufficient wallet balance for execution');
    }

    this.isRunning = true;
    this.state.isRunning = true;
    this.state.lastPollTime = Date.now();

    console.log(`Resolver service started. Wallet: ${this.executionService.getWalletAddress()}`);
    
    // Start polling for orders
    await this.startPolling();
  }

  /**
   * Stop the resolver service
   */
  stop(): void {
    console.log('Stopping MoleSwap Resolver Service...');
    this.isRunning = false;
    this.state.isRunning = false;
  }

  /**
   * Get current resolver state
   */
  getState(): ResolverState {
    return { ...this.state };
  }

  /**
   * Start polling for orders
   */
  private async startPolling(): Promise<void> {
    const pollInterval = this.config.polling.interval;
    const maxOrdersPerPoll = this.config.polling.maxOrdersPerPoll;

    console.log(`Starting to poll for orders every ${pollInterval}ms`);

    while (this.isRunning) {
      try {
        const orders = await this.relayerService.getActiveOrders(maxOrdersPerPoll, 0);
        
        if (orders.length > 0) {
          console.log(`Found ${orders.length} active orders`);
          await this.processOrders(orders);
        }

        this.state.lastPollTime = Date.now();
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error('Error during order polling:', error);
        // Wait longer on error
        await new Promise(resolve => setTimeout(resolve, pollInterval * 2));
      }
    }
  }

  /**
   * Process a batch of orders
   */
  private async processOrders(orders: OrderWithMetadata[]): Promise<void> {
    // If configured to process only one order and stop
    if (this.config.polling.processOneOrderAndStop && orders.length > 0) {
      console.log('🔍 PROCESS_ONE_ORDER_AND_STOP enabled - processing only first order');
      const order = orders[0];
      
      if (!order) {
        console.error('No order found to process');
        return;
      }
      
      try {
        this.state.totalOrdersProcessed++;
        
        // Check profitability
        const isProfitable = await this.checkOrderProfitability(order);
        
        if (isProfitable) {
          console.log(`Order ${order.orderHash} is profitable, executing...`);
          
          const result = await this.executionService.executeOrder(order);
          
          if (result.success) {
            this.state.successfulExecutions++;
            this.state.totalProfit += result.profit || 0;
            console.log(`Successfully executed order ${order.orderHash}. Profit: ${result.profit}`);
          } else {
            this.state.failedExecutions++;
            console.error(`Failed to execute order ${order.orderHash}: ${result.error}`);
          }
        } else {
          console.log(`Order ${order.orderHash} is not profitable, skipping`);
        }
      } catch (error) {
        console.error(`Error processing order ${order.orderHash}:`, error);
        this.state.failedExecutions++;
      }
      
      console.log('✅ Processed one order, stopping resolver...');
      process.exit(0);
    }

    // Normal processing for multiple orders
    for (const order of orders) {
      if (!this.isRunning) break;

      try {
        this.state.totalOrdersProcessed++;
        
        // Check profitability
        const isProfitable = await this.checkOrderProfitability(order);
        
        if (isProfitable) {
          console.log(`Order ${order.orderHash} is profitable, executing...`);
          
          const result = await this.executionService.executeOrder(order);
          
          if (result.success) {
            this.state.successfulExecutions++;
            this.state.totalProfit += result.profit || 0;
            console.log(`Successfully executed order ${order.orderHash}. Profit: ${result.profit}`);
          } else {
            this.state.failedExecutions++;
            console.error(`Failed to execute order ${order.orderHash}: ${result.error}`);
          }
        } else {
          console.log(`Order ${order.orderHash} is not profitable, skipping`);
        }
      } catch (error) {
        console.error(`Error processing order ${order.orderHash}:`, error);
        this.state.failedExecutions++;
      }
    }
  }

  /**
   * Check if an order is profitable
   */
  private async checkOrderProfitability(order: OrderWithMetadata): Promise<boolean> {
    try {
      const { makerAsset, takerAsset, makingAmount, takingAmount } = order.order;
      
      console.log(`Checking profitability for order ${order.orderHash}:`, {
        makerAsset,
        takerAsset,
        makingAmount,
        takingAmount
      });
      
      const priceComparison = await this.oracleService.checkProfitability(
        makerAsset,
        takerAsset,
        makingAmount,
        takingAmount,
        1.0 // Minimum 1% profit
      );

      console.log(`Price comparison for order ${order.orderHash}:`, {
        orderPrice: priceComparison.orderPrice,
        oraclePrice: priceComparison.oraclePrice,
        priceDifferencePercent: priceComparison.priceDifferencePercent,
        isProfitable: priceComparison.isProfitable
      });

      return priceComparison.isProfitable;
    } catch (error) {
      console.error(`Error checking profitability for order ${order.orderHash}:`, error);
      return false;
    }
  }

  /**
   * Execute a single order (for testing)
   */
  async executeSingleOrder(orderHash: string): Promise<ExecutionResult | null> {
    try {
      const order = await this.relayerService.getOrderByHash(orderHash);
      
      if (!order) {
        console.error(`Order ${orderHash} not found`);
        return null;
      }

      const isProfitable = await this.checkOrderProfitability(order);
      
      if (!isProfitable) {
        console.log(`Order ${orderHash} is not profitable`);
        return null;
      }

      return await this.executionService.executeOrder(order);
    } catch (error) {
      console.error(`Error executing single order ${orderHash}:`, error);
      return null;
    }
  }

  /**
   * Get orders for specific chain pair
   */
  async getOrdersForChainPair(srcChainId: number, dstChainId: number): Promise<OrderWithMetadata[]> {
    return this.relayerService.getOrdersByChainPair(srcChainId, dstChainId);
  }

  /**
   * Get all active orders
   */
  async getAllActiveOrders(): Promise<OrderWithMetadata[]> {
    return this.relayerService.getActiveOrders();
  }

  /**
   * Get price comparison for an order
   */
  async getPriceComparison(order: OrderWithMetadata): Promise<PriceComparison> {
    const { makerAsset, takerAsset, makingAmount, takingAmount } = order.order;
    
    return this.oracleService.checkProfitability(
      makerAsset,
      takerAsset,
      makingAmount,
      takingAmount,
      1.0
    );
  }

  /**
   * Print resolver statistics
   */
  printStats(): void {
    console.log('\n=== MoleSwap Resolver Statistics ===');
    console.log(`Status: ${this.state.isRunning ? 'Running' : 'Stopped'}`);
    console.log(`Last Poll: ${new Date(this.state.lastPollTime).toISOString()}`);
    console.log(`Total Orders Processed: ${this.state.totalOrdersProcessed}`);
    console.log(`Successful Executions: ${this.state.successfulExecutions}`);
    console.log(`Failed Executions: ${this.state.failedExecutions}`);
    console.log(`Total Profit: ${this.state.totalProfit.toFixed(6)}`);
    console.log(`Success Rate: ${this.state.totalOrdersProcessed > 0 ? 
      ((this.state.successfulExecutions / this.state.totalOrdersProcessed) * 100).toFixed(2) : 0}%`);
    console.log('=====================================\n');
  }
} 