-- =============================================================================
-- Migration 010: Functions, Triggers, and Views
-- =============================================================================

-- ── updated_at auto-update trigger ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to every table that has updated_at
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'departments', 'terms', 'users', 'student_profiles', 'faculty_profiles',
    'admin_profiles', 'parent_profiles', 'parent_student_links',
    'subjects', 'classes', 'enrollments', 'geofence_zones',
    'faculty_sessions', 'face_enrollments', 'attendance_records',
    'device_sessions', 'notifications', 'manual_override_requests'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;


-- ── QR expiry auto-revoke trigger ─────────────────────────────────────────────
-- When a new QR is inserted for a session, revoke all previous active QRs.

CREATE OR REPLACE FUNCTION revoke_previous_qr_sessions()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dynamic_qr_sessions
  SET
    status       = 'revoked',
    revoked_at   = NOW(),
    revoke_reason = 'refreshed'
  WHERE
    faculty_session_id = NEW.faculty_session_id
    AND id             <> NEW.id
    AND status         = 'active';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_qr_revoke_previous
AFTER INSERT ON dynamic_qr_sessions
FOR EACH ROW EXECUTE FUNCTION revoke_previous_qr_sessions();


-- ── Attendance count denormalisation trigger ──────────────────────────────────
-- Keeps faculty_sessions.present_count / late_count / absent_count in sync.

CREATE OR REPLACE FUNCTION sync_session_attendance_counts()
RETURNS TRIGGER AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- Determine which session to update
  IF TG_OP = 'DELETE' THEN
    v_session_id := OLD.faculty_session_id;
  ELSE
    v_session_id := NEW.faculty_session_id;
  END IF;

  UPDATE faculty_sessions
  SET
    present_count = (
      SELECT COUNT(*) FROM attendance_records
      WHERE faculty_session_id = v_session_id
        AND status = 'present'
        AND deleted_at IS NULL
    ),
    late_count = (
      SELECT COUNT(*) FROM attendance_records
      WHERE faculty_session_id = v_session_id
        AND status = 'late'
        AND deleted_at IS NULL
    ),
    absent_count = (
      SELECT COUNT(*) FROM attendance_records
      WHERE faculty_session_id = v_session_id
        AND status = 'absent'
        AND deleted_at IS NULL
    )
  WHERE id = v_session_id;

  RETURN NULL; -- AFTER trigger, return value ignored
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_attendance_counts
AFTER INSERT OR UPDATE OR DELETE ON attendance_records
FOR EACH ROW EXECUTE FUNCTION sync_session_attendance_counts();


-- ── Face enrollment deactivation trigger ─────────────────────────────────────
-- When a new face enrollment is inserted for a user, deactivate all previous ones.

CREATE OR REPLACE FUNCTION deactivate_previous_face_enrollments()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE face_enrollments
  SET
    is_active  = FALSE,
    updated_at = NOW()
  WHERE
    user_id    = NEW.user_id
    AND id     <> NEW.id
    AND is_active = TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deactivate_old_face_enrollment
AFTER INSERT ON face_enrollments
FOR EACH ROW EXECUTE FUNCTION deactivate_previous_face_enrollments();


-- ── Useful views ──────────────────────────────────────────────────────────────

-- v_student_attendance_summary: per-student, per-class attendance percentage
CREATE OR REPLACE VIEW v_student_attendance_summary AS
SELECT
  ar.student_user_id,
  ar.class_id,
  ar.term_id,
  COUNT(*)                                                    AS total_sessions,
  COUNT(*) FILTER (WHERE ar.status IN ('present', 'late'))    AS attended_sessions,
  COUNT(*) FILTER (WHERE ar.status = 'present')               AS present_count,
  COUNT(*) FILTER (WHERE ar.status = 'late')                  AS late_count,
  COUNT(*) FILTER (WHERE ar.status = 'absent')                AS absent_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE ar.status IN ('present', 'late'))
    / NULLIF(COUNT(*), 0),
    2
  )                                                           AS attendance_pct
FROM attendance_records ar
WHERE ar.deleted_at IS NULL
GROUP BY ar.student_user_id, ar.class_id, ar.term_id;

COMMENT ON VIEW v_student_attendance_summary IS
  'Pre-aggregated attendance percentage per student per class per term.';


-- v_active_sessions: sessions currently open for attendance marking
CREATE OR REPLACE VIEW v_active_sessions AS
SELECT
  fs.*,
  c.subject_id,
  s.code  AS subject_code,
  s.name  AS subject_name,
  u.first_name || ' ' || u.last_name AS faculty_name
FROM faculty_sessions fs
JOIN classes  c ON c.id = fs.class_id
JOIN subjects s ON s.id = c.subject_id
JOIN users    u ON u.id = fs.faculty_user_id
WHERE
  fs.status     = 'active'
  AND fs.deleted_at IS NULL;

COMMENT ON VIEW v_active_sessions IS
  'All currently active sessions. Used by student attendance marking flow.';


-- v_current_qr: the active QR token for each active session
CREATE OR REPLACE VIEW v_current_qr AS
SELECT
  dqs.faculty_session_id,
  dqs.id          AS qr_id,
  dqs.token_hash,
  dqs.nonce,
  dqs.issued_at,
  dqs.expires_at,
  dqs.scan_count
FROM dynamic_qr_sessions dqs
WHERE dqs.status = 'active';

COMMENT ON VIEW v_current_qr IS
  'One row per active session showing the current valid QR token.';
