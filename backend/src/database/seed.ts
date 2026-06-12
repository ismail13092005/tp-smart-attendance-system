/**
 * Seed script — realistic demo data for "Greenfield University"
 *
 * Hierarchy:
 *   1 university → 3 departments → 6 subjects → 8 classes (2 terms)
 *   1 admin, 4 faculty, 12 students, 4 parents
 *   2 geofence zones, 4 faculty sessions (2 active, 2 scheduled)
 *   Attendance records, face enrollments, QR sessions, audit logs
 */

import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── helpers ──────────────────────────────────────────────────────────────────

const hash = (pw: string) => bcrypt.hashSync(pw, 10);
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** Properly encrypted face descriptor using the same encryption as the service */
const fakeEncryptedDescriptor = () => {
  const descriptor = Array.from({ length: 128 }, (_, i) => Math.sin(i) * 0.5);
  const norm = Math.sqrt(descriptor.reduce((s, v) => s + v * v, 0));
  const normalised = descriptor.map(v => v / norm);
  // Use CryptoJS AES to match encryptionService.encrypt()
  const key = process.env.ENCRYPTION_KEY || 'dev_encryption_key_32_chars_min_ok';
  const CryptoJS = require('crypto-js');
  return CryptoJS.AES.encrypt(JSON.stringify(normalised), key).toString();
};

