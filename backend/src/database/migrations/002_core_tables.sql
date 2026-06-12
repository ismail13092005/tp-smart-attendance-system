-- =============================================================================
-- Migration 002: Core Tables
-- Order: departments → terms → users → role-profiles → parent_student_links
-- =============================================================================

-- ── departments ───────────────────────────────────────────────────────────────
-- Represents academic departments (e.g. Computer Science, Mathematics).
-- Referenced by users, subjects, and classes.

CREATE TABLE departments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(120) NOT NULL,
  code          VARCHAR(20)  NOT NULL,
  description   TEXT,
  head_user_id  UUID,                          -- FK added after users table
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,                   -- soft-delete

  CONSTRAINT departments_code_unique UNIQUE (code)
);

-- Index: fast lookup by code (used in registration validation)
CREATE INDEX idx_departments_code ON departments (code);
-- Index: filter active departments in dropdowns
CREATE INDEX idx_departments_active ON departments (is_active) WHERE is_active = TRUE;

COMMENT ON TABLE departments IS 'Academic departments. Soft-deleted to preserve historical references.';
COMMENT ON COLUMN departments.head_user_id IS 'FK to users.id — set after users table exists.';


-- ── terms ─────────────────────────────────────────────────────────────────────
-- Academic terms / semesters. All sessions and enrollments belong to a term.

CREATE TABLE terms (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(80) NOT NULL,            -- e.g. "Fall 2026"
  code        VARCHAR(20) NOT NULL,            -- e.g. "F2026"
  type        term_type   NOT NULL DEFAULT 'semester',
  status      term_status NOT NULL DEFAULT 'upcoming',
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,

  CONSTRAINT terms_code_unique UNIQUE (code),
  CONSTRAINT terms_dates_check CHECK (end_date > start_date)
);

-- Index: find the currently active term quickly
CREATE INDEX idx_terms_active ON terms (is_active) WHERE is_active = TRUE;
-- Index: range queries for term listing
CREATE INDEX idx_terms_dates ON terms (start_date, end_date);

COMMENT ON TABLE terms IS 'Academic terms. Only one term should have is_active=TRUE at a time.';


-- ── users ─────────────────────────────────────────────────────────────────────
-- Central identity table. Role-specific data lives in profile tables.

CREATE TABLE users (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email             VARCHAR(255) NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  first_name        VARCHAR(80)  NOT NULL,
  last_name         VARCHAR(80)  NOT NULL,
  role              user_role    NOT NULL,
  status            user_status  NOT NULL DEFAULT 'pending_verification',
  phone             VARCHAR(30),
  profile_image_url TEXT,
  email_verified    BOOLEAN     NOT NULL DEFAULT FALSE,
  last_login_at     TIMESTAMPTZ,
  last_login_ip     INET,
  last_login_ua     TEXT,                      -- user-agent string
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,               -- soft-delete

  CONSTRAINT users_email_unique UNIQUE (email)
);

-- Index: login lookup (most frequent query on this table)
CREATE INDEX idx_users_email ON users (email);
-- Index: filter by role for admin user-management pages
CREATE INDEX idx_users_role ON users (role);
-- Index: filter active users (excludes soft-deleted)
CREATE INDEX idx_users_status ON users (status) WHERE deleted_at IS NULL;
-- Index: soft-delete filter used on almost every query
CREATE INDEX idx_users_deleted_at ON users (deleted_at) WHERE deleted_at IS NULL;

COMMENT ON TABLE users IS 'Core identity. Password is bcrypt-hashed. Role-specific data in profile tables.';
COMMENT ON COLUMN users.last_login_ip IS 'Stored as INET for IP-range queries in security audits.';


-- ── student_profiles ──────────────────────────────────────────────────────────

CREATE TABLE student_profiles (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL,
  student_id      VARCHAR(30) NOT NULL,        -- institutional ID e.g. "STU2024001"
  department_id   UUID,
  program         VARCHAR(120),                -- e.g. "B.Tech Computer Science"
  current_semester SMALLINT   CHECK (current_semester BETWEEN 1 AND 16),
  batch_year      SMALLINT,                    -- e.g. 2024
  cgpa            NUMERIC(4,2) CHECK (cgpa BETWEEN 0 AND 10),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT sp_user_fk   FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE,
  CONSTRAINT sp_dept_fk   FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT sp_user_unique UNIQUE (user_id),
  CONSTRAINT sp_student_id_unique UNIQUE (student_id)
);

