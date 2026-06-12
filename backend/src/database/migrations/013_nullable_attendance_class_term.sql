-- =============================================================================
-- Migration 013: Make attendance_records.class_id and term_id nullable
-- =============================================================================
-- Ad-hoc sessions (created without a linked class row) need to be able to
-- record attendance without a class_id or term_id.

ALTER TABLE attendance_records
  ALTER COLUMN class_id DROP NOT NULL,
  ALTER COLUMN term_id  DROP NOT NULL;
