import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ name: 'db' });

// ─── PostgreSQL Pool ────────────────────────────────────────────────────────

const useConnectionString = !!process.env.DB_URL;

export const pool = new Pool(
  useConnectionString
    ? {
        connectionString: process.env.DB_URL,
        max: parseInt(process.env.DB_POOL_MAX || '10'),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'expense_splitter',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        max: parseInt(process.env.DB_POOL_MAX || '10'),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
);

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

export const connectDB = async (): Promise<void> => {
  const client = await pool.connect();
  logger.info('PostgreSQL connected');
  client.release();
};

/**
 * Execute a query within a managed transaction.
 * Rolls back automatically on error, commits on success.
 */
export const withTransaction = async <T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── Redis Client ────────────────────────────────────────────────────────────

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => logger.error({ err }, 'Redis error'));
redis.on('connect', () => logger.info('Redis connected'));

export const connectRedis = async (): Promise<void> => {
  await redis.connect();
};

const TTL = parseInt(process.env.REDIS_TTL || '3600');

export const cacheGet = async <T>(key: string): Promise<T | null> => {
  const val = await redis.get(key);
  return val ? (JSON.parse(val) as T) : null;
};

export const cacheSet = async <T>(key: string, value: T, ttl = TTL): Promise<void> => {
  await redis.set(key, JSON.stringify(value), 'EX', ttl);
};

export const cacheDel = async (...keys: string[]): Promise<void> => {
  if (keys.length) await redis.del(...keys);
};

export const cacheInvalidatePattern = async (pattern: string): Promise<void> => {
  const keys = await redis.keys(pattern);
  if (keys.length) await redis.del(...keys);
};
