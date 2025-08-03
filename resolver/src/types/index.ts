// Order types matching the relayer API
import {Wallet} from "ethers/lib.esm";

export interface Order {
  maker: string;
  makerAsset: string;
  takerAsset: string;
  makerTraits: string; // hashlock
  salt: string;
  makingAmount: string;
  takingAmount: string;
  receiver: string;
  srcChainId?: number;
  dstChainId?: number;
  srcEscrowAddress?: string;
  dstEscrowAddress?: string;
  // Additional fields from relayer database
  extension?: string;
  signature?: string;
  secret?: string;
  secretHash?: string;
}

export interface OrderWithMetadata {
  order: Order;
  orderHash: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  // Fields from relayer response (at top level)
  extension?: string;
  signature?: string;
  secretHash?: string;
}

export interface RelayerOrderResponse {
  success: boolean;
  data?: {
    orders: OrderWithMetadata[];
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

// Oracle price types
export interface OraclePrice {
  token: string;
  price: number;
  timestamp: number;
  source: string;
}

export interface PriceComparison {
  orderPrice: number;
  oraclePrice: number;
  priceDifference: number;
  priceDifferencePercent: number;
  isProfitable: boolean;
  minProfitPercent: number;
}

// Execution types
export interface ExecutionConfig {
  relayerUrl: string;
  minProfitPercent: number;
  maxSlippage: number;
  gasLimit: number;
  gasPrice: string;
  privateKey: string;
  rpcUrl: string;
  chainId: number;
  wallet: Wallet;
}

export interface ExecutionResult {
  success: boolean;
  orderHash: string;
  transactionHash?: string;
  error?: string;
  profit?: number;
  gasUsed?: number;
  executionTime: number;
  additionalTransactions?: {
    tonWithdraw?: string;
    evmWithdraw?: string;
  };
}

export interface EscrowValidationRequest {
  orderHash: string;
  srcEscrowAddress: string;
  dstEscrowAddress: string;
  srcChainId: string;
  dstChainId: string;
}

export interface SecretRequestResponse {
  success: boolean;
  data?: {
    secret: string;
    orderHash: string;
    validationResult?: {
      srcEscrow: any;
      dstEscrow: any;
    };
    sharedAt: string;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// Resolver state types
export interface ResolverState {
  isRunning: boolean;
  lastPollTime: number;
  totalOrdersProcessed: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalProfit: number;
}

// Chain-specific types
export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  escrowFactoryAddress: string;
  resolverProxyAddress: string;
  blockTime: number;
  confirmations: number;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
} 