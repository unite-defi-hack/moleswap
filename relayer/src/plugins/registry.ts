import { logger } from '../utils/logger';
import {
  ChainPlugin,
  PluginRegistry,
  PluginConfig,
  PluginStatus
} from '../types/plugins';

export class PluginRegistryImpl implements PluginRegistry {
  private plugins: Map<string, ChainPlugin> = new Map();
  private pluginStatuses: Map<string, PluginStatus> = new Map();
  private factory: PluginFactory;

  constructor(factory: PluginFactory) {
    this.factory = factory;
  }

  /**
   * Register a plugin with the registry
   */
  register(plugin: ChainPlugin): void {
    this.plugins.set(plugin.chainId, plugin);
    logger.info(`Plugin registered: ${plugin.chainName} (${plugin.chainId})`);
    
    // Initialize status
    this.pluginStatuses.set(plugin.chainId, {
      chainId: plugin.chainId,
      chainName: plugin.chainName,
      status: 'initializing',
      lastCheck: new Date()
    });
  }

  /**
   * Get plugin by chain ID
   */
  getPlugin(chainId: string): ChainPlugin | undefined {
    return this.plugins.get(chainId);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): ChainPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all plugin statuses
   */
  getAllPluginStatuses(): PluginStatus[] {
    return Array.from(this.pluginStatuses.values());
  }

  /**
   * Load plugins from configuration
   */
  async loadPlugins(configs: PluginConfig[]): Promise<void> {
    logger.info(`Loading ${configs.length} plugins from configuration`);
    
    for (const config of configs) {
      if (!config.enabled) {
        logger.info(`Skipping disabled plugin: ${config.type} (${config.config.chainId})`);
        continue;
      }

      try {
        const plugin = await this.factory.createPlugin(config.type, config.config);
        await plugin.initialize(config.config);
        this.register(plugin);
        
        // Perform initial health check
        const isHealthy = await plugin.isHealthy();
        this.updatePluginStatus(plugin.chainId, isHealthy ? 'healthy' : 'unhealthy');
        
        logger.info(`Plugin loaded successfully: ${plugin.chainName} (${plugin.chainId})`);
      } catch (error) {
        logger.error(`Failed to load plugin ${config.type}:`, error);
        this.updatePluginStatus(config.config.chainId, 'unhealthy', error as Error);
      }
    }
  }

  /**
   * Health check all plugins
   */
  async healthCheck(): Promise<PluginStatus[]> {
    logger.info('Performing health check on all plugins');
    
    const healthChecks = Array.from(this.plugins.values()).map(async (plugin) => {
      try {
        const isHealthy = await plugin.isHealthy();
        this.updatePluginStatus(plugin.chainId, isHealthy ? 'healthy' : 'unhealthy');
        return this.pluginStatuses.get(plugin.chainId)!;
      } catch (error) {
        logger.error(`Health check failed for plugin ${plugin.chainId}:`, error);
        this.updatePluginStatus(plugin.chainId, 'unhealthy', error as Error);
        return this.pluginStatuses.get(plugin.chainId)!;
      }
    });

    return Promise.all(healthChecks);
  }

  /**
   * Update plugin status
   */
  private updatePluginStatus(
    chainId: string, 
    status: 'healthy' | 'unhealthy' | 'initializing', 
    error?: Error
  ): void {
    const currentStatus = this.pluginStatuses.get(chainId);
    if (currentStatus) {
      currentStatus.status = status;
      currentStatus.lastCheck = new Date();
      if (error) {
        currentStatus.error = error.message;
        currentStatus.details = {
          stack: error.stack,
          name: error.name
        };
      } else {
        delete currentStatus.error;
        delete currentStatus.details;
      }
    }
  }

  /**
   * Get plugin by chain ID with error handling
   */
  getPluginOrThrow(chainId: string): ChainPlugin {
    const plugin = this.getPlugin(chainId);
    if (!plugin) {
      throw new Error(`Plugin not found for chain ID: ${chainId}`);
    }
    return plugin;
  }

  /**
   * Check if a chain is supported
   */
  isChainSupported(chainId: string): boolean {
    return this.plugins.has(chainId);
  }

  /**
   * Get supported chain IDs
   */
  getSupportedChainIds(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Get healthy plugins only
   */
  getHealthyPlugins(): ChainPlugin[] {
    return this.getAllPlugins().filter(plugin => {
      const status = this.pluginStatuses.get(plugin.chainId);
      return status?.status === 'healthy';
    });
  }

  /**
   * Validate that all required plugins are loaded
   */
  validateRequiredPlugins(requiredChainIds: string[]): void {
    const missingChains = requiredChainIds.filter(chainId => !this.isChainSupported(chainId));
    
    if (missingChains.length > 0) {
      throw new Error(`Missing required plugins for chains: ${missingChains.join(', ')}`);
    }
  }
}

// Plugin factory interface
export interface PluginFactory {
  createPlugin(type: string, config: any): Promise<ChainPlugin>;
} 