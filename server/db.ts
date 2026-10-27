import * as dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Log the connection string (without password for security)
const connectionString = process.env.DATABASE_URL;
const sanitizedUrl = connectionString.replace(/\/\/[^:]+:[^@]+@/, '//:@');
console.log('Connecting to database:', sanitizedUrl);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Neon sits behind a pooler that silently drops idle connections, and the link to it can be
  // slow or flaky: keep TCP alive, give up on a stuck connect instead of hanging, and recycle idle clients.
  keepAlive: true,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 10_000,
  max: 10,
});

// Without a listener, a dropped idle client emits an unhandled 'error' event and can crash the process.
pool.on('error', (err) => {
  console.error('Idle database client error (a new connection will be opened):', err.message);
});
export const db = drizzle(pool, { schema });