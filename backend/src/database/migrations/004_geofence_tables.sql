-- =============================================================================
-- Migration 004: Geofence Tables
-- Purpose: Define campus zones and per-session geofence configuration.
--          Uses PostGIS GEOGRAPHY type for accurate metre-based distance
--          calculations on a spherical earth model.
-- =============================================================================

-- ── geofence_zones ────────────────────────────────────────────────────────────
-- Reusable named zones (buildings, labs, lecture halls).
-- Faculty can pick a zone when creating a session instead of entering
-- coordinates manually every time.

CREATE TABLE geofence_zones (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(120) NOT NULL,       -- e.g. "Main Lecture Hall A"
  description     TEXT,
  department_id   UUID,                        -- optional: zone owned by a dept
  -- GEOGRAPHY(POINT) stores lon/lat in WGS-84 (SRID 4326).
  -- Using GEOGRAPHY (not GEOMETRY) gives ST_Distance results in metres
  -- without needing a projection.
  center_point    GEOGRAPHY(POINT, 4326) NOT NULL,
  -- Polygon boundary for complex-shaped zones (optional).
  -- When present, containment check uses ST_Within instead of ST_DWithin.
  boundary        GEOGRAPHY(POLYGON, 4326),
  default_radius_m  INTEGER   NOT NULL DEFAULT 100
                    CHECK (default_radius_m BETWEEN 10 AND 2000),
  floor_number    SMALLINT,                    -- for multi-storey buildings
  building_code   VARCHAR(20),
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by      UUID        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT gz_dept_fk    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT gz_creator_fk FOREIGN KEY (created_by)    REFERENCES users(id)       ON DELETE RESTRICT
);

-- Spatial index: accelerates ST_DWithin / ST_Within queries
-- (GIST is the correct index type for PostGIS geography columns)
CREATE INDEX idx_geofence_zones_center   ON geofence_zones USING GIST (center_point);
CREATE INDEX idx_geofence_zones_boundary ON geofence_zones USING GIST (boundary) WHERE boundary IS NOT NULL;
-- Index: list zones by department
CREATE INDEX idx_geofence_zones_dept     ON geofence_zones (department_id) WHERE deleted_at IS NULL;
-- Index: active zones for dropdown lists
CREATE INDEX idx_geofence_zones_active   ON geofence_zones (is_active)     WHERE is_active = TRUE;

COMMENT ON TABLE geofence_zones IS
  'Reusable campus zones. center_point + default_radius_m used for circular geofence. '
  'boundary polygon used for irregular shapes (e.g. L-shaped buildings).';
COMMENT ON COLUMN geofence_zones.center_point IS
  'GEOGRAPHY(POINT,4326): lon/lat in WGS-84. ST_Distance returns metres.';
COMMENT ON COLUMN geofence_zones.boundary IS
  'Optional polygon. When set, ST_Within(student_point, boundary) is used instead of radius check.';
