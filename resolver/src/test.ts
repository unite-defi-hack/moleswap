import { RelayerService } from './services/relayerService';
import { OracleService } from './services/oracleService';
import { ExecutionService } from './services/executionService';
import { ResolverService } from './services/resolverService';
import { loadConfig } from './config';

async function testResolver() {
  console.log('🧪 Testing MoleSwap Resolver Service...\n');

  try {
    // Load configuration
    const config = loadConfig();
    
    // Initialize services
    const relayerService = new RelayerService(config.relayer.url);
    const oracleService = new OracleService();
    const executionService = new ExecutionService(config.execution, relayerService, config);
    
    // Initialize resolver
    const resolver = new ResolverService(relayerService, oracleService, executionService);

    console.log('✅ Services initialized successfully');

    // Test oracle service
    console.log('\n🔍 Testing Oracle Service...');
    const mockToken = '0x10563e509b718a279de002dfc3e94a8a8f642b03';
    const price = await oracleService.getPrice(mockToken);
    console.log(`Mock token price: $${price?.price}`);

    // Test profitability check
    const profitability = await oracleService.checkProfitability(
      mockToken,
      '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c',
      '1000000000000000000', // 1 token
      '2000000000000000000', // 2 tokens
      1.0
    );
    console.log('Profitability check:', profitability);

    // Test relayer service (if relayer is running)
    console.log('\n🔍 Testing Relayer Service...');
    try {
      const isHealthy = await relayerService.healthCheck();
      console.log(`Relayer health: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
      
      if (isHealthy) {
        const orders = await relayerService.getActiveOrders(5, 0);
        console.log(`Found ${orders.length} active orders`);
        
        if (orders.length > 0) {
          const firstOrder = orders[0];
          if (firstOrder) {
            console.log('Sample order:', {
              orderHash: firstOrder.orderHash,
              maker: firstOrder.order.maker,
              status: firstOrder.status
            });
          }
        }
      }
    } catch (error) {
      console.log('⚠️  Relayer not available (expected for testing)');
    }

    // Test execution service
    console.log('\n🔍 Testing Execution Service...');
    const walletAddress = executionService.getWalletAddress();
    console.log(`Wallet address: ${walletAddress}`);
    
    const gasPrice = await executionService.getGasPrice();
    console.log(`Current gas price: ${gasPrice} wei`);

    // Test TON adapter
    console.log('\n🔍 Testing TON Adapter...');
    const { TonAdapter } = require('./services/tonAdapter');
    
    const tonNetworkInfo = TonAdapter.getTonNetworkInfo();
    console.log(`TON Network: ${tonNetworkInfo.name} (Chain ID: ${tonNetworkInfo.chainId})`);
    
    const isValidTonAddress = TonAdapter.isValidTonAddress(config.crossChain.tonTakerAddress);
    console.log(`TON Taker Address Valid: ${isValidTonAddress}`);
    
    const tonBalance = await TonAdapter.getTonBalance(config.crossChain.tonTakerAddress);
    console.log(`TON Balance: ${tonBalance} TON`);

    // Test resolver statistics
    console.log('\n📊 Resolver Statistics:');
    resolver.printStats();

    console.log('\n✅ All tests completed successfully!');
    console.log('\nTo start the full resolver service:');
    console.log('npm start');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testResolver().catch(console.error);
}

export { testResolver }; 