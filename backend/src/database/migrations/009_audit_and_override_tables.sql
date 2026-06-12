-- =============================================================================
-- Migration 009: Audit Logs and Manual Override Requests
-- =============================================================================

-- ── audit_logs ────────────────────────────────────────────────────────────────
-- Immutable append-only log of every sensitive action in the system.
-- No UPDATE or DELETE should ever be run on this table.

CREATE TABLE audit_logs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID,                    -- NULL for system/anonymous actions
  action          audit_action NOT NULL,
  resource_type   VARCHAR(60)  NOT NULL,   -- e.g. "attendance_record", "user"
  resource_id     UUID,                    -- PK of the affected row

  -- Before/after snapshot for change tracking
  old_values      JSONB,                   -- state before the action
  new_values      JSONB,                   -- state after the action

  -- Request context
  ip_address      INET,
  user_agent      TEXT,
  device_id       VARCHAR(120),
  request_id      VARCHAR(64),             -- correlation ID from request header

  -- Outcome
  success         BOOLEAN      NOT NULL DEFAULT TRUE,
  error_message   TEXT,

  -- Extra structured context (e.g. confidence score, distance)
  metadata        JSONB        NOT NULL DEFAULT '{}',

  -- Immutable timestamp — no updated_at on this table
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT al_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Index: all actions by a user (user activity timeline)
CREATE INDEX idx_al_user       ON audit_logs (user_id)        WHERE user_id IS NOT NULL;
-- Index: all actions on a resource (e.g. all changes to an attendance record)
CREATE INDEX idx_al_resource   ON audit_logs (resource_type, resource_id);
-- Index: filter by action type (e.g. all login failures)
CREATE INDEX idx_al_action     ON audit_logs (action);
-- Index: time-range queries (admin audit log viewer)
CREATE INDEX idx_al_time       ON audit_logs (created_at DESC);
-- Index: failed actions (security monitoring)
CREATE INDEX idx_al_failed     ON audit_logs (success) WHERE success = FALSE;
-- Index: IP-based security queries (brute-force detection)
CREATE INDEX idx_al_ip         ON audit_logs (ip_address) WHERE ip_address IS NOT NULL;

COMMENT ON TABLE audit_logs IS
  'Immutable audit trail. Never UPDATE or DELETE rows. '
  'old_values/new_values provide full change history for compliance.';


-- ── manual_override_requests ──────────────────────────────────────────────────
-- When a student cannot complete 3-factor verification, faculty/admin can
-- submit a manual override request. Requires justification and approval.

CREATE TABLE manual_override_requests (
  id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_session_id    UUID            NOT NULL,
  student_user_id       UUID            NOT NULL,
  requested_by          UUID            NOT NULL,   -- faculty or admin user
  reviewed_by           UUID,                       -- admin who approved/rejected

  requested_status      attendance_status NOT NULL, -- what status is being requested
  current_status        attendance_status,          -- existing status (if any)

  reason                TEXT            NOT NULL,   -- mandatory justification
  supporting_notes      TEXT,                       -- additional context

  status                override_status NOT NULL DEFAULT 'pending',
  reviewed_at           TIMESTAMPTZ,
  reviewer_notes        TEXT,

  -- Auto-approval: faculty can auto-approve for their own sessions
  -- (configurable per institution)
  auto_approved         BOOLEAN         NOT NULL DEFAULT FALSE,

  -- Device context of the request
  request_ip            INET,
  request_ua            TEXT,

  created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,

  CONSTRAINT mor_session_fk    FOREIGN KEY (faculty_session_id) REFERENCES faculty_sessions(id) ON DELETE RESTRICT,
  CONSTRAINT mor_student_fk    FOREIGN KEY (student_user_id)    REFERENCES users(id)            ON DELETE RESTRICT,
  CONSTRAINT mor_requester_fk  FOREIGN KEY (requested_by)       REFERENCES users(id)            ON DELETE RESTRICT,
  CONSTRAINT mor_reviewer_fk   FOREIGN KEY (reviewed_by)        REFERENCES users(id)            ON DELETE SET NULL
);

-- Index: pending overrides for admin review queue
CREATE INDEX idx_mor_pending   ON manual_override_requests (status)
  WHERE status = 'pending' AND deleted_at IS NULL;
-- Index: overrides for a session (faculty session view)
CREATE INDEX idx_mor_session   ON manual_override_requests (faculty_session_id) WHERE deleted_at IS NULL;
-- Index: overrides requested by a faculty member
CREATE INDEX idx_mor_requester ON manual_override_requests (requested_by)       WHERE deleted_at IS NULL;
-- Index: overrides for a student (student dispute history)
CREATE INDEX idx_mor_student   ON manual_override_requests (student_user_id)    WHERE deleted_at IS NULL;

COMMENT ON TABLE manual_override_requests IS
  'Formal request to manually set attendance. Requires reason. '
  'Reviewed by admin unless auto_approved is enabled for the institution.';

-- Add deferred FK from attendance_records to manual_override_requests
ALTER TABLE attendance_records
  ADD CONSTRAINT ar_override_req_fk FOREIGN KEY (override_request_id)
    REFERENCES manual_override_requests(id) ON DELETE SET NULL;
