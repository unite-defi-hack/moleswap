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
  private failedOrders: Map<string, { attempts: number; lastAttempt: number }> = new Map();

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
        // Get order statistics
        const stats = await this.getOrderStats();
        console.log(`📊 Pulling new orders... (completed: ${stats.completed}, active: ${stats.active})`);
        
        const orders = await this.relayerService.getProcessableOrders(maxOrdersPerPoll, 0);
        
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
   * Validate if an order should be processed
   */
  private validateOrderForProcessing(order: OrderWithMetadata): boolean {
    // Skip completed or cancelled orders
    if (order.status === 'completed' || order.status === 'cancelled') {
      console.log(`Skipping order ${order.orderHash} - status: ${order.status}`);
      return false;
    }
    
    // Only process active or pending orders
    if (order.status !== 'active' && order.status !== 'pending') {
      console.log(`Skipping order ${order.orderHash} - invalid status: ${order.status}`);
      return false;
    }
    
    // Check if order has required data
    if (!order.extension || !order.signature) {
      console.log(`Skipping order ${order.orderHash} - missing extension or signature`);
      return false;
    }
    
    return true;
  }

  /**
   * Check if an order should be retried after a failure
   */
  private shouldRetryOrder(orderHash: string): boolean {
    const failedOrder = this.failedOrders.get(orderHash);
    if (!failedOrder) {
      return true; // First attempt
    }
    
    const maxAttempts = 3;
    const retryDelayMs = 10000; // 10 seconds
    const now = Date.now();
    
    if (failedOrder.attempts >= maxAttempts) {
      console.log(`Order ${orderHash} has exceeded max retry attempts (${maxAttempts}), skipping`);
      return false;
    }
    
    if (now - failedOrder.lastAttempt < retryDelayMs) {
      console.log(`Order ${orderHash} was recently attempted, waiting before retry...`);
      return false;
    }
    
    return true;
  }

  /**
   * Record a failed order attempt
   */
  private recordFailedOrder(orderHash: string): void {
    const failedOrder = this.failedOrders.get(orderHash);
    const now = Date.now();
    
    if (failedOrder) {
      failedOrder.attempts++;
      failedOrder.lastAttempt = now;
    } else {
      this.failedOrders.set(orderHash, { attempts: 1, lastAttempt: now });
    }
    
    console.log(`📝 Recorded failed attempt for order ${orderHash} (attempt ${this.failedOrders.get(orderHash)?.attempts})`);
  }

  /**
   * Clear failed order record on success
   */
  private clearFailedOrder(orderHash: string): void {
    this.failedOrders.delete(orderHash);
    console.log(`✅ Cleared failed order record for ${orderHash} (successful execution)`);
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
      
      // Validate order before processing
      if (!this.validateOrderForProcessing(order)) {
        console.log('✅ Skipped invalid order, stopping resolver...');
        process.exit(0);
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
            this.clearFailedOrder(order.orderHash); // Clear failed record on success
          } else {
            this.state.failedExecutions++;
            console.error(`Failed to execute order ${order.orderHash}: ${result.error}`);
            this.recordFailedOrder(order.orderHash); // Record failed attempt
          }
        } else {
          console.log(`Order ${order.orderHash} is not profitable, skipping`);
        }
      } catch (error) {
        console.error(`Error processing order ${order.orderHash}:`, error);
        this.state.failedExecutions++;
        this.recordFailedOrder(order.orderHash); // Record failed attempt
      }
      
      console.log('✅ Processed one order, stopping resolver...');
      process.exit(0);
    }

    // Normal processing for multiple orders
    for (const order of orders) {
      if (!this.isRunning) break;

      // Validate order before processing
      if (!this.validateOrderForProcessing(order)) {
        continue; // Skip to next order
      }

      // Check if order should be retried
      if (!this.shouldRetryOrder(order.orderHash)) {
        continue; // Skip to next order
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
            this.clearFailedOrder(order.orderHash); // Clear failed record on success
          } else {
            this.state.failedExecutions++;
            console.error(`Failed to execute order ${order.orderHash}: ${result.error}`);
            this.recordFailedOrder(order.orderHash); // Record failed attempt
          }
        } else {
          console.log(`Order ${order.orderHash} is not profitable, skipping`);
        }
      } catch (error) {
        console.error(`Error processing order ${order.orderHash}:`, error);
        this.state.failedExecutions++;
        this.recordFailedOrder(order.orderHash); // Record failed attempt
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
   * Get all processable orders (active and pending)
   */
  async getAllProcessableOrders(): Promise<OrderWithMetadata[]> {
    return this.relayerService.getProcessableOrders();
  }

  /**
   * Get order statistics from relayer
   */
  private async getOrderStats(): Promise<{ completed: number; active: number }> {
    try {
      // Get all orders to count by status
      const allOrders = await this.relayerService.getOrders(100, 0); // Get up to 100 orders
      
      const stats = {
        completed: 0,
        active: 0
      };
      
      allOrders.forEach(order => {
        if (order.status === 'completed') {
          stats.completed++;
        } else if (order.status === 'active') {
          stats.active++;
        }
      });
      
      return stats;
    } catch (error) {
      console.error('Error getting order stats:', error);
      return { completed: 0, active: 0 };
    }
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