import { Pool } from 'pg';
import { config } from '../config/env.js';

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

export async function healthCheck(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

export async function query(text: string, params?: any[]): Promise<{ rows: any[] }> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return pool.query(text, params) as Promise<{ rows: any[] }>;
}

export async function closePool(): Promise<void> {
  await pool.end();
}
