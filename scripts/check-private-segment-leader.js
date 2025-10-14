const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must be set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('🔎 Checking active private segment leaders...');

    const { rows } = await client.query(
      `SELECT ar.id AS admin_role_id, u.id AS user_id, u.email, u.first_name, u.last_name, ar.created_at, ar.updated_at
       FROM admin_roles ar
       INNER JOIN users u ON u.id = ar.user_id
       WHERE ar.role_type = 'segment_leader' AND ar.segment = 'private' AND ar.is_active = true
       ORDER BY ar.created_at ASC`
    );

    if (rows.length === 0) {
      console.log('ℹ️ No active private segment leaders found.');
    } else {
      console.log(`✅ Found ${rows.length} active private segment leader(s):`);
      for (const r of rows) {
        const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim();
        console.log(` - ${name || '(no name)'} <${r.email}>  (admin_role_id=${r.admin_role_id})`);
      }
    }
  } catch (err) {
    console.error('❌ Error checking private segment leaders:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();


