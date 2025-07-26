import { Router } from 'express';
import { logger } from '../utils/logger';
import { PluginRegistryImpl } from '../plugins';

const router = Router();

// Get all plugin statuses
router.get('/status', async (req, res) => {
  try {
    // Get plugin registry from app context
    const pluginRegistry = (req.app as any).pluginRegistry as PluginRegistryImpl;
    
    if (!pluginRegistry) {
      res.status(500).json({
        success: false,
        error: {
          code: 'PLUGIN_SYSTEM_NOT_AVAILABLE',
          message: 'Plugin system not initialized'
        }
      });
      return;
    }

    const statuses = pluginRegistry.getAllPluginStatuses();
    
    res.json({
      success: true,
      data: {
        plugins: statuses,
        total: statuses.length,
        healthy: statuses.filter(s => s.status === 'healthy').length,
        unhealthy: statuses.filter(s => s.status === 'unhealthy').length
      }
    });
    return;
  } catch (error) {
    logger.error('Failed to get plugin statuses:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get plugin statuses'
      }
    });
    return;
  }
});

// Health check all plugins
router.post('/health-check', async (req, res) => {
  try {
    const pluginRegistry = (req.app as any).pluginRegistry as PluginRegistryImpl;
    
    if (!pluginRegistry) {
      res.status(500).json({
        success: false,
        error: {
          code: 'PLUGIN_SYSTEM_NOT_AVAILABLE',
          message: 'Plugin system not initialized'
        }
      });
      return;
    }

    const statuses = await pluginRegistry.healthCheck();
    
    res.json({
      success: true,
      data: {
        plugins: statuses,
        total: statuses.length,
        healthy: statuses.filter(s => s.status === 'healthy').length,
        unhealthy: statuses.filter(s => s.status === 'unhealthy').length
      }
    });
    return;
  } catch (error) {
    logger.error('Failed to perform plugin health check:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to perform plugin health check'
      }
    });
    return;
  }
});

// Get supported chains
router.get('/chains', async (req, res) => {
  try {
    const pluginRegistry = (req.app as any).pluginRegistry as PluginRegistryImpl;
    
    if (!pluginRegistry) {
      res.status(500).json({
        success: false,
        error: {
          code: 'PLUGIN_SYSTEM_NOT_AVAILABLE',
          message: 'Plugin system not initialized'
        }
      });
      return;
    }

    const plugins = pluginRegistry.getAllPlugins();
    const chains = plugins.map(plugin => ({
      chainId: plugin.chainId,
      name: plugin.chainName,
      type: plugin.chainType,
      status: plugin.getStatus().status
    }));
    
    res.json({
      success: true,
      data: {
        chains,
        total: chains.length,
        supported: chains.length
      }
    });
    return;
  } catch (error) {
    logger.error('Failed to get supported chains:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get supported chains'
      }
    });
    return;
  }
});

// Validate escrow on specific chain
router.post('/validate-escrow/:chainId', async (req, res) => {
  try {
    const { chainId } = req.params;
    const { escrowAddress, orderData } = req.body;

    if (!escrowAddress || !orderData) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: escrowAddress, orderData'
        }
      });
      return;
    }

    const pluginRegistry = (req.app as any).pluginRegistry as PluginRegistryImpl;
    
    if (!pluginRegistry) {
      res.status(500).json({
        success: false,
        error: {
          code: 'PLUGIN_SYSTEM_NOT_AVAILABLE',
          message: 'Plugin system not initialized'
        }
      });
      return;
    }

    const plugin = pluginRegistry.getPlugin(chainId);
    if (!plugin) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CHAIN_NOT_SUPPORTED',
          message: `Chain ${chainId} is not supported`,
          details: {
            chainId,
            supportedChains: pluginRegistry.getSupportedChainIds()
          }
        }
      });
      return;
    }

    const validationResult = await plugin.validateEscrow(escrowAddress, orderData);
    
    res.json({
      success: true,
      data: validationResult
    });
    return;
  } catch (error) {
    logger.error('Failed to validate escrow:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Failed to validate escrow',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
    return;
  }
});

export { router as pluginRoutes }; 