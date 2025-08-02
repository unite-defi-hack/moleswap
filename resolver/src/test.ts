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
    const resolver = new ResolverService(relayerService, oracleService, executionService, config);

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

    // Test depositToSrcEscrow method
    console.log('\n🔍 Testing depositToSrcEscrow...');
    await testDepositToSrcEscrow(executionService);

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

async function testDepositToSrcEscrow(executionService: ExecutionService) {
  console.log('Testing depositToSrcEscrow method...');
  
  // Create a mock order with complete data (including extension and signature)
  const mockOrder = {
    maker: '0x71078879cd9a1d7987b74cee6b6c0d130f1a0115',
    makerAsset: '0x10563e509b718a279de002dfc3e94a8a8f642b03',
    takerAsset: '0x0000000000000000000000000000000000000000',
    makerTraits: '0x1234567890123456789012345678901234567890123456789012345678901234', // mock hashlock
    salt: '123456789',
    makingAmount: '881220000000000',
    takingAmount: '200000000',
    receiver: '0QCDScvyElUG1_R9Zm60degE6gUfWBXr-dwmdJasz4D7YwYb',
    // Add the required fields for EVM adapter
    extension: '', // Empty extension to test fallback
    signature: '', // Empty signature to test fallback
  };

  const orderHash = '0x1234567890123456789012345678901234567890123456789012345678901234';
  
  try {
    console.log('Mock order data:', {
      maker: mockOrder.maker,
      makerAsset: mockOrder.makerAsset,
      takerAsset: mockOrder.takerAsset,
      makingAmount: mockOrder.makingAmount,
      takingAmount: mockOrder.takingAmount,
      receiver: mockOrder.receiver,
      makerTraits: mockOrder.makerTraits,
      extension: mockOrder.extension ? 'present' : 'missing',
      signature: mockOrder.signature ? 'present' : 'missing',
    });

    // Call the depositToSrcEscrow method
    const result = await (executionService as any).depositToSrcEscrow(mockOrder, orderHash);
    
    console.log('✅ depositToSrcEscrow completed successfully!');
    console.log('Result:', {
      escrowAddress: result.escrowAddress,
      transactionHash: result.transactionHash,
      blockHash: result.blockHash,
      blockTimestamp: result.blockTimestamp,
    });
    
  } catch (error) {
    console.error('❌ depositToSrcEscrow failed:', error);
  }
}

export { testResolver }; 