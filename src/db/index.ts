import { Pool } from 'pg';
import dotenv from 'dotenv';



dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('connect', () => {
  console.log('[DB] Connected to PostgreSQL');
});

pool.on('error', (err: Error) => {
  console.error('[DB] Unexpected error on idle client', err);
  process.exit(-1);
});


/**
 * Standard query helper using the pool
 */
export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

/**
 * Client helper for transactions
 */
export const clientQuery = async () => {
  const client = await pool.connect();
  return client;
};


export default pool;


