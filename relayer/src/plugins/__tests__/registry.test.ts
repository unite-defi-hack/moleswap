import { PluginRegistryImpl } from '../registry';
import { PluginFactoryImpl } from '../factory';
import { DummyPlugin } from '../dummy';
import { ChainConfig } from '../../types/plugins';

// Mock factory for testing
class MockPluginFactory implements PluginFactoryImpl {
  async createPlugin(type: string, _config: ChainConfig): Promise<any> {
    switch (type) {
      case 'ethereum':
      case 'dummy':
        return new DummyPlugin();
      case 'ton':
        // TODO: Implement TON plugin
        throw new Error('TON plugin not implemented yet');
      default:
        throw new Error(`Unsupported plugin type: ${type}`);
    }
  }

  getSupportedTypes(): string[] {
    return ['ethereum', 'ton'];
  }

  validateConfig(_type: string, config: ChainConfig): void {
    // Basic validation
    if (!config.rpcUrl || !config.chainId) {
      throw new Error('Invalid config');
    }
  }
}

describe('PluginRegistry', () => {
  let registry: PluginRegistryImpl;
  let factory: MockPluginFactory;

  beforeEach(() => {
    factory = new MockPluginFactory();
    registry = new PluginRegistryImpl(factory);
  });

  describe('Plugin Registration', () => {
    it('should register plugins correctly', async () => {
      const dummyPlugin = new DummyPlugin();
      await dummyPlugin.initialize({
        rpcUrl: 'https://test.com',
        chainId: '1',
        chainName: 'Test Chain',
        escrowFactoryAddress: '0x1234567890123456789012345678901234567890',
        blockTime: 12,
        confirmations: 12
      });
      registry.register(dummyPlugin);

      expect(registry.getAllPlugins()).toHaveLength(1);
      expect(registry.getPlugin('1')).toBe(dummyPlugin);
    });

    it('should get plugin by chain ID', async () => {
      const dummyPlugin = new DummyPlugin();
      await dummyPlugin.initialize({
        rpcUrl: 'https://test.com',
        chainId: '1',
        chainName: 'Test Chain',
        escrowFactoryAddress: '0x1234567890123456789012345678901234567890',
        blockTime: 12,
        confirmations: 12
      });
      registry.register(dummyPlugin);

      const retrieved = registry.getPlugin('1');
      expect(retrieved).toBe(dummyPlugin);
    });

    it('should return undefined for non-existent plugin', () => {
      const plugin = registry.getPlugin('999');
      expect(plugin).toBeUndefined();
    });
  });

  describe('Plugin Status', () => {
    it('should track plugin statuses', async () => {
      const dummyPlugin = new DummyPlugin();
      await dummyPlugin.initialize({
        rpcUrl: 'https://test.com',
        chainId: '1',
        chainName: 'Test Chain',
        escrowFactoryAddress: '0x1234567890123456789012345678901234567890',
        blockTime: 12,
        confirmations: 12
      });
      registry.register(dummyPlugin);

      const statuses = registry.getAllPluginStatuses();
      expect(statuses).toHaveLength(1);
      expect(statuses[0]?.chainId).toBe('1');
      expect(statuses[0]?.status).toBe('initializing');
    });
  });

  describe('Chain Support', () => {
    it('should check if chain is supported', async () => {
      const dummyPlugin = new DummyPlugin();
      await dummyPlugin.initialize({
        rpcUrl: 'https://test.com',
        chainId: '1',
        chainName: 'Test Chain',
        escrowFactoryAddress: '0x1234567890123456789012345678901234567890',
        blockTime: 12,
        confirmations: 12
      });
      registry.register(dummyPlugin);

      expect(registry.isChainSupported('1')).toBe(true);
      expect(registry.isChainSupported('999')).toBe(false);
    });

    it('should get supported chain IDs', async () => {
      const dummyPlugin = new DummyPlugin();
      await dummyPlugin.initialize({
        rpcUrl: 'https://test.com',
        chainId: '1',
        chainName: 'Test Chain',
        escrowFactoryAddress: '0x1234567890123456789012345678901234567890',
        blockTime: 12,
        confirmations: 12
      });
      
      registry.register(dummyPlugin);

      const supportedChains = registry.getSupportedChainIds();
      expect(supportedChains).toContain('1');
    });
  });

  describe('Plugin Loading', () => {
    it('should load plugins from configuration', async () => {
      const configs = [
        {
          type: 'ethereum' as const,
          enabled: true,
          config: {
            rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/test',
            chainId: '1',
            chainName: 'Ethereum',
            escrowFactoryAddress: '0x1234567890123456789012345678901234567890',
            blockTime: 12,
            confirmations: 12
          }
        }
      ];

      await registry.loadPlugins(configs);
      
      expect(registry.getAllPlugins()).toHaveLength(1);
      expect(registry.isChainSupported('1')).toBe(true);
    });

    it('should skip disabled plugins', async () => {
      const configs = [
        {
          type: 'ethereum' as const,
          enabled: false,
          config: {
            rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/test',
            chainId: '1',
            chainName: 'Ethereum',
            escrowFactoryAddress: '0x1234567890123456789012345678901234567890',
            blockTime: 12,
            confirmations: 12
          }
        }
      ];

      await registry.loadPlugins(configs);
      
      expect(registry.getAllPlugins()).toHaveLength(0);
    });
  });

  describe('Health Checks', () => {
    it('should perform health checks on all plugins', async () => {
      const dummyPlugin = new DummyPlugin();
      await dummyPlugin.initialize({
        rpcUrl: 'https://test.com',
        chainId: '1',
        chainName: 'Test Chain',
        escrowFactoryAddress: '0x1234567890123456789012345678901234567890',
        blockTime: 12,
        confirmations: 12
      });
      registry.register(dummyPlugin);

      const statuses = await registry.healthCheck();
      
      expect(statuses).toHaveLength(1);
      expect(statuses[0]?.chainId).toBe('1');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent plugin', () => {
      expect(() => {
        registry.getPluginOrThrow('999');
      }).toThrow('Plugin not found for chain ID: 999');
    });

    it('should validate required plugins', async () => {
      const dummyPlugin = new DummyPlugin();
      await dummyPlugin.initialize({
        rpcUrl: 'https://test.com',
        chainId: '1',
        chainName: 'Test Chain',
        escrowFactoryAddress: '0x1234567890123456789012345678901234567890',
        blockTime: 12,
        confirmations: 12
      });
      registry.register(dummyPlugin);

      // Should not throw
      registry.validateRequiredPlugins(['1']);

      // Should throw
      expect(() => {
        registry.validateRequiredPlugins(['999']);
      }).toThrow('Missing required plugins for chains: 999');
    });
  });
}); 