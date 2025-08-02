import { RelayerService } from './services/relayerService';
import { OracleService } from './services/oracleService';
import { ExecutionService } from './services/executionService';
import { ResolverService } from './services/resolverService';
import { loadConfig, validateConfig, printConfig } from './config';

async function main() {
  try {
    console.log('🚀 Starting MoleSwap Resolver Service...\n');

    // Load and validate configuration
    const config = loadConfig();
    validateConfig(config);
    printConfig(config);

    // Initialize services
    const relayerService = new RelayerService(config.relayer.url);
    const oracleService = new OracleService();
    const executionService = new ExecutionService(config.execution, relayerService, config);
    
    // Initialize resolver service
    const resolverService = new ResolverService(
      relayerService,
      oracleService,
      executionService,
      config
    );

    // Check relayer health
    console.log('🔍 Checking relayer health...');
    const isHealthy = await relayerService.healthCheck();
    if (!isHealthy) {
      throw new Error('Relayer is not healthy. Please ensure the relayer service is running.');
    }
    console.log('✅ Relayer is healthy\n');

    // Check wallet balance
    console.log('💰 Checking wallet balance...');
    const hasBalance = await executionService.checkBalance();
    if (!hasBalance) {
      throw new Error('Insufficient wallet balance for execution. Please fund the wallet.');
    }
    console.log(`✅ Wallet has sufficient balance: ${executionService.getWalletAddress()}\n`);

    // Start the resolver service
    console.log('🎯 Starting order processing...');
    await resolverService.start();

    // Set up graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      resolverService.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      resolverService.stop();
      process.exit(0);
    });

    // Print stats periodically
    setInterval(() => {
      resolverService.printStats();
    }, 60000); // Every minute

  } catch (error) {
    console.error('❌ Failed to start resolver service:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the service
if (require.main === module) {
  main().catch((error) => {
    console.error('Service failed to start:', error);
    process.exit(1);
  });
}

export { ResolverService, RelayerService, OracleService, ExecutionService }; 