-- =============================================================================
-- Migration 011: Performance indexes for dashboard queries
--
-- Why each index:
--   idx_ar_session_student   — attendance sheet: JOIN on both session + student
--   idx_ar_marked_at         — history page: ORDER BY marked_at DESC
--   idx_fs_date              — today/trend queries: DATE(scheduled_start)
--   idx_notif_recipient_unread — notification bell: unread count per user
--   idx_psl_approved         — parent dashboard: approved links only
--   idx_users_role_active    — admin search: filter by role + active status
-- =============================================================================

-- Composite index for attendance sheet queries (session + student lookup)
CREATE INDEX IF NOT EXISTS idx_ar_session_student
  ON attendance_records (faculty_session_id, student_user_id)
  WHERE deleted_at IS NULL;

-- Index for history page ORDER BY marked_at
CREATE INDEX IF NOT EXISTS idx_ar_marked_at
  ON attendance_records (student_user_id, marked_at DESC)
  WHERE deleted_at IS NULL;

-- Index for date-based session queries (today's schedule, trend charts)
CREATE INDEX IF NOT EXISTS idx_fs_date
  ON faculty_sessions (DATE(scheduled_start AT TIME ZONE 'UTC'))
  WHERE deleted_at IS NULL;

-- Index for notification unread count queries
CREATE INDEX IF NOT EXISTS idx_notif_recipient_unread
  ON notifications (recipient_id, status)
  WHERE status != 'read';

-- Index for parent-student link lookups (approved only)
CREATE INDEX IF NOT EXISTS idx_psl_approved
  ON parent_student_links (parent_user_id, student_user_id)
  WHERE is_approved = TRUE AND deleted_at IS NULL;

-- Index for admin user search by role + status
CREATE INDEX IF NOT EXISTS idx_users_role_status
  ON users (role, status)
  WHERE deleted_at IS NULL;

-- Index for faculty session date-range reports
CREATE INDEX IF NOT EXISTS idx_fs_faculty_date
  ON faculty_sessions (faculty_user_id, scheduled_start)
  WHERE deleted_at IS NULL;