-- Index: look up profile by institutional student ID
CREATE INDEX idx_student_profiles_student_id ON student_profiles (student_id);
-- Index: list all students in a department
CREATE INDEX idx_student_profiles_department ON student_profiles (department_id);
-- Index: filter by batch year for cohort analytics
CREATE INDEX idx_student_profiles_batch ON student_profiles (batch_year);

COMMENT ON TABLE student_profiles IS 'Extended student data. 1-to-1 with users where role=student.';


-- ── faculty_profiles ──────────────────────────────────────────────────────────

CREATE TABLE faculty_profiles (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL,
  faculty_id      VARCHAR(30) NOT NULL,        -- institutional ID e.g. "FAC001"
  department_id   UUID,
  designation     VARCHAR(80),                 -- e.g. "Associate Professor"
  specialization  VARCHAR(120),
  joining_date    DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fp_user_fk   FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE,
  CONSTRAINT fp_dept_fk   FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT fp_user_unique UNIQUE (user_id),
  CONSTRAINT fp_faculty_id_unique UNIQUE (faculty_id)
);

CREATE INDEX idx_faculty_profiles_faculty_id   ON faculty_profiles (faculty_id);
CREATE INDEX idx_faculty_profiles_department   ON faculty_profiles (department_id);

COMMENT ON TABLE faculty_profiles IS 'Extended faculty data. 1-to-1 with users where role=faculty.';


-- ── admin_profiles ────────────────────────────────────────────────────────────

CREATE TABLE admin_profiles (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL,
  admin_id        VARCHAR(30) NOT NULL,
  department_id   UUID,
  is_super_admin  BOOLEAN     NOT NULL DEFAULT FALSE,
  permissions     JSONB       NOT NULL DEFAULT '[]',  -- fine-grained permission list
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ap_user_fk   FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE,
  CONSTRAINT ap_dept_fk   FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT ap_user_unique UNIQUE (user_id),
  CONSTRAINT ap_admin_id_unique UNIQUE (admin_id)
);

CREATE INDEX idx_admin_profiles_admin_id ON admin_profiles (admin_id);

COMMENT ON TABLE admin_profiles IS 'Admin/principal profile. permissions JSONB allows granular RBAC.';


-- ── parent_profiles ───────────────────────────────────────────────────────────

CREATE TABLE parent_profiles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL,
  occupation          VARCHAR(80),
  preferred_contact   notification_channel NOT NULL DEFAULT 'email',
  alert_threshold_pct SMALLINT    NOT NULL DEFAULT 75  -- alert when attendance < this %
                        CHECK (alert_threshold_pct BETWEEN 0 AND 100),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT pp_user_fk   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT pp_user_unique UNIQUE (user_id)
);

COMMENT ON TABLE parent_profiles IS 'Parent-specific settings. Linked to students via parent_student_links.';


-- ── parent_student_links ──────────────────────────────────────────────────────
-- Many-to-many: one parent can monitor multiple students; one student can have
-- multiple parents/guardians.

CREATE TABLE parent_student_links (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id  UUID        NOT NULL,
  student_user_id UUID        NOT NULL,
  relationship    VARCHAR(40) NOT NULL DEFAULT 'guardian',  -- father/mother/guardian
  is_primary      BOOLEAN     NOT NULL DEFAULT FALSE,       -- primary contact
  is_approved     BOOLEAN     NOT NULL DEFAULT FALSE,       -- student must approve
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT psl_parent_fk  FOREIGN KEY (parent_user_id)  REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT psl_student_fk FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT psl_unique     UNIQUE (parent_user_id, student_user_id)
);

-- Index: find all students for a parent (parent dashboard)
CREATE INDEX idx_psl_parent   ON parent_student_links (parent_user_id)  WHERE deleted_at IS NULL;
-- Index: find all parents for a student (student settings page)
CREATE INDEX idx_psl_student  ON parent_student_links (student_user_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE parent_student_links IS 'Parent↔Student relationship. Requires student approval for privacy.';


-- ── Now add the deferred FK on departments.head_user_id ───────────────────────
ALTER TABLE departments
  ADD CONSTRAINT dept_head_fk FOREIGN KEY (head_user_id) REFERENCES users(id) ON DELETE SET NULL;
