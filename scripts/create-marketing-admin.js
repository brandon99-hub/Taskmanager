const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

// Database connection - use same method as main app
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must be set. Please check your environment variables.');
  process.exit(1);
}

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createMarketingAdmin() {
  try {
    console.log('Creating marketing admin user...');
    
    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Check if admin user already exists
    const existingAdmin = await pool.query(
      'SELECT id FROM marketing_users WHERE email = $1',
      ['admin@marketing.com']
    );

    let result;
    if (existingAdmin.rows.length > 0) {
      // Update existing admin
      result = await pool.query(`
        UPDATE marketing_users 
        SET password = $2, first_name = $3, last_name = $4, role = $5, is_active = $6, updated_at = NOW()
        WHERE email = $1
        RETURNING id, email, first_name, last_name, role
      `, [
        'admin@marketing.com',
        hashedPassword,
        'Marketing',
        'Admin',
        'admin',
        true
      ]);
    } else {
      // Insert new admin user
      result = await pool.query(`
        INSERT INTO marketing_users (email, password, first_name, last_name, role, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, email, first_name, last_name, role
      `, [
        'admin@marketing.com',
        hashedPassword,
        'Marketing',
        'Admin',
        'admin',
        true
      ]);
    }
    
    console.log('Marketing admin user created successfully:');
    console.log('Email: admin@marketing.com');
    console.log('Password: admin123');
    console.log('Role: admin');
    console.log('User ID:', result.rows[0].id);
    
    // Check if marketer user already exists
    const existingMarketer = await pool.query(
      'SELECT id FROM marketing_users WHERE email = $1',
      ['marketer@marketing.com']
    );

    let marketerResult;
    if (existingMarketer.rows.length > 0) {
      // Update existing marketer
      marketerResult = await pool.query(`
        UPDATE marketing_users 
        SET password = $2, first_name = $3, last_name = $4, role = $5, is_active = $6, updated_at = NOW()
        WHERE email = $1
        RETURNING id, email, first_name, last_name, role
      `, [
        'marketer@marketing.com',
        hashedPassword,
        'John',
        'Marketer',
        'marketer',
        true
      ]);
    } else {
      // Insert new marketer user
      marketerResult = await pool.query(`
        INSERT INTO marketing_users (email, password, first_name, last_name, role, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, email, first_name, last_name, role
      `, [
        'marketer@marketing.com',
        hashedPassword,
        'John',
        'Marketer',
        'marketer',
        true
      ]);
    }
    
    console.log('\nSample marketer user created:');
    console.log('Email: marketer@marketing.com');
    console.log('Password: admin123');
    console.log('Role: marketer');
    console.log('User ID:', marketerResult.rows[0].id);
    
    console.log('\n✅ Marketing Pipeline setup complete!');
    console.log('\nYou can now access the Marketing Pipeline at:');
    console.log('http://localhost:5000/marketing/login');
    
  } catch (error) {
    console.error('Error creating marketing admin:', error);
  } finally {
    await pool.end();
  }
}

createMarketingAdmin();
