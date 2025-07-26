import { logger } from '../utils/logger';
import { ChainPlugin, ChainConfig } from '../types/plugins';
import { PluginFactory } from './registry';
import { DummyPlugin } from './dummy';

export class PluginFactoryImpl implements PluginFactory {
  /**
   * Create a plugin instance based on type
   */
  async createPlugin(type: string, config: ChainConfig): Promise<ChainPlugin> {
    logger.info(`Creating plugin of type: ${type} for chain: ${config.chainId}`);
    
    switch (type.toLowerCase()) {
      case 'ethereum':
      case 'evm':
      case 'dummy':
        return new DummyPlugin();
        
      case 'ton':
        // TODO: Implement TON plugin
        throw new Error('TON plugin not implemented yet');
        
      default:
        throw new Error(`Unsupported plugin type: ${type}`);
    }
  }

  /**
   * Get supported plugin types
   */
  getSupportedTypes(): string[] {
    return ['ethereum', 'evm', 'dummy', 'ton'];
  }

  /**
   * Validate plugin configuration
   */
  validateConfig(type: string, config: ChainConfig): void {
    const requiredFields = ['rpcUrl', 'chainId', 'chainName', 'escrowFactoryAddress'];
    
    for (const field of requiredFields) {
      if (!config[field as keyof ChainConfig]) {
        throw new Error(`Missing required field '${field}' for plugin type: ${type}`);
      }
    }

    // Validate RPC URL format
    if (!config.rpcUrl.startsWith('http://') && !config.rpcUrl.startsWith('https://')) {
      throw new Error(`Invalid RPC URL format: ${config.rpcUrl}`);
    }

    // Validate chain ID
    if (!config.chainId || config.chainId.trim() === '') {
      throw new Error('Chain ID cannot be empty');
    }

    // Validate block time and confirmations
    if (config.blockTime <= 0) {
      throw new Error('Block time must be greater than 0');
    }

    if (config.confirmations < 0) {
      throw new Error('Confirmations must be non-negative');
    }
  }
} 