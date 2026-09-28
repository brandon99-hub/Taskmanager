const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

function generateTemporaryPassword() {
  // 16 random bytes, base64url-encoded — no ambiguous characters, safe to print/copy.
  return crypto.randomBytes(16).toString('base64url');
}

async function createAdminUser() {
  try {
    const temporaryPassword = generateTemporaryPassword();
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    const hashedPassword = await bcrypt.hash(temporaryPassword, rounds);

    // Parameterized query — email/password are never interpolated into the SQL string.
    const result = await pool.query(
      `INSERT INTO users (
        email, password, first_name, last_name, role, is_active, must_change_password
      ) VALUES ($1, $2, 'Admin', 'User', 'admin', true, true)
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, role;`,
      ['admin@taskflow.com', hashedPassword]
    );

    if (result.rows.length > 0) {
      console.log('✅ Admin user created successfully!');
      console.log('Email: admin@taskflow.com');
      console.log(`Temporary password: ${temporaryPassword}`);
      console.log('Role: admin');
      console.log('⚠️  This password is shown once — store it securely. The account is flagged to require a password change on first login.');
    } else {
      console.log('ℹ️ Admin user already exists or no changes made');
    }

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await pool.end();
  }
}

createAdminUser();
