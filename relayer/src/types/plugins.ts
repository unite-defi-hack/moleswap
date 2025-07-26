// Base plugin interface for all blockchain chains
export interface ChainPlugin {
  readonly chainId: string;
  readonly chainName: string;
  readonly chainType: 'evm' | 'non-evm';
  
  // Initialize plugin with configuration
  initialize(config: ChainConfig): Promise<void>;
  
  // Validate escrow contract
  validateEscrow(
    escrowAddress: string, 
    orderData: OrderData
  ): Promise<ValidationResult>;
  
  // Get escrow balance
  getEscrowBalance(escrowAddress: string): Promise<bigint>;
  
  // Verify escrow parameters match order
  verifyEscrowParameters(
    escrowAddress: string, 
    expectedParams: EscrowParams
  ): Promise<boolean>;
  
  // Get escrow creation events
  getEscrowEvents(escrowAddress: string): Promise<EscrowEvent[]>;
  
  // Health check
  isHealthy(): Promise<boolean>;
  
  // Get plugin status
  getStatus(): PluginStatus;
}

// Configuration for chain plugins
export interface ChainConfig {
  rpcUrl: string;
  chainId: string;
  chainName: string;
  escrowFactoryAddress: string;
  blockTime: number;
  confirmations: number;
  timeout?: number;
  retries?: number;
}

// Order data for validation
export interface OrderData {
  maker: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: string;
  takingAmount: string;
  hashlock: string;
  timelock?: number;
}

// Escrow parameters to verify
export interface EscrowParams {
  maker: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: string;
  takingAmount: string;
  hashlock: string;
  timelock: number;
}

// Validation result from escrow validation
export interface ValidationResult {
  valid: boolean;
  balance?: bigint;
  error?: string;
  details?: any;
  chainId: string;
  escrowAddress: string;
}

// Escrow event data
export interface EscrowEvent {
  eventName: string;
  blockNumber: number;
  transactionHash: string;
  blockHash: string;
  logIndex: number;
  args: any;
  timestamp: number;
}

// Plugin status
export interface PluginStatus {
  chainId: string;
  chainName: string;
  status: 'healthy' | 'unhealthy' | 'initializing';
  lastCheck: Date;
  error?: string;
  details?: any;
}

// Plugin registry interface
export interface PluginRegistry {
  // Register a plugin
  register(plugin: ChainPlugin): void;
  
  // Get plugin by chain ID
  getPlugin(chainId: string): ChainPlugin | undefined;
  
  // Get all registered plugins
  getAllPlugins(): ChainPlugin[];
  
  // Get all plugin statuses
  getAllPluginStatuses(): PluginStatus[];
  
  // Load plugins from configuration
  loadPlugins(config: PluginConfig[]): Promise<void>;
  
  // Health check all plugins
  healthCheck(): Promise<PluginStatus[]>;
}

// Plugin configuration for loading
export interface PluginConfig {
  type: 'ethereum' | 'ton' | 'custom' | 'dummy';
  config: ChainConfig;
  enabled: boolean;
}

// Plugin factory interface
export interface PluginFactory {
  createPlugin(type: string, config: ChainConfig): Promise<ChainPlugin>;
}

// Error types for plugins
export enum PluginErrorCode {
  PLUGIN_NOT_FOUND = 'PLUGIN_NOT_FOUND',
  PLUGIN_INITIALIZATION_FAILED = 'PLUGIN_INITIALIZATION_FAILED',
  CHAIN_NOT_SUPPORTED = 'CHAIN_NOT_SUPPORTED',
  RPC_CONNECTION_FAILED = 'RPC_CONNECTION_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_ESCROW_ADDRESS = 'INVALID_ESCROW_ADDRESS',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  PARAMETER_MISMATCH = 'PARAMETER_MISMATCH'
}

// Plugin error interface
export interface PluginError {
  code: PluginErrorCode;
  message: string;
  chainId?: string;
  details?: any;
} 