require('dotenv').config();
const { Pool } = require('pg');

async function checkUserLogin() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/check-user-login.js "email@example.com"');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

  try {
    console.log(`🔍 Checking user account for: ${email}`);
    console.log('=' .repeat(60));

    // Get user details
    const { rows: users } = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (users.length === 0) {
      console.log('❌ User not found in database');
      return;
    }

    const user = users[0];
    console.log('✅ User found!');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   First Name: ${user.first_name || 'Not set'}`);
    console.log(`   Last Name: ${user.last_name || 'Not set'}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Is Active: ${user.is_active}`);
    console.log(`   Last Login: ${user.last_login_at || 'Never'}`);
    console.log(`   Created At: ${user.created_at}`);
    console.log(`   Updated At: ${user.updated_at}`);
    
    console.log('\n🔐 Password Information:');
    console.log(`   Password Hash: ${user.password ? 'Set' : 'Not set'}`);
    console.log(`   Password starts with $2b$: ${user.password ? user.password.startsWith('$2b$') : 'N/A'}`);
    console.log(`   Temporary Password: ${user.temporary_password ? 'Set' : 'Not set'}`);
    console.log(`   Must Change Password: ${user.must_change_password}`);
    console.log(`   Password Generated At: ${user.password_generated_at || 'Not set'}`);
    console.log(`   Last Password Change: ${user.last_password_change || 'Not set'}`);

    console.log('\n🔄 Password Reset Information:');
    console.log(`   Reset Token: ${user.reset_token ? 'Set' : 'Not set'}`);
    console.log(`   Reset Token Expiry: ${user.reset_token_expiry || 'Not set'}`);
    
    if (user.reset_token_expiry) {
      const now = new Date();
      const expiry = new Date(user.reset_token_expiry);
      const isExpired = now > expiry;
      console.log(`   Reset Token Expired: ${isExpired ? 'Yes' : 'No'}`);
      if (isExpired) {
        console.log(`   Expired ${Math.round((now - expiry) / (1000 * 60))} minutes ago`);
      } else {
        console.log(`   Expires in ${Math.round((expiry - now) / (1000 * 60))} minutes`);
      }
    }

    console.log('\n🔒 Account Security:');
    console.log(`   Is Project Manager: ${user.is_project_manager || false}`);
    console.log(`   Is Finance Head: ${user.is_finance_head || false}`);
    console.log(`   Assigned Segment: ${user.assigned_segment || 'Not assigned'}`);

    // Check if password is properly hashed
    if (user.password && !user.password.startsWith('$2b$')) {
      console.log('\n⚠️  WARNING: Password is not properly hashed!');
      console.log('   This could be causing login issues.');
    }

    // Check if user has temporary password that needs to be changed
    if (user.must_change_password && user.temporary_password) {
      console.log('\n⚠️  WARNING: User has temporary password and must change it!');
      console.log(`   Temporary password: ${user.temporary_password}`);
    }

    // Check if reset token is expired
    if (user.reset_token && user.reset_token_expiry) {
      const now = new Date();
      const expiry = new Date(user.reset_token_expiry);
      if (now > expiry) {
        console.log('\n⚠️  WARNING: Reset token is expired!');
        console.log('   User needs to request a new password reset.');
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log('✅ User account check completed');

  } catch (error) {
    console.error('❌ Error checking user:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  checkUserLogin();
}
