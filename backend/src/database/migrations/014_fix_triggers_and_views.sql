-- =============================================================================
-- Migration 014: Fix broken triggers and views
-- =============================================================================

-- ── Fix 1: Drop set_updated_at trigger from tables that lack updated_at ──────
-- device_sessions, notifications, manual_override_requests don't have updated_at

DROP TRIGGER IF EXISTS trg_device_sessions_updated_at ON device_sessions;
DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
DROP TRIGGER IF EXISTS trg_manual_override_requests_updated_at ON manual_override_requests;

-- ── Fix 2: Replace v_active_sessions to handle NULL class_id (ad-hoc sessions)
-- The original view used INNER JOIN on classes which excluded ad-hoc sessions

DROP VIEW IF EXISTS v_active_sessions;
CREATE VIEW v_active_sessions AS
SELECT
  fs.*,
  c.subject_id,
  COALESCE(s.code, (fs.notes::jsonb->>'courseCode'), 'N/A') AS subject_code,
  COALESCE(s.name, (fs.notes::jsonb->>'courseName'), 'N/A') AS subject_name,
  u.first_name || ' ' || u.last_name AS faculty_name
FROM faculty_sessions fs
LEFT JOIN classes  c ON c.id = fs.class_id
LEFT JOIN subjects s ON s.id = c.subject_id
JOIN users    u ON u.id = fs.faculty_user_id
WHERE
  fs.status     = 'active'
  AND fs.deleted_at IS NULL;

COMMENT ON VIEW v_active_sessions IS
  'All currently active sessions including ad-hoc ones without a linked class.';
