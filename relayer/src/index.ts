import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
// import rateLimit from 'express-rate-limit'; // Disabled for development/testing
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { initializeDatabase } from './database/connection';
import { orderRoutes } from './routes/orders';
import { secretRoutes } from './routes/secrets';
import { pluginRoutes } from './routes/plugins';
import { 
  PluginRegistryImpl, 
  PluginFactoryImpl, 
  loadPluginConfig 
} from './plugins';

// Load environment variables
dotenv.config();

export function createApp() {
  const app = express();
  const port = process.env['PORT'] || 3000;

  // Initialize plugin system
  const pluginFactory = new PluginFactoryImpl();
  const pluginRegistry = new PluginRegistryImpl(pluginFactory);

  // Security middleware
  app.use(helmet());
  app.use(cors());

  // Rate limiting disabled for development/testing
  // const limiter = rateLimit({
  //   windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'), // 15 minutes
  //   max: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100'), // limit each IP to 100 requests per windowMs
  //   message: 'Too many requests from this IP, please try again later.',
  // });
  // app.use(limiter);

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    next();
  });

  // Health check endpoint
  app.get('/health', async (_req, res) => {
    try {
      const pluginStatuses = pluginRegistry.getAllPluginStatuses();
      const healthyPlugins = pluginStatuses.filter(s => s.status === 'healthy').length;
      const totalPlugins = pluginStatuses.length;
      
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        plugins: {
          total: totalPlugins,
          healthy: healthyPlugins,
          unhealthy: totalPlugins - healthyPlugins
        }
      });
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(500).json({ 
        status: 'error', 
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });

  // Make plugin registry available to routes
  app.set('pluginRegistry', pluginRegistry);

  // API routes
  app.use('/api/orders', orderRoutes);
  app.use('/api/secrets', secretRoutes);
  app.use('/api/plugins', pluginRoutes);

  // Error handling middleware
  app.use(errorHandler);

  // 404 handler
  app.use('*', (_req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  return { app, pluginRegistry, port };
}

// Only start server if not in test environment
if (process.env['NODE_ENV'] !== 'test') {
  (async () => {
    try {
      // Initialize database
      await initializeDatabase();
      logger.info('Database initialized successfully');

      // Create app and plugin registry
      const { app, pluginRegistry, port } = createApp();

      // Load and initialize plugins
      const pluginConfigs = loadPluginConfig();
      await pluginRegistry.loadPlugins(pluginConfigs);
      logger.info('Plugins initialized successfully');

      // Start server
      app.listen(port, () => {
        logger.info(`Server running on port ${port}`);
        logger.info(`Environment: ${process.env['NODE_ENV']}`);
        logger.info(`Loaded ${pluginRegistry.getAllPlugins().length} plugins`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  })();
} else {
  // In test environment, just initialize the database without starting server
  initializeDatabase().catch((error) => {
    logger.error('Failed to initialize database for tests:', error);
    process.exit(1);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
}); 