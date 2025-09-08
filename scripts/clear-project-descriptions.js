require('dotenv').config();
const { Pool } = require('pg');

function parseArgs(argv) {
  const args = { dryRun: false, segment: null };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--segment=')) {
      const val = arg.split('=')[1];
      if (['academic', 'parastals', 'private'].includes(val)) {
        args.segment = val;
      } else {
        console.warn(`Ignoring invalid segment value: ${val}`);
      }
    }
  }
  return args;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const { dryRun, segment } = parseArgs(process.argv);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const conditions = ['description IS NOT NULL', "description <> ''"]; 
    const params = [];
    if (segment) {
      params.push(segment);
      conditions.push(`segment = $${params.length}`);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS cnt FROM projects ${whereClause}`;
    const countRes = await pool.query(countSql, params);
    const matched = Number(countRes.rows[0]?.cnt || 0);
    console.log(`Projects matched: ${matched}${segment ? ` (segment=${segment})` : ''}`);

    if (dryRun) {
      console.log('Dry run: no updates performed.');
      return;
    }

    if (matched === 0) {
      console.log('Nothing to update.');
      return;
    }

    const updateSql = `UPDATE projects SET description = NULL ${whereClause}`;
    const updateRes = await pool.query(updateSql, params);
    console.log(`Descriptions cleared: ${updateRes.rowCount}`);
  } catch (err) {
    console.error('Error clearing descriptions:', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}


