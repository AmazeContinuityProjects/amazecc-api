-- ==============================================================================
-- AmazeCC First-Party Faculty Reviews Schema Migration
-- Spec: prompt.md Sections 6, 8, 10
-- Additive migration for Supabase PostgreSQL
-- Strictly Idempotent: safe to run repeatedly on empty or populated databases
-- ==============================================================================

BEGIN;

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Custom Types (Idempotent ENUM creation with exception handling)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_track') THEN
    CREATE TYPE review_track AS ENUM ('teaching', 'project');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'faculty_status') THEN
    CREATE TYPE faculty_status AS ENUM ('official', 'merged', 'hidden');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. Faculty Catalog
CREATE TABLE IF NOT EXISTS faculty (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   TEXT UNIQUE,
  name          TEXT NOT NULL,
  name_norm     TEXT NOT NULL,
  school        TEXT,
  designation   TEXT,
  image_url     TEXT,
  status        faculty_status NOT NULL DEFAULT 'official',
  merged_into   UUID REFERENCES faculty(id) ON DELETE SET NULL,
  vitfac_id     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faculty_name_norm ON faculty (name_norm);
CREATE INDEX IF NOT EXISTS idx_faculty_name_trgm ON faculty USING GIN (name_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_faculty_school ON faculty (school);
CREATE INDEX IF NOT EXISTS idx_faculty_status ON faculty (status);

-- 4. Enrollments (Server-verified proof for Teaching track)
CREATE TABLE IF NOT EXISTS enrollments (
  student_hash  TEXT NOT NULL,
  semester      TEXT NOT NULL,
  course_code   TEXT NOT NULL,
  component     TEXT,
  faculty_id    UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  source        TEXT NOT NULL, -- 'timetable_snapshot' | 'history_inferred'
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (student_hash, semester, course_code, faculty_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student_sem ON enrollments (student_hash, semester);
CREATE INDEX IF NOT EXISTS idx_enrollments_faculty ON enrollments (faculty_id);

-- 5. Reviews Table (Raw submissions, STRICTLY NO FREE-TEXT)
CREATE TABLE IF NOT EXISTS reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_hash  TEXT NOT NULL,
  faculty_id    UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  track         review_track NOT NULL,
  course_code   TEXT,
  semester      TEXT,
  project_term  TEXT,
  verified      BOOLEAN NOT NULL DEFAULT FALSE,
  answers       JSONB NOT NULL,
  tags_green    TEXT[] NOT NULL DEFAULT '{}',
  tags_red      TEXT[] NOT NULL DEFAULT '{}',
  context       JSONB NOT NULL DEFAULT '{}',
  grade_bucket  TEXT, -- 'high' | 'mid' | 'low', NEVER exposed publicly
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Enforce one review per unique tuple
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique_submission ON reviews (
  student_hash,
  faculty_id,
  track,
  COALESCE(course_code, ''),
  COALESCE(semester, ''),
  COALESCE(project_term, '')
);

CREATE INDEX IF NOT EXISTS idx_reviews_faculty_track ON reviews (faculty_id, track);
CREATE INDEX IF NOT EXISTS idx_reviews_student ON reviews (student_hash);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews (created_at DESC);

-- 6. Faculty Aggregates Table (The ONLY table touched by public reads, via snapshots)
CREATE TABLE IF NOT EXISTS faculty_aggregates (
  faculty_id    UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  track         review_track NOT NULL,
  course_code   TEXT NOT NULL DEFAULT '', -- '' = global summary across all courses
  n_reviews     INT NOT NULL DEFAULT 0,
  n_verified    INT NOT NULL DEFAULT 0,
  grade         NUMERIC(3,2), -- NULL until threshold (>= 3 effective reviews) met
  per_question  JSONB NOT NULL DEFAULT '{}',
  style         JSONB NOT NULL DEFAULT '{}',
  tag_counts    JSONB NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (faculty_id, track, course_code)
);

CREATE INDEX IF NOT EXISTS idx_aggregates_faculty ON faculty_aggregates (faculty_id);

-- 7. Unmatched Faculty (Admin-only queue for unknown faculty in timetables)
CREATE TABLE IF NOT EXISTS unmatched_faculty (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_name      TEXT NOT NULL,
  raw_school    TEXT,
  semester      TEXT,
  seen_count    INT NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'open', -- 'open' | 'resolved' | 'ignored'
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unmatched_faculty_seen ON unmatched_faculty (seen_count DESC);
CREATE INDEX IF NOT EXISTS idx_unmatched_faculty_status ON unmatched_faculty (status);

-- 8. Functions & Triggers for Automatic Updated_At Maintenance
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_faculty_updated_at ON faculty;
CREATE TRIGGER trg_faculty_updated_at
  BEFORE UPDATE ON faculty
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON reviews;
CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_faculty_aggregates_updated_at ON faculty_aggregates;
CREATE TRIGGER trg_faculty_aggregates_updated_at
  BEFORE UPDATE ON faculty_aggregates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_unmatched_faculty_updated_at ON unmatched_faculty;
CREATE TRIGGER trg_unmatched_faculty_updated_at
  BEFORE UPDATE ON unmatched_faculty
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Row Level Security (RLS) - Secure all tables
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE unmatched_faculty ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies (Idempotent: DROP POLICY IF EXISTS before CREATE POLICY)
-- Public read access policies for catalog browsing
DROP POLICY IF EXISTS "Allow public read access to active faculty" ON faculty;
CREATE POLICY "Allow public read access to active faculty"
  ON faculty FOR SELECT
  USING (status != 'hidden');

DROP POLICY IF EXISTS "Allow public read access to faculty aggregates" ON faculty_aggregates;
CREATE POLICY "Allow public read access to faculty aggregates"
  ON faculty_aggregates FOR SELECT
  USING (true);

-- Explicit service role policies (if service_role exists, grant full access; raw reviews remain default-deny to anon/auth)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Service role has full access to faculty" ON faculty';
    EXECUTE 'CREATE POLICY "Service role has full access to faculty" ON faculty TO service_role USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Service role has full access to enrollments" ON enrollments';
    EXECUTE 'CREATE POLICY "Service role has full access to enrollments" ON enrollments TO service_role USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Service role has full access to reviews" ON reviews';
    EXECUTE 'CREATE POLICY "Service role has full access to reviews" ON reviews TO service_role USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Service role has full access to faculty_aggregates" ON faculty_aggregates';
    EXECUTE 'CREATE POLICY "Service role has full access to faculty_aggregates" ON faculty_aggregates TO service_role USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Service role has full access to unmatched_faculty" ON unmatched_faculty';
    EXECUTE 'CREATE POLICY "Service role has full access to unmatched_faculty" ON unmatched_faculty TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

COMMIT;
