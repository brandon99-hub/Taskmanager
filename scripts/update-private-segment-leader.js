const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must be set. Please check your environment variables.');
  process.exit(1);
}

// Desired updates
const NEW_NAME = process.env.NEW_PRIVATE_LEADER_NAME || 'G Musyoka';
const NEW_EMAIL = process.env.NEW_PRIVATE_LEADER_EMAIL || 'gmusyoka@appkings.co.ke';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function updatePrivateSegmentLeader() {
  console.log('Starting update of private segment leader...');
  console.log(`Target: name="${NEW_NAME}", email="${NEW_EMAIL}"`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure table exists with expected columns; proceed to update
    const selectBefore = await client.query(
      `SELECT leader_name, leader_email FROM segment_leaders WHERE segment = $1 LIMIT 1`,
      ['private']
    );

    if (selectBefore.rows.length === 0) {
      console.warn('No existing private segment leader row found. Inserting new row...');
      await client.query(
        `INSERT INTO segment_leaders (segment, leader_name, leader_email) VALUES ($1, $2, $3)`,
        ['private', NEW_NAME, NEW_EMAIL]
      );
    } else {
      console.log('Existing values:', selectBefore.rows[0]);
      await client.query(
        `UPDATE segment_leaders SET leader_name = $1, leader_email = $2 WHERE segment = $3`,
        [NEW_NAME, NEW_EMAIL, 'private']
      );
    }

    const selectAfter = await client.query(
      `SELECT leader_name, leader_email FROM segment_leaders WHERE segment = $1 LIMIT 1`,
      ['private']
    );

    await client.query('COMMIT');
    console.log('Update complete. New values:', selectAfter.rows[0]);
    console.log('✅ Private segment leader updated successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error updating private segment leader:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

updatePrivateSegmentLeader();
