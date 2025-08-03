import { db } from '../src/database/connection';

async function deleteAllOrders() {
  try {
    console.log('🗑️  Deleting all orders from database...');
    
    const result = await db('orders').del();
    
    console.log(`✅ Successfully deleted ${result} orders from database`);
    
    // Verify deletion
    const remainingOrders = await db('orders').count('* as count').first();
    const count = remainingOrders ? Number(remainingOrders['count']) : 0;
    
    console.log(`📊 Remaining orders in database: ${count}`);
    
  } catch (error) {
    console.error('❌ Error deleting orders:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

deleteAllOrders().catch(console.error); 