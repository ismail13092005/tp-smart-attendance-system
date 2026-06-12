-- =============================================================================
-- Migration 001: Extensions and Enumerations
-- Purpose: Enable PostGIS and define all enum types used across the schema.
--          Centralising enums here avoids duplication and makes ALTER TYPE easy.
-- =============================================================================

-- PostGIS spatial extension (required for GEOGRAPHY / GEOMETRY columns)
CREATE EXTENSION IF NOT EXISTS postgis;

-- UUID generation (used as default PK values)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── User / Role enums ─────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM (
  'student',
  'faculty',
  'admin',
  'parent'
);

CREATE TYPE user_status AS ENUM (
  'active',
  'inactive',
  'suspended',
  'pending_verification'
);

-- ── Academic enums ────────────────────────────────────────────────────────────

CREATE TYPE term_type AS ENUM (
  'semester',   -- 2 per year
  'trimester',  -- 3 per year
  'quarter',    -- 4 per year
  'annual'
);

CREATE TYPE term_status AS ENUM (
  'upcoming',
  'active',
  'completed',
  'archived'
);

CREATE TYPE session_type AS ENUM (
  'lecture',
  'lab',
  'tutorial',
  'seminar',
  'workshop',
  'exam'
);

CREATE TYPE session_status AS ENUM (
  'scheduled',
  'active',
  'completed',
  'cancelled'
);

CREATE TYPE enrollment_status AS ENUM (
  'enrolled',
  'dropped',
  'completed',
  'waitlisted'
);

-- ── Attendance enums ──────────────────────────────────────────────────────────

CREATE TYPE attendance_status AS ENUM (
  'present',
  'late',
  'absent',
  'excused'
);

-- ── Verification enums ────────────────────────────────────────────────────────

CREATE TYPE verification_step AS ENUM (
  'qr_scan',
  'face_verification',
  'geofence_check'
);

CREATE TYPE verification_result AS ENUM (
  'passed',
  'failed',
  'error',
  'skipped'
);

-- ── QR enums ──────────────────────────────────────────────────────────────────

CREATE TYPE qr_status AS ENUM (
  'active',
  'expired',
  'revoked',
  'used'
);

-- ── Notification enums ────────────────────────────────────────────────────────

CREATE TYPE notification_type AS ENUM (
  'absence_alert',
  'low_attendance',
  'session_started',
  'manual_override',
  'system_alert',
  'parent_alert',
  'account_activity'
);

CREATE TYPE notification_channel AS ENUM (
  'in_app',
  'email',
  'sms'
);

CREATE TYPE notification_status AS ENUM (
  'pending',
  'sent',
  'delivered',
  'failed',
  'read'
);

-- ── Audit enums ───────────────────────────────────────────────────────────────

CREATE TYPE audit_action AS ENUM (
  'login',
  'logout',
  'register',
  'password_reset',
  'profile_update',
  'face_enrolled',
  'face_updated',
  'face_deleted',
  'session_created',
  'session_started',
  'session_ended',
  'session_cancelled',
  'qr_generated',
  'qr_refreshed',
  'attendance_marked',
  'attendance_failed',
  'manual_override_requested',
  'manual_override_approved',
  'manual_override_rejected',
  'user_created',
  'user_updated',
  'user_deactivated',
  'role_changed',
  'parent_linked',
  'parent_unlinked',
  'data_exported',
  'data_deleted'
);

-- ── Override / Request enums ──────────────────────────────────────────────────

CREATE TYPE override_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'auto_approved'
);

-- ── Device / Session enums ────────────────────────────────────────────────────

CREATE TYPE device_platform AS ENUM (
  'web',
  'ios',
  'android',
  'unknown'
);
