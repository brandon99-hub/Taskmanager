import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

console.log('Testing database connection...');

try {
  const client = await pool.connect();
  const result = await client.query('SELECT NOW()');
  console.log('Database connected successfully!');
  console.log('Current time:', result.rows[0]);
  client.release();
  process.exit(0);
} catch (error) {
  console.error('Database connection failed:', error);
  process.exit(1);
}
