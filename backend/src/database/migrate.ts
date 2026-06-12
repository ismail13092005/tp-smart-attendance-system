/**
 * Migration runner
 * Reads SQL files from ./migrations in filename order,
 * skips already-applied ones, and records each run.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function run(): Promise<void> {
  const client = await pool.connect();

  try {
    // Ensure tracking table exists (idempotent)
    const trackingSql = fs.readFileSync(
      path.join(MIGRATIONS_DIR, '000_migration_tracking.sql'),
      'utf8'
    );
    await client.query(trackingSql);

    // Collect migration files (sorted by filename)
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql') && f !== '000_migration_tracking.sql')
      .sort();

    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql      = fs.readFileSync(filePath, 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');

      // Check if already applied
      const { rows } = await client.query(
        'SELECT checksum FROM schema_migrations WHERE filename = $1',
        [file]
      );

      if (rows.length > 0) {
        if (rows[0].checksum !== checksum) {
          throw new Error(
            `Migration ${file} has been modified after being applied! ` +
            `Expected checksum ${rows[0].checksum}, got ${checksum}`
          );
        }
        console.log(`  ✓ ${file} (already applied)`);
        continue;
      }

      // Apply migration in a transaction
      const start = Date.now();
      await client.query('BEGIN');
      try {
        await client.query(sql);
        const duration = Date.now() - start;
        await client.query(
          `INSERT INTO schema_migrations (filename, checksum, duration_ms)
           VALUES ($1, $2, $3)`,
          [file, checksum, duration]
        );
        await client.query('COMMIT');
        console.log(`  ✅ ${file} (${duration}ms)`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }

    console.log('\nAll migrations applied successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