/** PostGIS point literal */
const point = (lng: number, lat: number) =>
  `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;

async function q(client: PoolClient, sql: string, params: any[] = []) {
  return client.query(sql, params);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('🌱  Seeding Greenfield University demo data...\n');

    // ── 1. Departments ────────────────────────────────────────────────────────
    console.log('  → departments');

    const deptCS = uuidv4();
    const deptMath = uuidv4();
    const deptPhysics = uuidv4();

    await q(client, `
      INSERT INTO departments (id, name, code, description) VALUES
        ($1, 'Computer Science',  'CS',   'Algorithms, systems, AI, and software engineering'),
        ($2, 'Mathematics',       'MATH', 'Pure and applied mathematics'),
        ($3, 'Physics',           'PHY',  'Classical and modern physics')
    `, [deptCS, deptMath, deptPhysics]);

    // ── 2. Terms ──────────────────────────────────────────────────────────────
    console.log('  → terms');

    const termFall2025 = uuidv4();
    const termSpring2026 = uuidv4();

    await q(client, `
      INSERT INTO terms (id, name, code, type, status, start_date, end_date, is_active) VALUES
        ($1, 'Fall 2025',   'F2025', 'semester', 'completed', '2025-08-01', '2025-12-20', FALSE),
        ($2, 'Spring 2026', 'S2026', 'semester', 'active',    '2026-01-10', '2026-05-30', TRUE)
    `, [termFall2025, termSpring2026]);

    // ── 3. Users ──────────────────────────────────────────────────────────────
    console.log('  → users');

    // Admin
    const adminId = uuidv4();
    await q(client, `
      INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, email_verified)
      VALUES ($1, 'admin@greenfield.edu', $2, 'Sarah', 'Mitchell', 'admin', 'active', TRUE)
    `, [adminId, hash('Admin@123456')]);

    await q(client, `
      INSERT INTO admin_profiles (id, user_id, admin_id, department_id, is_super_admin)
      VALUES ($1, $2, 'ADM001', $3, TRUE)
    `, [uuidv4(), adminId, deptCS]);

    // Faculty
    const faculty: Array<{ id: string; email: string; first: string; last: string; fid: string; dept: string }> = [
      { id: uuidv4(), email: 'john.doe@greenfield.edu',    first: 'John',    last: 'Doe',      fid: 'FAC001', dept: deptCS },
      { id: uuidv4(), email: 'priya.sharma@greenfield.edu',first: 'Priya',   last: 'Sharma',   fid: 'FAC002', dept: deptCS },
      { id: uuidv4(), email: 'alan.turing@greenfield.edu', first: 'Alan',    last: 'Turing',   fid: 'FAC003', dept: deptMath },
      { id: uuidv4(), email: 'marie.curie@greenfield.edu', first: 'Marie',   last: 'Curie',    fid: 'FAC004', dept: deptPhysics },
    ];

    for (const f of faculty) {
      await q(client, `
        INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, email_verified)
        VALUES ($1, $2, $3, $4, $5, 'faculty', 'active', TRUE)
      `, [f.id, f.email, hash('Faculty@123'), f.first, f.last]);

      await q(client, `
        INSERT INTO faculty_profiles (id, user_id, faculty_id, department_id, designation)
        VALUES ($1, $2, $3, $4, 'Associate Professor')
      `, [uuidv4(), f.id, f.fid, f.dept]);
    }

    // Students (12 students across CS and Math)
    const studentData = [
      { first: 'Alice',   last: 'Johnson',  sid: 'STU2024001', dept: deptCS,   sem: 4, batch: 2024 },
      { first: 'Bob',     last: 'Williams', sid: 'STU2024002', dept: deptCS,   sem: 4, batch: 2024 },
      { first: 'Carol',   last: 'Davis',    sid: 'STU2024003', dept: deptCS,   sem: 4, batch: 2024 },
      { first: 'David',   last: 'Martinez', sid: 'STU2024004', dept: deptCS,   sem: 4, batch: 2024 },
      { first: 'Emma',    last: 'Wilson',   sid: 'STU2024005', dept: deptCS,   sem: 4, batch: 2024 },
      { first: 'Frank',   last: 'Anderson', sid: 'STU2024006', dept: deptCS,   sem: 4, batch: 2024 },
      { first: 'Grace',   last: 'Taylor',   sid: 'STU2024007', dept: deptMath, sem: 2, batch: 2025 },
      { first: 'Henry',   last: 'Thomas',   sid: 'STU2024008', dept: deptMath, sem: 2, batch: 2025 },
      { first: 'Iris',    last: 'Jackson',  sid: 'STU2024009', dept: deptMath, sem: 2, batch: 2025 },
      { first: 'James',   last: 'White',    sid: 'STU2024010', dept: deptCS,   sem: 6, batch: 2023 },
      { first: 'Karen',   last: 'Harris',   sid: 'STU2024011', dept: deptCS,   sem: 6, batch: 2023 },
      { first: 'Liam',    last: 'Clark',    sid: 'STU2024012', dept: deptPhysics, sem: 2, batch: 2025 },
    ];

    const students: Array<{ id: string; sid: string }> = [];
    for (const s of studentData) {
      const uid = uuidv4();
      students.push({ id: uid, sid: s.sid });
      const email = `${s.first.toLowerCase()}.${s.last.toLowerCase()}@student.greenfield.edu`;

      await q(client, `
        INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, email_verified)
        VALUES ($1, $2, $3, $4, $5, 'student', 'active', TRUE)
      `, [uid, email, hash('Student@123'), s.first, s.last]);

      await q(client, `
        INSERT INTO student_profiles (id, user_id, student_id, department_id, program, current_semester, batch_year)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [uuidv4(), uid, s.sid, s.dept,
          s.dept === deptCS ? 'B.Tech Computer Science' :
          s.dept === deptMath ? 'B.Sc Mathematics' : 'B.Sc Physics',
          s.sem, s.batch]);
    }

    // Parents (4 parents, each linked to 2-3 students)
    const parentData = [
      { first: 'Robert',  last: 'Johnson',  email: 'robert.johnson@gmail.com',  students: [0, 1] },
      { first: 'Linda',   last: 'Davis',    email: 'linda.davis@gmail.com',     students: [2, 3] },
      { first: 'Michael', last: 'Wilson',   email: 'michael.wilson@gmail.com',  students: [4, 5] },
      { first: 'Patricia',last: 'Taylor',   email: 'patricia.taylor@gmail.com', students: [6, 7, 8] },
    ];

    for (const p of parentData) {
      const pid = uuidv4();
      await q(client, `
        INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, email_verified)
        VALUES ($1, $2, $3, $4, $5, 'parent', 'active', TRUE)
      `, [pid, p.email, hash('Parent@123'), p.first, p.last]);

      await q(client, `
        INSERT INTO parent_profiles (id, user_id, preferred_contact, alert_threshold_pct)
        VALUES ($1, $2, 'email', 75)
      `, [uuidv4(), pid]);

      for (const si of p.students) {
        await q(client, `
          INSERT INTO parent_student_links
            (id, parent_user_id, student_user_id, relationship, is_primary, is_approved, approved_at)
          VALUES ($1, $2, $3, 'guardian', TRUE, TRUE, NOW())
        `, [uuidv4(), pid, students[si].id]);
      }
    }

    // Set department heads
    await q(client, `UPDATE departments SET head_user_id = $1 WHERE id = $2`, [faculty[0].id, deptCS]);
    await q(client, `UPDATE departments SET head_user_id = $1 WHERE id = $2`, [faculty[2].id, deptMath]);
    await q(client, `UPDATE departments SET head_user_id = $1 WHERE id = $2`, [faculty[3].id, deptPhysics]);

    // ── 4. Subjects ───────────────────────────────────────────────────────────
    console.log('  → subjects');

    const subjCS101 = uuidv4();
    const subjCS201 = uuidv4();
    const subjCS301 = uuidv4();
    const subjMATH101 = uuidv4();
    const subjMATH201 = uuidv4();
    const subjPHY101 = uuidv4();

    await q(client, `
      INSERT INTO subjects (id, code, name, credits, department_id) VALUES
        ($1, 'CS101',   'Introduction to Programming',  3, $7),
        ($2, 'CS201',   'Data Structures & Algorithms', 4, $7),
        ($3, 'CS301',   'Machine Learning',             4, $7),
        ($4, 'MATH101', 'Calculus I',                   3, $8),
        ($5, 'MATH201', 'Linear Algebra',               3, $8),
        ($6, 'PHY101',  'Classical Mechanics',          3, $9)
    `, [subjCS101, subjCS201, subjCS301, subjMATH101, subjMATH201, subjPHY101,
        deptCS, deptMath, deptPhysics]);

    // ── 5. Classes ────────────────────────────────────────────────────────────
    console.log('  → classes');

    const classCS101A = uuidv4();
    const classCS201A = uuidv4();
    const classCS301A = uuidv4();
    const classMATH101A = uuidv4();
    const classMATH201A = uuidv4();
    const classPHY101A = uuidv4();

    await q(client, `
      INSERT INTO classes (id, subject_id, term_id, faculty_user_id, section, room, max_students) VALUES
        ($1, $7,  $13, $14, 'A', 'Room 101, CS Block',    40),
        ($2, $8,  $13, $15, 'A', 'Room 102, CS Block',    35),
        ($3, $9,  $13, $15, 'A', 'Lab 201, CS Block',     30),
        ($4, $10, $13, $16, 'A', 'Room 301, Math Block',  50),
        ($5, $11, $13, $16, 'A', 'Room 302, Math Block',  45),
        ($6, $12, $13, $17, 'A', 'Room 401, Physics Lab', 40)
    `, [
      classCS101A, classCS201A, classCS301A, classMATH101A, classMATH201A, classPHY101A,
      subjCS101, subjCS201, subjCS301, subjMATH101, subjMATH201, subjPHY101,
      termSpring2026,
      faculty[0].id, faculty[1].id, faculty[2].id, faculty[3].id,
    ]);

    // ── 6. Enrollments ────────────────────────────────────────────────────────
    console.log('  → enrollments');

    // CS students → CS101, CS201
    for (let i = 0; i < 6; i++) {
      await q(client, `
        INSERT INTO enrollments (id, student_user_id, class_id, status)
        VALUES ($1, $2, $3, 'enrolled'), ($4, $5, $6, 'enrolled')
      `, [uuidv4(), students[i].id, classCS101A,
          uuidv4(), students[i].id, classCS201A]);
    }
    // Senior CS students → CS301
    for (let i = 9; i < 11; i++) {
      await q(client, `
        INSERT INTO enrollments (id, student_user_id, class_id, status)
        VALUES ($1, $2, $3, 'enrolled')
      `, [uuidv4(), students[i].id, classCS301A]);
    }
    // Math students → MATH101, MATH201
    for (let i = 6; i < 9; i++) {
      await q(client, `
        INSERT INTO enrollments (id, student_user_id, class_id, status)
        VALUES ($1, $2, $3, 'enrolled'), ($4, $5, $6, 'enrolled')
      `, [uuidv4(), students[i].id, classMATH101A,
          uuidv4(), students[i].id, classMATH201A]);
    }
    // Physics student → PHY101
    await q(client, `
      INSERT INTO enrollments (id, student_user_id, class_id, status)
      VALUES ($1, $2, $3, 'enrolled')
    `, [uuidv4(), students[11].id, classPHY101A]);

    // ── 7. Geofence Zones ─────────────────────────────────────────────────────
    console.log('  → geofence_zones');

    // Greenfield University campus: 42.3601° N, 71.0942° W (Boston area)
    const zoneCSBlock = uuidv4();
    const zoneMathBlock = uuidv4();

    await q(client, `
      INSERT INTO geofence_zones
        (id, name, description, department_id, center_point, default_radius_m,
         floor_number, building_code, is_active, created_by)
      VALUES
        ($1, 'CS Block - Main Hall',
         'Computer Science building main lecture hall area',
         $3,
         ${point(-71.0942, 42.3601)},
         100, 1, 'CSB', TRUE, $5),

        ($2, 'Mathematics Block',
         'Mathematics department building',
         $4,
         ${point(-71.0935, 42.3608)},
         80, 1, 'MATHB', TRUE, $5)
    `, [zoneCSBlock, zoneMathBlock, deptCS, deptMath, adminId]);

    // ── 8. Faculty Sessions ───────────────────────────────────────────────────
    console.log('  → faculty_sessions');

    const now = new Date();

    // Active sessions: start 30 min ago, end 90 min from now — always current
    const activeStart = new Date(now.getTime() - 30 * 60 * 1000);
    const activeEnd   = new Date(now.getTime() + 90 * 60 * 1000);

    const sess1 = uuidv4(); // active CS101 session
    const sess2 = uuidv4(); // active CS201 session
    const sess3 = uuidv4(); // scheduled MATH101 session (tomorrow)
    const sess4 = uuidv4(); // completed CS101 session (yesterday)

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const ystStart = new Date(yesterday); ystStart.setHours(9, 0, 0, 0);
    const ystEnd   = new Date(yesterday); ystEnd.setHours(11, 0, 0, 0);

    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(14, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(16, 0, 0, 0);

    await q(client, `
      INSERT INTO faculty_sessions
        (id, class_id, faculty_user_id, term_id, session_type, status,
         scheduled_start, scheduled_end, actual_start,
         geofence_zone_id, location_name, location_point, geofence_radius_m,
         late_threshold_mins, attendance_open_mins, expected_count)
      VALUES ($1,$2,$3,$4,'lecture','active',$5,$6,$5,$7,'Room 101, CS Block',
        ST_SetSRID(ST_MakePoint(-71.0942,42.3601),4326)::geography,100,15,60,6)
    `, [sess1, classCS101A, faculty[0].id, termSpring2026, activeStart, activeEnd, zoneCSBlock]);

    await q(client, `
      INSERT INTO faculty_sessions
        (id, class_id, faculty_user_id, term_id, session_type, status,
         scheduled_start, scheduled_end, actual_start,
         geofence_zone_id, location_name, location_point, geofence_radius_m,
         late_threshold_mins, attendance_open_mins, expected_count)
      VALUES ($1,$2,$3,$4,'lecture','active',$5,$6,$5,$7,'Room 102, CS Block',
        ST_SetSRID(ST_MakePoint(-71.0942,42.3601),4326)::geography,100,15,60,6)
    `, [sess2, classCS201A, faculty[1].id, termSpring2026, activeStart, activeEnd, zoneCSBlock]);

    await q(client, `
      INSERT INTO faculty_sessions
        (id, class_id, faculty_user_id, term_id, session_type, status,
         scheduled_start, scheduled_end,
         geofence_zone_id, location_name, location_point, geofence_radius_m,
         late_threshold_mins, attendance_open_mins, expected_count)
      VALUES ($1,$2,$3,$4,'lecture','scheduled',$5,$6,$7,'Room 301, Math Block',
        ST_SetSRID(ST_MakePoint(-71.0935,42.3608),4326)::geography,80,15,60,3)
    `, [sess3, classMATH101A, faculty[2].id, termSpring2026, tomorrowStart, tomorrowEnd, zoneMathBlock]);

    await q(client, `
      INSERT INTO faculty_sessions
        (id, class_id, faculty_user_id, term_id, session_type, status,
         scheduled_start, scheduled_end, actual_start, actual_end,
         geofence_zone_id, location_name, location_point, geofence_radius_m,
         late_threshold_mins, attendance_open_mins, expected_count)
      VALUES ($1,$2,$3,$4,'lecture','completed',$5,$6,$5,$6,$7,'Room 101, CS Block',
        ST_SetSRID(ST_MakePoint(-71.0942,42.3601),4326)::geography,100,15,60,6)
    `, [sess4, classCS101A, faculty[0].id, termSpring2026, ystStart, ystEnd, zoneCSBlock]);

    // ── 9. Dynamic QR Sessions ────────────────────────────────────────────────
    console.log('  → dynamic_qr_sessions');

    const qr1Id = uuidv4();
    const qr1Nonce = uuidv4();
    const qr1Token = `eyJhbGciOiJIUzI1NiJ9.demo_token_sess1_${qr1Nonce}`;
    const qr1Expires = new Date(now.getTime() + 5 * 60 * 1000);

    const qr2Id = uuidv4();
    const qr2Nonce = uuidv4();
    const qr2Token = `eyJhbGciOiJIUzI1NiJ9.demo_token_sess2_${qr2Nonce}`;
    const qr2Expires = new Date(now.getTime() + 5 * 60 * 1000);

    // Expired QR from yesterday's session
    const qr3Id = uuidv4();
    const qr3Nonce = uuidv4();
    const qr3Token = `eyJhbGciOiJIUzI1NiJ9.demo_token_sess4_${qr3Nonce}`;

    await q(client, `
      INSERT INTO dynamic_qr_sessions
        (id, faculty_session_id, faculty_user_id, token, token_hash, nonce,
         status, issued_at, expires_at, generated_by_ip)
      VALUES ($1,$2,$3,$4,$5,$6::uuid,'active',NOW(),$7,'127.0.0.1')
    `, [qr1Id, sess1, faculty[0].id, qr1Token, sha256(qr1Token), qr1Nonce, qr1Expires]);

    await q(client, `
      INSERT INTO dynamic_qr_sessions
        (id, faculty_session_id, faculty_user_id, token, token_hash, nonce,
         status, issued_at, expires_at, generated_by_ip)
      VALUES ($1,$2,$3,$4,$5,$6::uuid,'active',NOW(),$7,'127.0.0.1')
    `, [qr2Id, sess2, faculty[1].id, qr2Token, sha256(qr2Token), qr2Nonce, qr2Expires]);

    await q(client, `
      INSERT INTO dynamic_qr_sessions
        (id, faculty_session_id, faculty_user_id, token, token_hash, nonce,
         status, issued_at, expires_at, generated_by_ip)
      VALUES ($1,$2,$3,$4,$5,$6::uuid,'expired',NOW() - INTERVAL '1 day',NOW() - INTERVAL '23 hours','127.0.0.1')
    `, [qr3Id, sess4, faculty[0].id, qr3Token, sha256(qr3Token), qr3Nonce]);

    // ── 10. Face Enrollments ──────────────────────────────────────────────────
    console.log('  → face_enrollments');

    // Enroll all students so they can mark attendance in demo
    for (let i = 0; i < students.length; i++) {
      await q(client, `
        INSERT INTO face_enrollments
          (id, user_id, encrypted_descriptor, provider, enrollment_confidence,
           liveness_passed, anti_spoof_passed, is_active, enrolled_ip)
        VALUES ($1, $2, $3, 'mock', $4, TRUE, TRUE, TRUE, '127.0.0.1')
      `, [uuidv4(), students[i].id, fakeEncryptedDescriptor(),
          (0.90 + Math.random() * 0.09).toFixed(4)]);
    }

    // ── 11. Attendance Records (yesterday's completed session) ────────────────
    console.log('  → attendance_records (historical)');

    const statuses: Array<'present' | 'late' | 'absent'> = [
      'present', 'present', 'present', 'late', 'absent', 'absent',
    ];

    for (let i = 0; i < 6; i++) {
      const status = statuses[i];
      const isPresent = status !== 'absent';
      const markedAt = isPresent ? new Date(ystStart.getTime() + i * 3 * 60000) : ystStart;
      await q(client, `
        INSERT INTO attendance_records
          (id, faculty_session_id, student_user_id, class_id, term_id,
           status, marked_at,
           qr_verified, qr_verified_at,
           face_verified, face_verified_at, face_confidence,
           geo_verified, geo_verified_at,
           marked_ip, device_id)
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7,
          $8, $9,
          $10, $11, $12,
          $13, $14,
          '127.0.0.1', 'demo-device-001'
        )
      `, [
        uuidv4(), sess4, students[i].id, classCS101A, termSpring2026,
        status,
        markedAt,
        isPresent, isPresent ? ystStart : null,
        isPresent, isPresent ? ystStart : null,
        isPresent ? (0.85 + Math.random() * 0.14).toFixed(4) : null,
        isPresent, isPresent ? ystStart : null,
      ]);
    }

    // ── 12. Audit Logs ────────────────────────────────────────────────────────
    console.log('  → audit_logs');

    await q(client, `
      INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, success, ip_address, metadata)
      VALUES ($1,$2,'login','user',$2,TRUE,'127.0.0.1','{"method":"password"}')
    `, [uuidv4(), adminId]);

    await q(client, `
      INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, success, ip_address, metadata)
      VALUES ($1,$2,'session_started','faculty_session',$3,TRUE,'127.0.0.1','{"session_type":"lecture"}')
    `, [uuidv4(), faculty[0].id, sess1]);

    await q(client, `
      INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, success, ip_address, metadata)
      VALUES ($1,$2,'qr_generated','dynamic_qr_session',$3,TRUE,'127.0.0.1','{"expires_in_mins":5}')
    `, [uuidv4(), faculty[0].id, qr1Id]);

    await q(client, `
      INSERT INTO audit_logs (id, user_id, action, resource_type, success, ip_address, metadata)
      VALUES ($1,$2,'face_enrolled','face_enrollment',TRUE,'127.0.0.1','{"provider":"mock","confidence":0.94}')
    `, [uuidv4(), students[0].id]);

    // ── 13. Notifications ─────────────────────────────────────────────────────
    console.log('  → notifications');

    await q(client, `
      INSERT INTO notifications
        (id, recipient_id, type, channel, status, title, body, payload)
      VALUES
        ($1, $3, 'session_started', 'in_app', 'sent',
         'CS101 Session Started',
         'Your CS101 lecture has started. Please mark your attendance.',
         $5::jsonb),
        ($2, $4, 'absence_alert', 'email', 'sent',
         'Attendance Alert: Alice Johnson',
         'Alice Johnson was absent from CS101 on ${ystStart.toDateString()}.',
         $6::jsonb)
    `, [
      uuidv4(), uuidv4(),
      students[0].id, adminId,
      JSON.stringify({ session_id: sess1, class_code: 'CS101' }),
      JSON.stringify({ student_id: students[0].id, session_id: sess4 }),
    ]);

    await client.query('COMMIT');

    console.log('\n✅  Seed complete!\n');
    console.log('━'.repeat(60));
    console.log('Demo Credentials (all passwords are role-specific):');
    console.log('━'.repeat(60));
    console.log('  Admin    : admin@greenfield.edu          / Admin@123456');
    console.log('  Faculty  : john.doe@greenfield.edu       / Faculty@123');
    console.log('             priya.sharma@greenfield.edu   / Faculty@123');
    console.log('             alan.turing@greenfield.edu    / Faculty@123');
    console.log('             marie.curie@greenfield.edu    / Faculty@123');
    console.log('  Student  : alice.johnson@student...      / Student@123');
    console.log('             bob.williams@student...       / Student@123');
    console.log('             (12 students total, same pattern)');
    console.log('  Parent   : robert.johnson@gmail.com      / Parent@123');
    console.log('             (4 parents total, same pattern)');
    console.log('━'.repeat(60));
    console.log('\nActive sessions (mark attendance against these):');
    console.log(`  CS101  session ID: ${sess1}`);
    console.log(`  CS201  session ID: ${sess2}`);
    console.log(`  CS101  QR token hash: ${sha256(qr1Token)}`);
    console.log('━'.repeat(60));

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('\n❌  Seed failed:', err.message);
  process.exit(1);
});
