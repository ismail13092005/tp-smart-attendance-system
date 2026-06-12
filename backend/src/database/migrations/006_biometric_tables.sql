-- =============================================================================
-- Migration 006: Biometric Tables
-- Purpose: Face enrollment and per-attempt verification records.
--          Raw images are NEVER stored. Only encrypted descriptors.
-- =============================================================================

-- ── face_enrollments ──────────────────────────────────────────────────────────
-- Stores the encrypted face descriptor for a student.
-- Only one enrollment is active per student at a time.

CREATE TABLE face_enrollments (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL,

  -- AES-256 encrypted JSON array of the face descriptor vector.
  -- Decrypted only in memory during verification; never returned via API.
  encrypted_descriptor  TEXT        NOT NULL,

  -- Which provider generated this descriptor
  provider              VARCHAR(40) NOT NULL DEFAULT 'mock',
  -- Provider-specific face ID (e.g. AWS Rekognition FaceId)
  external_face_id      VARCHAR(120),

  -- Quality metrics from enrollment
  enrollment_confidence NUMERIC(5,4) NOT NULL CHECK (enrollment_confidence BETWEEN 0 AND 1),
  image_quality_score   NUMERIC(5,4),          -- provider quality score if available
  liveness_passed       BOOLEAN,               -- was liveness check run and passed?
  anti_spoof_passed     BOOLEAN,               -- was anti-spoofing check run and passed?

  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  -- Counts for monitoring drift / degradation
  verification_count    INTEGER     NOT NULL DEFAULT 0,
  last_verified_at      TIMESTAMPTZ,

  -- Expiry: institutions may require re-enrollment annually
  expires_at            TIMESTAMPTZ,

  -- Audit: who enrolled and from where
  enrolled_ip           INET,
  enrolled_ua           TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,           -- soft-delete on withdrawal of consent

  CONSTRAINT fe_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index: find active enrollment for a user (called on every attendance attempt)
CREATE INDEX idx_fe_user_active ON face_enrollments (user_id, is_active)
  WHERE is_active = TRUE AND deleted_at IS NULL;
-- Index: expiry sweep (background job to flag expiring enrollments)
CREATE INDEX idx_fe_expires ON face_enrollments (expires_at)
  WHERE expires_at IS NOT NULL AND is_active = TRUE;
-- Index: provider-specific ID lookup (for cloud provider sync)
CREATE INDEX idx_fe_external_id ON face_enrollments (external_face_id)
  WHERE external_face_id IS NOT NULL;

COMMENT ON TABLE face_enrollments IS
  'Encrypted face descriptor. Only one active enrollment per user. '
  'deleted_at used for GDPR right-to-erasure (soft-delete preserves audit trail).';
COMMENT ON COLUMN face_enrollments.encrypted_descriptor IS
  'AES-256-CBC encrypted JSON float array. Key stored in env, never in DB.';


-- ── face_verification_attempts ────────────────────────────────────────────────
-- Every face check during attendance marking is logged here.
-- Provides forensic trail for disputes and model performance monitoring.

CREATE TABLE face_verification_attempts (
  id                    UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_session_id    UUID               NOT NULL,
  student_user_id       UUID               NOT NULL,
  enrollment_id         UUID,              -- NULL if no enrollment found

  result                verification_result NOT NULL,
  confidence_score      NUMERIC(5,4)        CHECK (confidence_score BETWEEN 0 AND 1),
  threshold_used        NUMERIC(5,4)        NOT NULL,  -- snapshot of config at time of check
  liveness_passed       BOOLEAN,
  anti_spoof_passed     BOOLEAN,
  failure_reason        VARCHAR(120),       -- e.g. "low_confidence", "no_face_detected"

  -- Provider response metadata (sanitised — no raw image data)
  provider              VARCHAR(40),
  provider_response_ms  INTEGER,           -- latency in milliseconds

  -- Device context
  attempt_ip            INET,
  attempt_ua            TEXT,
  device_id             VARCHAR(120),

  attempted_at          TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

  CONSTRAINT fva_session_fk    FOREIGN KEY (faculty_session_id) REFERENCES faculty_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fva_student_fk    FOREIGN KEY (student_user_id)    REFERENCES users(id)            ON DELETE CASCADE,
  CONSTRAINT fva_enrollment_fk FOREIGN KEY (enrollment_id)      REFERENCES face_enrollments(id) ON DELETE SET NULL
);

-- Index: all face attempts for a session (faculty review)
CREATE INDEX idx_fva_session  ON face_verification_attempts (faculty_session_id);
-- Index: all face attempts by a student (dispute resolution)
CREATE INDEX idx_fva_student  ON face_verification_attempts (student_user_id);
-- Index: failed attempts (security monitoring)
CREATE INDEX idx_fva_result   ON face_verification_attempts (result) WHERE result = 'failed';
-- Index: time-based queries (recent attempts, rate-limit checks)
CREATE INDEX idx_fva_time     ON face_verification_attempts (attempted_at);

COMMENT ON TABLE face_verification_attempts IS
  'Immutable log of every face check. No raw images stored. '
  'Used for dispute resolution and model performance monitoring.';
