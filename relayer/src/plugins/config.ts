import { logger } from '../utils/logger';
import { PluginConfig, ChainConfig } from '../types/plugins';

/**
 * Load plugin configuration from environment variables
 */
export function loadPluginConfig(): PluginConfig[] {
  const configs: PluginConfig[] = [];

  // If USE_DUMMY_PLUGIN is true, only load dummy plugins
  if (process.env['USE_DUMMY_PLUGIN'] === 'true') {
    const dummyChains = process.env['DUMMY_CHAINS'] || '1,137,56'; // Default to common chain IDs
    const dummyChainIds = dummyChains.split(',').map(id => id.trim());
    for (const chainId of dummyChainIds) {
      configs.push({
        type: 'dummy',
        enabled: true,
        config: {
          rpcUrl: `https://dummy-${chainId}.example.com`,
          chainId: chainId,
          chainName: `Dummy Chain ${chainId}`,
          escrowFactoryAddress: '0x0000000000000000000000000000000000000000',
          blockTime: 12,
          confirmations: 12,
          timeout: 30000,
          retries: 3
        }
      });
      logger.info(`Loaded Dummy plugin config for chain ${chainId}`);
    }
    return configs;
  }

  // Ethereum configuration
  const ethereumRpcUrl = process.env['ETHEREUM_RPC_URL'];
  const ethereumChainId = process.env['ETHEREUM_CHAIN_ID'] || '1';
  const ethereumEscrowFactory = process.env['ETHEREUM_ESCROW_FACTORY_ADDRESS'];
  if (ethereumRpcUrl && ethereumEscrowFactory) {
    configs.push({
      type: 'ethereum',
      enabled: process.env['ETHEREUM_ENABLED'] !== 'false',
      config: {
        rpcUrl: ethereumRpcUrl,
        chainId: ethereumChainId,
        chainName: 'Ethereum',
        escrowFactoryAddress: ethereumEscrowFactory,
        blockTime: parseInt(process.env['ETHEREUM_BLOCK_TIME'] || '12'),
        confirmations: parseInt(process.env['ETHEREUM_CONFIRMATIONS'] || '12'),
        timeout: parseInt(process.env['ETHEREUM_TIMEOUT'] || '30000'),
        retries: parseInt(process.env['ETHEREUM_RETRIES'] || '3')
      }
    });
    logger.info(`Loaded Ethereum plugin config for chain ${ethereumChainId}`);
  }

  // TON configuration
  const tonRpcUrl = process.env['TON_RPC_URL'];
  const tonEscrowFactory = process.env['TON_ESCROW_FACTORY_ADDRESS'];
  if (tonRpcUrl && tonEscrowFactory) {
    configs.push({
      type: 'ton',
      enabled: process.env['TON_ENABLED'] !== 'false',
      config: {
        rpcUrl: tonRpcUrl,
        chainId: process.env['TON_CHAIN_ID'] || 'ton',
        chainName: 'TON',
        escrowFactoryAddress: tonEscrowFactory,
        blockTime: parseInt(process.env['TON_BLOCK_TIME'] || '5'),
        confirmations: parseInt(process.env['TON_CONFIRMATIONS'] || '5'),
        timeout: parseInt(process.env['TON_TIMEOUT'] || '30000'),
        retries: parseInt(process.env['TON_RETRIES'] || '3')
      }
    });
    logger.info('Loaded TON plugin config');
  }

  // Custom chain configurations
  const customChains = process.env['CUSTOM_CHAINS'];
  if (customChains) {
    try {
      const customConfigs = JSON.parse(customChains);
      for (const customConfig of customConfigs) {
        if (customConfig.enabled !== false) {
          configs.push({
            type: customConfig.type || 'ethereum',
            enabled: true,
            config: {
              rpcUrl: customConfig.rpcUrl,
              chainId: customConfig.chainId,
              chainName: customConfig.chainName,
              escrowFactoryAddress: customConfig.escrowFactoryAddress,
              blockTime: customConfig.blockTime || 12,
              confirmations: customConfig.confirmations || 12,
              timeout: customConfig.timeout || 30000,
              retries: customConfig.retries || 3
            }
          });
          logger.info(`Loaded custom plugin config for chain ${customConfig.chainId}`);
        }
      }
    } catch (error) {
      logger.error('Failed to parse custom chain configurations:', error);
    }
  }

  if (configs.length === 0) {
    logger.warn('No plugin configurations found. Please set up environment variables for at least one chain.');
  }

  return configs;
}

/**
 * Validate plugin configuration
 */
export function validatePluginConfig(config: PluginConfig): void {
  const { type, config: chainConfig } = config;
  
  // Validate required fields
  const requiredFields = ['rpcUrl', 'chainId', 'chainName', 'escrowFactoryAddress'];
  for (const field of requiredFields) {
    if (!chainConfig[field as keyof ChainConfig]) {
      throw new Error(`Missing required field '${field}' for plugin type: ${type}`);
    }
  }

  // Validate RPC URL format
  if (!chainConfig.rpcUrl.startsWith('http://') && !chainConfig.rpcUrl.startsWith('https://')) {
    throw new Error(`Invalid RPC URL format: ${chainConfig.rpcUrl}`);
  }

  // Validate chain ID
  if (!chainConfig.chainId || chainConfig.chainId.trim() === '') {
    throw new Error('Chain ID cannot be empty');
  }

  // Validate block time and confirmations
  if (chainConfig.blockTime <= 0) {
    throw new Error('Block time must be greater than 0');
  }

  if (chainConfig.confirmations < 0) {
    throw new Error('Confirmations must be non-negative');
  }
}

/**
 * Get default configuration for development
 */
export function getDefaultConfig(): PluginConfig[] {
  return [
    {
      type: 'ethereum',
      enabled: true,
      config: {
        rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY',
        chainId: '1',
        chainName: 'Ethereum',
        escrowFactoryAddress: '0x0000000000000000000000000000000000000000',
        blockTime: 12,
        confirmations: 12,
        timeout: 30000,
        retries: 3
      }
    },
    {
      type: 'ton',
      enabled: true,
      config: {
        rpcUrl: 'https://toncenter.com/api/v2/',
        chainId: 'ton',
        chainName: 'TON',
        escrowFactoryAddress: 'EQ000000000000000000000000000000000000000000000000000000000000000',
        blockTime: 5,
        confirmations: 5,
        timeout: 30000,
        retries: 3
      }
    }
  ];
}

/**
 * Get configuration for specific chain
 */
export function getChainConfig(chainId: string): PluginConfig | undefined {
  const configs = loadPluginConfig();
  return configs.find(config => config.config.chainId === chainId);
}

/**
 * Check if chain is enabled
 */
export function isChainEnabled(chainId: string): boolean {
  const config = getChainConfig(chainId);
  return config?.enabled === true;
}

/**
 * Get all enabled chain IDs
 */
export function getEnabledChainIds(): string[] {
  const configs = loadPluginConfig();
  return configs
    .filter(config => config.enabled)
    .map(config => config.config.chainId);
} 