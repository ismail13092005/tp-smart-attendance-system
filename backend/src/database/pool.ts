/**
 * Shared pg Pool instance.
 * Used by auth and other modules that need raw SQL performance.
 * Sequelize uses its own pool; this is for direct queries.
 */
import { Pool } from 'pg';
import config from '../config';
import logger from '../shared/logger';

export const pool = new Pool({
  connectionString: config.database.url,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  logger.error('Unexpected pg pool error', { error: err.message });
});

export default pool;
