const bcrypt = require('bcryptjs');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
require('dotenv').config();

// Database connection
const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString);
const db = drizzle(client);

async function createAdminUser() {
  try {
    // Hash the admin password
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Insert admin user
    const result = await db.execute(`
      INSERT INTO users (
        email, 
        password, 
        first_name, 
        last_name, 
        role, 
        is_active
      ) VALUES (
        'admin@taskflow.com', 
        '${hashedPassword}', 
        'Admin', 
        'User', 
        'admin', 
        true
      ) ON CONFLICT (email) DO NOTHING
      RETURNING id, email, role;
    `);
    
    if (result.length > 0) {
      console.log('✅ Admin user created successfully!');
      console.log('Email: admin@taskflow.com');
      console.log('Password: admin123');
      console.log('Role: admin');
    } else {
      console.log('ℹ️ Admin user already exists or no changes made');
    }
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await client.end();
  }
}

createAdminUser();
