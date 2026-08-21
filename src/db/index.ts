import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var __vikaPool: Pool | undefined;
}

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  return new Pool({
    connectionString: url,
    max: isLocal ? 5 : 3,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });
}

// Один пул на процесс (переживает HMR в dev)
const pool = globalThis.__vikaPool ?? createPool();
if (process.env.NODE_ENV !== 'production') globalThis.__vikaPool = pool;

export const db = drizzle(pool, { schema });
export type DB = typeof db;
export { schema };
