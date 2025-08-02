import dotenv from 'dotenv';
import { ExecutionConfig } from './types';

// Load environment variables
dotenv.config();

export interface ResolverConfig {
  relayer: {
    url: string;
    timeout: number;
  };
  execution: ExecutionConfig;
  oracle: {
    minProfitPercent: number;
    updateInterval: number;
  };
  polling: {
    interval: number;
    maxOrdersPerPoll: number;
    processOneOrderAndStop: boolean;
  };
  chains: {
    supported: number[];
    defaultSrcChain: number;
    defaultDstChain: number;
  };
  // Cross-chain specific configuration
  crossChain: {
    sourceNetworkId: number;
    destinationNetworkId: number;
    lopAddress: string;
    escrowFactoryAddress: string;
    erc20MockAddress: string;
    resolverProxyAddress: string;
    takerPrivateKey: string;
    rpcUrl: string;
    // TON configuration
    tonLopAddress: string;
    tonTakerAddress: string;
    tonApiKey: string;
    tonTakerMnemonic: string;
  };
}

export function loadConfig(): ResolverConfig {
  return {
    relayer: {
      url: process.env.RELAYER_URL || 'http://localhost:3000',
      timeout: parseInt(process.env.RELAYER_TIMEOUT || '30000')
    },
    execution: {
      relayerUrl: process.env.RELAYER_URL || 'http://localhost:3000',
      minProfitPercent: parseFloat(process.env.MIN_PROFIT_PERCENT || '1.0'),
      maxSlippage: parseFloat(process.env.MAX_SLIPPAGE || '0.5'),
      gasLimit: parseInt(process.env.GAS_LIMIT || '500000'),
      gasPrice: process.env.GAS_PRICE || 'auto',
      privateKey: process.env.TAKER_PRIV || '',
      rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
      chainId: parseInt(process.env.SOURCE_NETWORK_ID || '11155111'),
      wallet: null as any // Will be initialized in ExecutionService constructor
    },
    oracle: {
      minProfitPercent: parseFloat(process.env.MIN_PROFIT_PERCENT || '1.0'),
      updateInterval: parseInt(process.env.ORACLE_UPDATE_INTERVAL || '60000') // 1 minute
    },
    polling: {
      interval: parseInt(process.env.POLLING_INTERVAL || '10000'), // 10 seconds
      maxOrdersPerPoll: parseInt(process.env.MAX_ORDERS_PER_POLL || '5'),
      processOneOrderAndStop: process.env.PROCESS_ONE_ORDER_AND_STOP === 'true'
    },
    chains: {
      supported: [11155111, 608], // Sepolia, TON
      defaultSrcChain: parseInt(process.env.SOURCE_NETWORK_ID || '11155111'),
      defaultDstChain: parseInt(process.env.DESTINATION_NETWORK_ID || '608')
    },
    crossChain: {
      sourceNetworkId: parseInt(process.env.SOURCE_NETWORK_ID || '11155111'),
      destinationNetworkId: parseInt(process.env.DESTINATION_NETWORK_ID || '608'),
      lopAddress: process.env.LOP || '',
      escrowFactoryAddress: process.env.ESCROW_FACTORY || '',
      erc20MockAddress: process.env.ERC20_MOCK || '',
      resolverProxyAddress: process.env.RESOLVER_PROXY || '',
      takerPrivateKey: process.env.TAKER_PRIV || '',
      rpcUrl: process.env.RPC_URL || '',
      tonLopAddress: process.env.TON_LOP_ADDRESS || '',
      tonTakerAddress: process.env.TON_TAKER_ADDRESS || '',
      tonApiKey: process.env.TON_API_KEY || '',
      tonTakerMnemonic: process.env.TON_TAKER_MNEMONIC || ''
    }
  };
}

export function validateConfig(config: ResolverConfig): void {
  const errors: string[] = [];

  if (!config.execution.privateKey) {
    errors.push('TAKER_PRIV is required');
  }

  if (!config.execution.rpcUrl) {
    errors.push('RPC_URL is required');
  }

  if (config.execution.minProfitPercent < 0) {
    errors.push('MIN_PROFIT_PERCENT must be >= 0');
  }

  if (config.polling.interval < 1000) {
    errors.push('POLLING_INTERVAL must be >= 1000ms');
  }

  if (config.relayer.url === '') {
    errors.push('RELAYER_URL is required');
  }

  // Cross-chain validation
  if (!config.crossChain.lopAddress) {
    errors.push('LOP is required');
  }

  if (!config.crossChain.escrowFactoryAddress) {
    errors.push('ESCROW_FACTORY is required');
  }

  if (!config.crossChain.erc20MockAddress) {
    errors.push('ERC20_MOCK is required');
  }

  if (!config.crossChain.resolverProxyAddress) {
    errors.push('RESOLVER_PROXY is required');
  }



  if (!config.crossChain.takerPrivateKey) {
    errors.push('TAKER_PRIV is required');
  }

  if (!config.crossChain.rpcUrl) {
    errors.push('RPC_URL is required');
  }

  // TON validation
  if (!config.crossChain.tonLopAddress) {
    errors.push('TON_LOP_ADDRESS is required');
  }

  if (!config.crossChain.tonTakerAddress) {
    errors.push('TON_TAKER_ADDRESS is required');
  }

  if (!config.crossChain.tonApiKey) {
    errors.push('TON_API_KEY is required');
  }

  if (!config.crossChain.tonTakerMnemonic) {
    errors.push('TON_TAKER_MNEMONIC is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

export function printConfig(config: ResolverConfig): void {
  console.log('\n=== MoleSwap Resolver Configuration ===');
  console.log(`Relayer URL: ${config.relayer.url}`);
  console.log(`RPC URL: ${config.execution.rpcUrl}`);
  console.log(`Chain ID: ${config.execution.chainId}`);
  console.log(`Min Profit %: ${config.execution.minProfitPercent}%`);
  console.log(`Max Slippage: ${config.execution.maxSlippage}%`);
  console.log(`Gas Limit: ${config.execution.gasLimit}`);
  console.log(`Polling Interval: ${config.polling.interval}ms`);
  console.log(`Max Orders Per Poll: ${config.polling.maxOrdersPerPoll}`);
  console.log(`Supported Chains: ${config.chains.supported.join(', ')}`);
  console.log('\n--- Cross-Chain Configuration ---');
  console.log(`Source Network: ${config.crossChain.sourceNetworkId} (Sepolia)`);
  console.log(`Destination Network: ${config.crossChain.destinationNetworkId} (TON)`);
  console.log(`LOP Address: ${config.crossChain.lopAddress}`);
  console.log(`Escrow Factory: ${config.crossChain.escrowFactoryAddress}`);

  console.log(`TON LOP Address: ${config.crossChain.tonLopAddress}`);
  console.log(`TON Taker Address: ${config.crossChain.tonTakerAddress}`);
  console.log('========================================\n');
} 