import { logger } from '../utils/logger';
import {
  ChainPlugin,
  ChainConfig,
  OrderData,
  EscrowParams,
  ValidationResult,
  EscrowEvent,
  PluginStatus
} from '../types/plugins';

export class DummyPlugin implements ChainPlugin {
  public readonly chainType: 'evm' = 'evm';
  
  private _chainId: string = '';
  private _chainName: string = '';
  private status: PluginStatus = {
    chainId: '',
    chainName: '',
    status: 'initializing',
    lastCheck: new Date()
  };

  get chainId(): string {
    return this._chainId;
  }

  get chainName(): string {
    return this._chainName;
  }

  /**
   * Initialize the plugin with configuration
   */
  async initialize(config: ChainConfig): Promise<void> {
    logger.info(`Initializing Dummy plugin for chain: ${config.chainId}`);
    
    this._chainId = config.chainId;
    this._chainName = config.chainName;
    
    // Simulate initialization delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.status = {
      chainId: this.chainId,
      chainName: this.chainName,
      status: 'healthy',
      lastCheck: new Date()
    };
    
    logger.info(`Dummy plugin initialized for ${this.chainName} (${this.chainId})`);
  }

  /**
   * Validate escrow contract (dummy implementation)
   */
  async validateEscrow(escrowAddress: string, orderData: OrderData): Promise<ValidationResult> {
    logger.info(`Dummy escrow validation for ${escrowAddress} on chain ${this.chainId}`);
    
    // Simulate validation delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // For dummy plugin, always return valid with mock balance
    const mockBalance = BigInt('1000000000000000000'); // 1 ETH in wei
    
    return {
      valid: true,
      balance: mockBalance,
      chainId: this.chainId,
      escrowAddress,
      details: {
        maker: orderData.maker,
        makerAsset: orderData.makerAsset,
        takerAsset: orderData.takerAsset,
        makingAmount: orderData.makingAmount,
        takingAmount: orderData.takingAmount,
        hashlock: orderData.hashlock,
        validationType: 'dummy'
      }
    };
  }

  /**
   * Get escrow balance (dummy implementation)
   */
  async getEscrowBalance(escrowAddress: string): Promise<bigint> {
    logger.info(`Dummy balance check for ${escrowAddress} on chain ${this.chainId}`);
    
    // Simulate RPC call delay
    await new Promise(resolve => setTimeout(resolve, 30));
    
    // Return mock balance
    return BigInt('1000000000000000000'); // 1 ETH in wei
  }

  /**
   * Verify escrow parameters match expected values (dummy implementation)
   */
  async verifyEscrowParameters(escrowAddress: string, _expectedParams: EscrowParams): Promise<boolean> {
    logger.info(`Dummy parameter verification for ${escrowAddress} on chain ${this.chainId}`);
    
    // Simulate verification delay
    await new Promise(resolve => setTimeout(resolve, 40));
    
    // For dummy plugin, always return true
    return true;
  }

  /**
   * Get escrow creation events (dummy implementation)
   */
  async getEscrowEvents(escrowAddress: string): Promise<EscrowEvent[]> {
    logger.info(`Dummy event retrieval for ${escrowAddress} on chain ${this.chainId}`);
    
    // Simulate event retrieval delay
    await new Promise(resolve => setTimeout(resolve, 60));
    
    // Return mock events
    return [
      {
        eventName: 'EscrowCreated',
        blockNumber: 12345678,
        transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        blockHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        logIndex: 0,
        args: {
          maker: '0x1234567890123456789012345678901234567890',
          makerAsset: '0x1234567890123456789012345678901234567890',
          takerAsset: '0x0987654321098765432109876543210987654321',
          makingAmount: '1000000000000000000',
          takingAmount: '2000000000000000000',
          hashlock: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          timelock: 1234567890
        },
        timestamp: Date.now()
      }
    ];
  }

  /**
   * Health check (dummy implementation)
   */
  async isHealthy(): Promise<boolean> {
    // Simulate health check delay
    await new Promise(resolve => setTimeout(resolve, 20));
    
    // For dummy plugin, always return healthy
    this.status = {
      ...this.status,
      status: 'healthy',
      lastCheck: new Date()
    };
    
    return true;
  }

  /**
   * Get plugin status
   */
  getStatus(): PluginStatus {
    return this.status;
  }
} 