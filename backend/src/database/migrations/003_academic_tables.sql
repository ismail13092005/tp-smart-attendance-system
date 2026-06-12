-- =============================================================================
-- Migration 003: Academic Tables
-- Order: subjects → classes → enrollments
-- =============================================================================

-- ── subjects ──────────────────────────────────────────────────────────────────
-- A subject is a course definition (e.g. "CS101 - Intro to Programming").
-- It exists independently of terms; classes link subjects to terms.

CREATE TABLE subjects (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(20) NOT NULL,        -- e.g. "CS101"
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  credits         SMALLINT    NOT NULL DEFAULT 3 CHECK (credits BETWEEN 1 AND 10),
  department_id   UUID        NOT NULL,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT subj_dept_fk   FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  CONSTRAINT subj_code_unique UNIQUE (code)
);

-- Index: subject lookup by code (used in session creation forms)
CREATE INDEX idx_subjects_code       ON subjects (code);
-- Index: list subjects by department
CREATE INDEX idx_subjects_department ON subjects (department_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE subjects IS 'Course catalogue. A subject can be offered in multiple terms via classes.';


-- ── classes ───────────────────────────────────────────────────────────────────
-- A class is a subject offered in a specific term, taught by a faculty member.
-- This is the unit students enroll in.

CREATE TABLE classes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id      UUID        NOT NULL,
  term_id         UUID        NOT NULL,
  faculty_user_id UUID        NOT NULL,
  section         VARCHAR(10) NOT NULL DEFAULT 'A',  -- e.g. A, B, Lab-1
  room            VARCHAR(40),                        -- e.g. "Room 101, Block B"
  max_students    SMALLINT    NOT NULL DEFAULT 60,
  schedule_json   JSONB,
  -- e.g. [{"day":"MON","start":"09:00","end":"11:00"},...]
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT cls_subject_fk FOREIGN KEY (subject_id)      REFERENCES subjects(id) ON DELETE RESTRICT,
  CONSTRAINT cls_term_fk    FOREIGN KEY (term_id)          REFERENCES terms(id)    ON DELETE RESTRICT,
  CONSTRAINT cls_faculty_fk FOREIGN KEY (faculty_user_id)  REFERENCES users(id)    ON DELETE RESTRICT,
  -- A faculty member cannot teach the same subject+section twice in one term
  CONSTRAINT cls_unique UNIQUE (subject_id, term_id, section)
);

-- Index: all classes taught by a faculty member (faculty dashboard)
CREATE INDEX idx_classes_faculty  ON classes (faculty_user_id) WHERE deleted_at IS NULL;
-- Index: all classes in a term (admin analytics)
CREATE INDEX idx_classes_term     ON classes (term_id)         WHERE deleted_at IS NULL;
-- Index: all classes for a subject (subject management)
CREATE INDEX idx_classes_subject  ON classes (subject_id)      WHERE deleted_at IS NULL;

COMMENT ON TABLE classes IS 'A subject offered in a term. Students enroll in classes, not subjects.';


-- ── enrollments ───────────────────────────────────────────────────────────────
-- Tracks which students are enrolled in which classes.

CREATE TABLE enrollments (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID              NOT NULL,
  class_id        UUID              NOT NULL,
  status          enrollment_status NOT NULL DEFAULT 'enrolled',
  enrolled_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  dropped_at      TIMESTAMPTZ,
  grade           VARCHAR(5),                  -- final grade, set at term end
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT enr_student_fk FOREIGN KEY (student_user_id) REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT enr_class_fk   FOREIGN KEY (class_id)        REFERENCES classes(id)  ON DELETE RESTRICT,
  -- A student can only be enrolled once per class
  CONSTRAINT enr_unique UNIQUE (student_user_id, class_id)
);

-- Index: all enrollments for a student (student dashboard, history)
CREATE INDEX idx_enrollments_student ON enrollments (student_user_id) WHERE deleted_at IS NULL;
-- Index: all students in a class (faculty session creation, roster)
CREATE INDEX idx_enrollments_class   ON enrollments (class_id)        WHERE deleted_at IS NULL;
-- Index: filter by status (e.g. find all active enrollments)
CREATE INDEX idx_enrollments_status  ON enrollments (status);

COMMENT ON TABLE enrollments IS 'Student↔Class relationship. Soft-deleted to preserve attendance history.';
