import "dotenv/config";
import { createOrder } from './create-order';

/**
 * Send order to relayer API
 */
async function sendOrderToRelayer(orderData: any): Promise<void> {
  const relayerUrl = process.env['RELAYER_URL'] || 'http://localhost:3000';
  
  console.log('🚀 Sending order to relayer...');
  console.log(`📡 Relayer URL: ${relayerUrl}`);
  
  // Convert our order format to relayer's expected format
  const relayerOrderData = {
    completeOrder: {
      order: {
        maker: orderData.order.maker,
        makerAsset: orderData.order.makerAsset,
        takerAsset: orderData.order.takerAsset,
        makerTraits: orderData.order.makerTraits, // Use the decimal makerTraits from SDK
        salt: orderData.order.salt,
        makingAmount: orderData.order.makingAmount,
        takingAmount: orderData.order.takingAmount,
        receiver: orderData.order.receiver,
      },
      extension: orderData.extension,
      signature: orderData.signature,
      secret: orderData.secret,
      secretHash: orderData.hashlock, // Use hex hashlock for secret validation
    }
  };

  console.log('📋 Converting order format for relayer...');
  console.log('🔍 Order data to send:', {
    maker: relayerOrderData.completeOrder.order.maker,
    makerAsset: relayerOrderData.completeOrder.order.makerAsset,
    takerAsset: relayerOrderData.completeOrder.order.takerAsset,
    makingAmount: relayerOrderData.completeOrder.order.makingAmount,
    takingAmount: relayerOrderData.completeOrder.order.takingAmount,
    orderHash: orderData.orderHash,
  });

  try {
    const response = await fetch(`${relayerUrl}/api/orders/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(relayerOrderData),
    });

    const result = await response.json() as any;
    
    if (response.ok) {
      console.log('✅ Order successfully sent to relayer!');
      console.log('📊 Response:', {
        success: result.success,
        orderHash: result.data?.orderHash,
        status: result.data?.status,
        createdAt: result.data?.createdAt,
      });
    } else {
      console.error('❌ Failed to send order to relayer');
      console.error('📊 Error response:', result);
      
      if (result.error) {
        console.error('🔍 Error details:', {
          code: result.error.code,
          message: result.error.message,
          details: result.error.details,
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Network error when sending order to relayer:', error);
    throw error;
  }
}

/**
 * Main function to create order and send to relayer
 */
async function main() {
  try {
    console.log('🔧 Creating order and sending to relayer...');
    console.log('='.repeat(60));
    
    // Step 1: Create order
    const orderData = await createOrder();
    console.log('✅ Step 1: Order created successfully');
    
    // Step 2: Send to relayer
    await sendOrderToRelayer(orderData);
    console.log('✅ Step 2: Order sent to relayer successfully');
    
    console.log('\n🎉 Complete! Order created and stored in relayer database.');
    console.log(`📋 Order Hash: ${orderData.orderHash}`);
    console.log(`⏰ Expires: ${orderData.expirationTime}`);
    
  } catch (error) {
    console.error('❌ Failed to create and send order:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { sendOrderToRelayer }; 