-- ============================================================
-- HWI.5 — Approval Persistence Schema
-- Run this in your Supabase SQL Editor before using HWI.5
-- ============================================================

-- Approved instruction jobs (one row per approved version)
CREATE TABLE IF NOT EXISTS harness_instruction_jobs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number  TEXT        NOT NULL,
  revision     TEXT        NOT NULL,
  version      INTEGER     NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'approved',
  data         JSONB       NOT NULL,          -- full HarnessInstructionJob JSON
  approved_at  TIMESTAMPTZ NOT NULL,
  approved_by  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT hwi_jobs_part_rev_version UNIQUE (part_number, revision, version)
);

CREATE INDEX IF NOT EXISTS idx_hwi_jobs_part_number
  ON harness_instruction_jobs (part_number);

CREATE INDEX IF NOT EXISTS idx_hwi_jobs_part_rev
  ON harness_instruction_jobs (part_number, revision);

CREATE INDEX IF NOT EXISTS idx_hwi_jobs_created
  ON harness_instruction_jobs (created_at DESC);

-- PDF artifacts linked to approved jobs
CREATE TABLE IF NOT EXISTS harness_instruction_artifacts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     UUID        NOT NULL REFERENCES harness_instruction_jobs(id) ON DELETE CASCADE,
  file_name  TEXT        NOT NULL,
  file_url   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hwi_artifacts_job_id
  ON harness_instruction_artifacts (job_id);

-- ============================================================
-- Supabase Storage bucket (run separately or via Dashboard)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('harness-instructions', 'harness-instructions', true)
-- ON CONFLICT (id) DO NOTHING;
