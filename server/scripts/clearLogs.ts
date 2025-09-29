import { db } from '../db';
import { systemActivityLogs, apiRequestLogs, systemEventsLogs } from '../../shared/schema';

async function clearAllLogs() {
  try {
    console.log('🗑️  Clearing all audit logs...');
    
    // Truncate all log tables
    await db.delete(systemActivityLogs);
    console.log('✅ Cleared system activity logs');
    
    await db.delete(apiRequestLogs);
    console.log('✅ Cleared API request logs');
    
    await db.delete(systemEventsLogs);
    console.log('✅ Cleared system events logs');
    
    console.log('🎉 All logs have been cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing logs:', error);
    throw error;
  }
}

// Run the script
clearAllLogs()
  .then(() => {
    console.log('✅ Log clearing completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Log clearing failed:', error);
    process.exit(1);
  });
