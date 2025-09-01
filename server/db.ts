import * as dotenv from 'dotenv';
dotenv.config();

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as ws from "ws";
import * as schema from "../shared/schema";

// Fix WebSocket constructor for Neon
neonConfig.webSocketConstructor = ws.WebSocket;

// Debug: Log environment variables
console.log('Environment check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Log the connection string (without password for security)
const connectionString = process.env.DATABASE_URL;
const sanitizedUrl = connectionString.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
console.log('Connecting to database:', sanitizedUrl);

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });