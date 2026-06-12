-- =============================================================================
-- Migration 005: Faculty Sessions and Dynamic QR Sessions
-- =============================================================================

-- ── faculty_sessions ──────────────────────────────────────────────────────────
-- A faculty_session is one occurrence of a class (e.g. Monday 9am lecture).
-- It links a class to a geofence zone and tracks the full lifecycle.

CREATE TABLE faculty_sessions (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id              UUID           NOT NULL,
  faculty_user_id       UUID           NOT NULL,
  term_id               UUID           NOT NULL,
  session_type          session_type   NOT NULL DEFAULT 'lecture',
  status                session_status NOT NULL DEFAULT 'scheduled',

  -- Scheduled window
  scheduled_start       TIMESTAMPTZ    NOT NULL,
  scheduled_end         TIMESTAMPTZ    NOT NULL,

  -- Actual window (set when faculty starts/ends)
  actual_start          TIMESTAMPTZ,
  actual_end            TIMESTAMPTZ,

  -- Location
  geofence_zone_id      UUID,                    -- optional: link to named zone
  -- Override coordinates (when not using a named zone, or zone is overridden)
  location_name         VARCHAR(120),
  location_point        GEOGRAPHY(POINT, 4326),  -- session centre point
  geofence_radius_m     INTEGER        NOT NULL DEFAULT 100
                          CHECK (geofence_radius_m BETWEEN 10 AND 2000),

  -- Attendance window: how long after start students can mark attendance
  late_threshold_mins   SMALLINT       NOT NULL DEFAULT 15,
  -- Students arriving after this many minutes are marked LATE (not ABSENT)
  attendance_open_mins  SMALLINT       NOT NULL DEFAULT 60,
  -- Attendance marking closes this many minutes after session start

  -- Counts (denormalised for fast dashboard reads; updated by trigger/app)
  expected_count        SMALLINT       NOT NULL DEFAULT 0,
  present_count         SMALLINT       NOT NULL DEFAULT 0,
  late_count            SMALLINT       NOT NULL DEFAULT 0,
  absent_count          SMALLINT       NOT NULL DEFAULT 0,

  notes                 TEXT,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,

  CONSTRAINT fs_class_fk   FOREIGN KEY (class_id)         REFERENCES classes(id)         ON DELETE RESTRICT,
  CONSTRAINT fs_faculty_fk FOREIGN KEY (faculty_user_id)  REFERENCES users(id)           ON DELETE RESTRICT,
  CONSTRAINT fs_term_fk    FOREIGN KEY (term_id)           REFERENCES terms(id)           ON DELETE RESTRICT,
  CONSTRAINT fs_zone_fk    FOREIGN KEY (geofence_zone_id)  REFERENCES geofence_zones(id)  ON DELETE SET NULL,
  CONSTRAINT fs_times_check CHECK (scheduled_end > scheduled_start)
);

-- Index: faculty's own sessions (faculty dashboard — most common query)
CREATE INDEX idx_fs_faculty      ON faculty_sessions (faculty_user_id) WHERE deleted_at IS NULL;
-- Index: all sessions for a class (class management, analytics)
CREATE INDEX idx_fs_class        ON faculty_sessions (class_id)        WHERE deleted_at IS NULL;
-- Index: sessions by term (term-level analytics)
CREATE INDEX idx_fs_term         ON faculty_sessions (term_id)         WHERE deleted_at IS NULL;
-- Index: active sessions (real-time attendance dashboard)
CREATE INDEX idx_fs_status       ON faculty_sessions (status)          WHERE deleted_at IS NULL;
-- Index: time-range queries (today's sessions, upcoming sessions)
CREATE INDEX idx_fs_scheduled    ON faculty_sessions (scheduled_start, scheduled_end);
-- Spatial index: proximity queries (find sessions near a location)
CREATE INDEX idx_fs_location     ON faculty_sessions USING GIST (location_point)
  WHERE location_point IS NOT NULL;

COMMENT ON TABLE faculty_sessions IS
  'One occurrence of a class. Holds the geofence config and attendance window.';
COMMENT ON COLUMN faculty_sessions.late_threshold_mins IS
  'Students arriving within this window are PRESENT; after it they are LATE.';
COMMENT ON COLUMN faculty_sessions.attendance_open_mins IS
  'Attendance marking closes after this many minutes from actual_start.';


-- ── dynamic_qr_sessions ───────────────────────────────────────────────────────
-- Each QR code issued for a faculty_session is a separate row.
-- This gives a full history of QR refreshes and enables replay detection.

CREATE TABLE dynamic_qr_sessions (
  id                UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_session_id UUID      NOT NULL,
  faculty_user_id   UUID       NOT NULL,

  -- The signed JWT token (stored so we can invalidate it)
  token             TEXT       NOT NULL,
  -- SHA-256 hash of the token — used for fast lookup without full-text scan
  token_hash        VARCHAR(64) NOT NULL,
  -- Nonce embedded in the token (UUID v4) — stored for replay detection
  nonce             UUID       NOT NULL,

  status            qr_status  NOT NULL DEFAULT 'active',
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL,
  revoked_at        TIMESTAMPTZ,
  revoke_reason     VARCHAR(80),               -- e.g. "refreshed", "session_ended"

  -- How many times this specific token was scanned (should be 0 or 1 per student)
  scan_count        INTEGER    NOT NULL DEFAULT 0,

  -- Metadata about who generated it
  generated_by_ip   INET,
  generated_by_ua   TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT qr_session_fk FOREIGN KEY (faculty_session_id) REFERENCES faculty_sessions(id) ON DELETE CASCADE,
  CONSTRAINT qr_faculty_fk FOREIGN KEY (faculty_user_id)    REFERENCES users(id)            ON DELETE RESTRICT,
  CONSTRAINT qr_nonce_unique UNIQUE (nonce),               -- global nonce uniqueness
  CONSTRAINT qr_token_hash_unique UNIQUE (token_hash)      -- fast dedup check
);

-- Index: find the current active QR for a session (most frequent query)
CREATE INDEX idx_qr_session_active ON dynamic_qr_sessions (faculty_session_id, status)
  WHERE status = 'active';
-- Index: expiry sweep (background job to mark expired tokens)
CREATE INDEX idx_qr_expires_at ON dynamic_qr_sessions (expires_at)
  WHERE status = 'active';
-- Index: nonce lookup for replay detection
CREATE INDEX idx_qr_nonce ON dynamic_qr_sessions (nonce);

COMMENT ON TABLE dynamic_qr_sessions IS
  'Each QR code issued is a row. Nonce uniqueness prevents replay. '
  'token_hash enables O(1) lookup without scanning the full token text.';
COMMENT ON COLUMN dynamic_qr_sessions.token_hash IS
  'SHA-256(token). Indexed for fast validation without full-text scan.';
COMMENT ON COLUMN dynamic_qr_sessions.nonce IS
  'UUID v4 embedded in JWT payload. Global UNIQUE constraint blocks replay attacks.';
