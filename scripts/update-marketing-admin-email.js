const { Pool } = require('pg');
require('dotenv').config();

async function updateMarketingAdminEmail() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔧 Updating marketing admin email...');
    console.log('=' .repeat(60));

    // Check if the old admin exists
    const { rows: oldAdmin } = await pool.query(
      'SELECT * FROM marketing_users WHERE email = $1',
      ['admin@marketing.com']
    );

    if (oldAdmin.length === 0) {
      console.log('❌ Old marketing admin (admin@marketing.com) not found');
      return;
    }

    console.log(`✅ Found old admin: ${oldAdmin[0].first_name} ${oldAdmin[0].last_name}`);

    // Check if new email already exists
    const { rows: existingUser } = await pool.query(
      'SELECT * FROM marketing_users WHERE email = $1',
      ['smartin@appkings.co.ke']
    );

    if (existingUser.length > 0) {
      console.log('⚠️  User with email smartin@appkings.co.ke already exists');
      console.log('   Updating existing user to admin role...');
      
      // Update existing user to admin
      const result = await pool.query(`
        UPDATE marketing_users 
        SET role = $1, is_active = $2, updated_at = NOW()
        WHERE email = $3
        RETURNING id, email, first_name, last_name, role
      `, ['admin', true, 'smartin@appkings.co.ke']);

      console.log('✅ Updated existing user to admin role');
      console.log(`   User: ${result.rows[0].first_name} ${result.rows[0].last_name}`);
      console.log(`   Email: ${result.rows[0].email}`);
      console.log(`   Role: ${result.rows[0].role}`);
    } else {
      // Update the old admin's email
      const result = await pool.query(`
        UPDATE marketing_users 
        SET email = $1, first_name = $2, last_name = $3, updated_at = NOW()
        WHERE email = $4
        RETURNING id, email, first_name, last_name, role
      `, [
        'smartin@appkings.co.ke',
        'Smart',
        'Martin',
        'admin@marketing.com'
      ]);

      if (result.rowCount > 0) {
        console.log('✅ Marketing admin email updated successfully!');
        console.log(`   New Email: ${result.rows[0].email}`);
        console.log(`   Name: ${result.rows[0].first_name} ${result.rows[0].last_name}`);
        console.log(`   Role: ${result.rows[0].role}`);
      } else {
        console.log('❌ Failed to update marketing admin email');
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log('✅ Marketing admin email update completed');

  } catch (error) {
    console.error('❌ Error updating marketing admin email:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  updateMarketingAdminEmail();
}

module.exports = { updateMarketingAdminEmail };
