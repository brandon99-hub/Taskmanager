const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must be set.');
  process.exit(1);
}

// Inputs (can be overridden by env)
const EMAIL = process.env.NEW_PRIVATE_LEADER_EMAIL || 'gmusyoka@appkings.co.ke';
const FIRST = process.env.NEW_PRIVATE_LEADER_FIRST || 'G';
const LAST = process.env.NEW_PRIVATE_LEADER_LAST || 'Musyoka';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log(`🔧 Setting private segment leader to ${FIRST} ${LAST} <${EMAIL}>`);

    // 1) Ensure user exists (upsert basic user record)
    const existingUser = await client.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1', [EMAIL]);
    let userId;
    if (existingUser.rows.length) {
      userId = existingUser.rows[0].id;
      await client.query('UPDATE users SET first_name=$1, last_name=$2, role=$3, updated_at=NOW() WHERE id=$4', [FIRST, LAST, 'admin', userId]);
    } else {
      const insert = await client.query(
        `INSERT INTO users (email, first_name, last_name, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, 'admin', true, NOW(), NOW()) RETURNING id`,
        [EMAIL, FIRST, LAST]
      );
      userId = insert.rows[0].id;
    }

    // 2) Deactivate any existing active private segment leader
    const old = await client.query(
      `SELECT id, user_id FROM admin_roles 
       WHERE role_type='segment_leader' AND segment='private' AND is_active=true`
    );
    for (const r of old.rows) {
      if (r.user_id !== userId) {
        await client.query('UPDATE admin_roles SET is_active=false, updated_at=NOW() WHERE id=$1', [r.id]);
        await client.query('UPDATE users SET assigned_segment=NULL, updated_at=NOW() WHERE id=$1', [r.user_id]);
        console.log(` - Deactivated previous private leader role (admin_role_id=${r.id})`);
      }
    }

    // 3) Ensure admin role for this user
    const active = await client.query(
      `SELECT id FROM admin_roles WHERE user_id=$1 AND role_type='segment_leader' AND segment='private' AND is_active=true LIMIT 1`,
      [userId]
    );
    if (!active.rows.length) {
      await client.query(
        `INSERT INTO admin_roles (user_id, role_type, segment, is_active, created_at, updated_at)
         VALUES ($1, 'segment_leader', 'private', true, NOW(), NOW())`,
        [userId]
      );
      console.log(' - Assigned private segment leader role');
    } else {
      console.log(' - Role already active for this user');
    }

    // 4) Set assigned_segment on user
    await client.query('UPDATE users SET assigned_segment=$1, updated_at=NOW() WHERE id=$2', ['private', userId]);

    await client.query('COMMIT');
    console.log('✅ Private segment leader set successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error setting private segment leader:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();


