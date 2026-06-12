-- =============================================================================
-- Migration 007: Attendance and Location Verification Tables
-- =============================================================================

-- ── attendance_records ────────────────────────────────────────────────────────
-- The authoritative record of a student's attendance for one session.
-- Created only when ALL three verification steps pass (or via manual override).

CREATE TABLE attendance_records (
  id                    UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_session_id    UUID               NOT NULL,
  student_user_id       UUID               NOT NULL,
  class_id              UUID               NOT NULL,   -- denormalised for fast class-level queries
  term_id               UUID               NOT NULL,   -- denormalised for fast term-level queries

  status                attendance_status  NOT NULL,
  marked_at             TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

  -- ── Verification step results (snapshot at time of marking) ──────────────
  qr_verified           BOOLEAN            NOT NULL DEFAULT FALSE,
  qr_verified_at        TIMESTAMPTZ,
  qr_session_id         UUID,              -- which QR token was used

  face_verified         BOOLEAN            NOT NULL DEFAULT FALSE,
  face_verified_at      TIMESTAMPTZ,
  face_confidence       NUMERIC(5,4)       CHECK (face_confidence BETWEEN 0 AND 1),
  face_attempt_id       UUID,              -- FK to face_verification_attempts

  geo_verified          BOOLEAN            NOT NULL DEFAULT FALSE,
  geo_verified_at       TIMESTAMPTZ,
  geo_attempt_id        UUID,              -- FK to location_verification_attempts

  -- ── Manual override fields ────────────────────────────────────────────────
  is_manual_override    BOOLEAN            NOT NULL DEFAULT FALSE,
  override_request_id   UUID,              -- FK to manual_override_requests
  overridden_by         UUID,              -- user who performed the override
  override_reason       TEXT,

  -- ── Device context ────────────────────────────────────────────────────────
  marked_ip             INET,
  marked_ua             TEXT,
  device_id             VARCHAR(120),

  -- ── Failure tracking (for partial attempts that were later overridden) ────
  failed_step           verification_step,
  failure_reason        VARCHAR(200),

  created_at            TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,       -- soft-delete (admin correction)

  CONSTRAINT ar_session_fk     FOREIGN KEY (faculty_session_id) REFERENCES faculty_sessions(id)  ON DELETE RESTRICT,
  CONSTRAINT ar_student_fk     FOREIGN KEY (student_user_id)    REFERENCES users(id)             ON DELETE RESTRICT,
  CONSTRAINT ar_class_fk       FOREIGN KEY (class_id)           REFERENCES classes(id)           ON DELETE RESTRICT,
  CONSTRAINT ar_term_fk        FOREIGN KEY (term_id)            REFERENCES terms(id)             ON DELETE RESTRICT,
  CONSTRAINT ar_qr_fk          FOREIGN KEY (qr_session_id)      REFERENCES dynamic_qr_sessions(id) ON DELETE SET NULL,
  CONSTRAINT ar_face_fk        FOREIGN KEY (face_attempt_id)    REFERENCES face_verification_attempts(id) ON DELETE SET NULL,
  CONSTRAINT ar_override_by_fk FOREIGN KEY (overridden_by)      REFERENCES users(id)             ON DELETE SET NULL,
  -- One record per student per session (enforced; override updates existing row)
  CONSTRAINT ar_unique UNIQUE (faculty_session_id, student_user_id)
);

-- Index: student's own attendance history (most frequent student query)
CREATE INDEX idx_ar_student       ON attendance_records (student_user_id)    WHERE deleted_at IS NULL;
-- Index: all attendance for a session (faculty live view)
CREATE INDEX idx_ar_session       ON attendance_records (faculty_session_id) WHERE deleted_at IS NULL;
-- Index: class-level attendance analytics
CREATE INDEX idx_ar_class         ON attendance_records (class_id)           WHERE deleted_at IS NULL;
-- Index: term-level analytics
CREATE INDEX idx_ar_term          ON attendance_records (term_id)            WHERE deleted_at IS NULL;
-- Index: filter by status (present/late/absent counts)
CREATE INDEX idx_ar_status        ON attendance_records (status);
-- Index: manual overrides review (admin page)
CREATE INDEX idx_ar_override      ON attendance_records (is_manual_override) WHERE is_manual_override = TRUE;
-- Composite: student + class for attendance percentage calculation
CREATE INDEX idx_ar_student_class ON attendance_records (student_user_id, class_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE attendance_records IS
  'Authoritative attendance record. Created only when all 3 checks pass or via override. '
  'UNIQUE(session, student) prevents duplicates. Soft-deleted for corrections.';


-- ── location_verification_attempts ───────────────────────────────────────────
-- Every geofence check is logged here, including failed ones.
-- Provides forensic trail and enables anti-spoofing pattern analysis.

CREATE TABLE location_verification_attempts (
  id                    UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_session_id    UUID               NOT NULL,
  student_user_id       UUID               NOT NULL,

  result                verification_result NOT NULL,

  -- Student's reported location
  student_point         GEOGRAPHY(POINT, 4326) NOT NULL,
  -- Accuracy reported by the device (metres)
  reported_accuracy_m   NUMERIC(8,2),
  -- Timestamp from the device GPS (may differ from server time)
  device_timestamp      TIMESTAMPTZ,

  -- Computed values
  distance_from_session_m NUMERIC(10,2),   -- ST_Distance result in metres
  geofence_radius_m     INTEGER,           -- snapshot of session radius at time of check
  within_geofence       BOOLEAN,

  -- Anti-spoofing flags
  accuracy_suspicious   BOOLEAN            NOT NULL DEFAULT FALSE,
  timestamp_suspicious  BOOLEAN            NOT NULL DEFAULT FALSE,
  spoofing_detected     BOOLEAN            NOT NULL DEFAULT FALSE,
  spoofing_reason       VARCHAR(200),

  failure_reason        VARCHAR(200),

  -- Device context
  attempt_ip            INET,
  attempt_ua            TEXT,
  device_id             VARCHAR(120),

  attempted_at          TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

  CONSTRAINT lva_session_fk FOREIGN KEY (faculty_session_id) REFERENCES faculty_sessions(id) ON DELETE CASCADE,
  CONSTRAINT lva_student_fk FOREIGN KEY (student_user_id)    REFERENCES users(id)            ON DELETE CASCADE
);

-- Spatial index: proximity analysis, heat-map queries
CREATE INDEX idx_lva_point    ON location_verification_attempts USING GIST (student_point);
-- Index: all location attempts for a session
CREATE INDEX idx_lva_session  ON location_verification_attempts (faculty_session_id);
-- Index: all location attempts by a student (dispute resolution)
CREATE INDEX idx_lva_student  ON location_verification_attempts (student_user_id);
-- Index: spoofing detection review
CREATE INDEX idx_lva_spoof    ON location_verification_attempts (spoofing_detected)
  WHERE spoofing_detected = TRUE;
-- Index: time-based queries
CREATE INDEX idx_lva_time     ON location_verification_attempts (attempted_at);

COMMENT ON TABLE location_verification_attempts IS
  'Immutable log of every geofence check. student_point stored as GEOGRAPHY '
  'so ST_Distance returns metres. Spoofing flags set by anti-spoofing heuristics.';

-- Add deferred FK from attendance_records to location_verification_attempts
ALTER TABLE attendance_records
  ADD CONSTRAINT ar_geo_fk FOREIGN KEY (geo_attempt_id)
    REFERENCES location_verification_attempts(id) ON DELETE SET NULL;
