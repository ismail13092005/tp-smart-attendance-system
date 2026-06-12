-- =============================================================================
-- Migration 012: Make faculty_sessions.class_id nullable
-- =============================================================================
-- Ad-hoc sessions created by faculty via the UI do not have a linked class row.
-- The route stores course info in the notes JSON column instead.

ALTER TABLE faculty_sessions
  ALTER COLUMN class_id DROP NOT NULL;
