require('dotenv').config();
const { Pool } = require('pg');

async function checkAdminPassword() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

  try {
    console.log('🔍 Checking admin user password...');
    console.log('=' .repeat(60));

    // Get admin user details
    const { rows: users } = await pool.query(
      'SELECT email, first_name, last_name, password, role, created_at, updated_at, last_password_change FROM users WHERE email = $1',
      ['admin@taskflow.com']
    );

    if (users.length === 0) {
      console.log('❌ Admin user not found in database');
      return;
    }

    const user = users[0];
    console.log(`✅ Found admin user: ${user.first_name} ${user.last_name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Password hash: ${user.password}`);
    console.log(`   Is properly hashed: ${user.password.startsWith('$2b$') || user.password.startsWith('$2a$')}`);
    console.log(`   Created at: ${user.created_at}`);
    console.log(`   Updated at: ${user.updated_at}`);
    console.log(`   Last password change: ${user.last_password_change || 'Never'}`);

    console.log('\n' + '=' .repeat(60));
    console.log('ℹ️  Note: The actual password cannot be retrieved from the hash.');
    console.log('   If you forgot the password, use fix-user-password.js to reset it.');

  } catch (error) {
    console.error('❌ Error checking admin password:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  checkAdminPassword();
}
