-- =============================================================================
-- Migration 015: Make face_verification_attempts.faculty_session_id nullable
-- =============================================================================
-- Face quality checks and enrollment verifications happen outside of a session
-- context (e.g. during enrollment). The session ID is only available during
-- attendance marking, not during standalone face checks.

ALTER TABLE face_verification_attempts
  ALTER COLUMN faculty_session_id DROP NOT NULL;
