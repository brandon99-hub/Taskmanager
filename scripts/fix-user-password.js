require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

async function fixUserPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];
  
  if (!email || !newPassword) {
    console.error('Usage: node scripts/fix-user-password.js "email@example.com" "newpassword"');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

  try {
    console.log(`🔧 Fixing password for user: ${email}`);
    console.log('=' .repeat(60));

    // Get user details first
    const { rows: users } = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (users.length === 0) {
      console.log('❌ User not found in database');
      return;
    }

    const user = users[0];
    console.log(`✅ Found user: ${user.first_name} ${user.last_name}`);
    console.log(`   Current password hash: ${user.password.substring(0, 20)}...`);
    console.log(`   Is properly hashed: ${user.password.startsWith('$2b$')}`);

    // Hash the new password
    console.log('\n🔐 Hashing new password...');
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    console.log(`   New password hash: ${hashedPassword.substring(0, 20)}...`);

    // Update the user's password
    console.log('\n💾 Updating password in database...');
    const result = await pool.query(
      'UPDATE users SET password = $1, last_password_change = $2, updated_at = $2 WHERE email = $3',
      [hashedPassword, new Date(), email]
    );

    if (result.rowCount > 0) {
      console.log('✅ Password updated successfully!');
      console.log(`   User can now login with the new password: ${newPassword}`);
    } else {
      console.log('❌ Failed to update password');
    }

    console.log('\n' + '=' .repeat(60));
    console.log('✅ Password fix completed');

  } catch (error) {
    console.error('❌ Error fixing password:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  fixUserPassword();
}
