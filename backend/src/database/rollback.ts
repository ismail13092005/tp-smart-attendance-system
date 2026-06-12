/**
 * Rollback runner
 * Drops all tables and types in reverse order.
 * DESTRUCTIVE — development use only.
 */
import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function rollback(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Rollback is disabled in production.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Rolling back schema...');

    // Drop views first
    const views = [
      'v_current_qr',
      'v_active_sessions',
      'v_student_attendance_summary',
    ];
    for (const v of views) {
      await client.query(`DROP VIEW IF EXISTS ${v} CASCADE`);
      console.log(`  dropped view ${v}`);
    }

    // Drop tables in reverse dependency order
    const tables = [
      'audit_logs',
      'manual_override_requests',
      'notifications',
      'device_sessions',
      'location_verification_attempts',
      'attendance_records',
      'face_verification_attempts',
      'face_enrollments',
      'dynamic_qr_sessions',
      'faculty_sessions',
      'geofence_zones',
      'enrollments',
      'classes',
      'subjects',
      'parent_student_links',
      'parent_profiles',
      'admin_profiles',
      'faculty_profiles',
      'student_profiles',
      'users',
      'terms',
      'departments',
      'schema_migrations',
    ];

    for (const t of tables) {
      await client.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
      console.log(`  dropped table ${t}`);
    }

    // Drop enums
    const enums = [
      'user_role', 'user_status', 'term_type', 'term_status',
      'session_type', 'session_status', 'enrollment_status',
      'attendance_status', 'verification_step', 'verification_result',
      'qr_status', 'notification_type', 'notification_channel',
      'notification_status', 'audit_action', 'override_status',
      'device_platform',
    ];
    for (const e of enums) {
      await client.query(`DROP TYPE IF EXISTS ${e} CASCADE`);
      console.log(`  dropped type ${e}`);
    }

    await client.query('COMMIT');
    console.log('\nRollback complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

rollback().catch(err => {
  console.error('\n❌ Rollback failed:', err.message);
  process.exit(1);
});
