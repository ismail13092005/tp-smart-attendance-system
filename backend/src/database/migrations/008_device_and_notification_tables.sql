-- =============================================================================
-- Migration 008: Device Sessions and Notifications
-- =============================================================================

-- ── device_sessions ───────────────────────────────────────────────────────────
-- Tracks every authenticated device session.
-- Enables "view active sessions" and "revoke session" features.

CREATE TABLE device_sessions (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID            NOT NULL,

  -- JWT refresh token hash (SHA-256) — never store the raw token
  refresh_token_hash  VARCHAR(64) NOT NULL,
  -- Access token JTI (JWT ID) for the current access token
  access_token_jti    VARCHAR(64),

  platform        device_platform NOT NULL DEFAULT 'web',
  device_name     VARCHAR(120),              -- e.g. "Chrome on MacBook"
  device_id       VARCHAR(120),              -- client-generated device fingerprint

  ip_address      INET            NOT NULL,
  user_agent      TEXT,

  is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
  last_active_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ     NOT NULL,  -- refresh token expiry
  revoked_at      TIMESTAMPTZ,
  revoke_reason   VARCHAR(80),               -- e.g. "logout", "admin_revoke", "expired"

  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT ds_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ds_token_hash_unique UNIQUE (refresh_token_hash)
);

-- Index: find all active sessions for a user (session management page)
CREATE INDEX idx_ds_user_active ON device_sessions (user_id, is_active)
  WHERE is_active = TRUE;
-- Index: token hash lookup on every refresh request
CREATE INDEX idx_ds_token_hash  ON device_sessions (refresh_token_hash);
-- Index: expiry sweep (background job)
CREATE INDEX idx_ds_expires     ON device_sessions (expires_at) WHERE is_active = TRUE;
-- Index: IP-based security queries
CREATE INDEX idx_ds_ip          ON device_sessions (ip_address);

COMMENT ON TABLE device_sessions IS
  'One row per authenticated device session. refresh_token_hash stored (not raw token). '
  'Enables session revocation and concurrent session limits.';


-- ── notifications ─────────────────────────────────────────────────────────────

CREATE TABLE notifications (
  id              UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id    UUID                 NOT NULL,   -- user receiving the notification
  sender_id       UUID,                            -- NULL = system-generated
  type            notification_type    NOT NULL,
  channel         notification_channel NOT NULL DEFAULT 'in_app',
  status          notification_status  NOT NULL DEFAULT 'pending',

  title           VARCHAR(200)         NOT NULL,
  body            TEXT                 NOT NULL,
  -- Structured data for deep-linking (e.g. session ID, student ID)
  payload         JSONB                NOT NULL DEFAULT '{}',

  -- Delivery tracking
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  failure_reason  VARCHAR(200),
  retry_count     SMALLINT             NOT NULL DEFAULT 0,

  -- External provider reference (e.g. SendGrid message ID)
  external_id     VARCHAR(120),

  created_at      TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ          NOT NULL DEFAULT NOW(),

  CONSTRAINT notif_recipient_fk FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT notif_sender_fk    FOREIGN KEY (sender_id)    REFERENCES users(id) ON DELETE SET NULL
);

-- Index: unread notifications for a user (notification bell)
CREATE INDEX idx_notif_recipient_unread ON notifications (recipient_id, status)
  WHERE status IN ('pending', 'sent', 'delivered');
-- Index: pending notifications for delivery worker
CREATE INDEX idx_notif_pending ON notifications (status, created_at)
  WHERE status = 'pending';
-- Index: failed notifications for retry worker
CREATE INDEX idx_notif_failed  ON notifications (status, retry_count)
  WHERE status = 'failed';

COMMENT ON TABLE notifications IS
  'Multi-channel notification log. payload JSONB enables deep-linking in frontend.';
