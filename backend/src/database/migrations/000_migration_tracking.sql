-- =============================================================================
-- Migration 000: Migration Tracking Table
-- Must run FIRST before any other migration.
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  id          SERIAL      PRIMARY KEY,
  filename    VARCHAR(200) NOT NULL UNIQUE,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum    VARCHAR(64)  NOT NULL,   -- SHA-256 of file content (tamper detection)
  duration_ms INTEGER
);

COMMENT ON TABLE schema_migrations IS
  'Tracks applied migrations. checksum detects file tampering after application.';
