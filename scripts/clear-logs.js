const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
require('dotenv').config();

// Database connection
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const db = drizzle(pool);

async function clearAllLogs() {
  try {
    console.log('🗑️  Clearing all audit logs...');
    
    // Clear system activity logs
    const activityResult = await db.execute('DELETE FROM system_activity_logs');
    console.log(`✅ Cleared ${activityResult.length} system activity logs`);
    
    // Clear API request logs
    const apiResult = await db.execute('DELETE FROM api_request_logs');
    console.log(`✅ Cleared ${apiResult.length} API request logs`);
    
    // Clear system events logs
    const eventsResult = await db.execute('DELETE FROM system_events_logs');
    console.log(`✅ Cleared ${eventsResult.length} system events logs`);
    
    console.log('🎉 All logs have been cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing logs:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

clearAllLogs()
  .then(() => {
    console.log('✅ Log clearing completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Log clearing failed:', error);
    process.exit(1);
  });
