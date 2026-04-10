-- Migration 003: HWI Resolution Memory Table
-- Phase HWI.12 — Human Resolution Learning Engine
--
-- Stores human-approved wire match, endpoint, terminal, and tooling decisions
-- for deterministic reuse in future jobs. Learning is additive — existing
-- entries are updated (upsert) on each new approval for the same context.
--
-- Run against Supabase project after 001 and 002.

CREATE TABLE IF NOT EXISTS hwi_resolution_memory (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type      text         NOT NULL,   -- 'WIRE_MATCH' | 'ENDPOINT' | 'TERMINAL' | 'TOOLING'
  context_signature text         NOT NULL,   -- deterministic normalized lookup key
  decision          jsonb        NOT NULL,   -- context-specific JSON payload
  confidence        float        NOT NULL DEFAULT 1.0,
  source            text         NOT NULL DEFAULT 'MANUAL_APPROVED',
  created_at        timestamptz  NOT NULL DEFAULT now(),

  -- Unique key enables upsert without duplicates; context_type + signature
  -- together identify a unique resolution across all types.
  CONSTRAINT hwi_resolution_memory_type_sig_unique
    UNIQUE (context_type, context_signature)
);

-- Index for single-column lookups (batch .in() queries)
CREATE INDEX IF NOT EXISTS hwi_resolution_memory_signature_idx
  ON hwi_resolution_memory (context_signature);

-- Index for filtered lookups (context_type + signature)
CREATE INDEX IF NOT EXISTS hwi_resolution_memory_type_sig_idx
  ON hwi_resolution_memory (context_type, context_signature);

-- Table + column comments for Supabase documentation
COMMENT ON TABLE hwi_resolution_memory IS
  'Persistent human resolution memory for HWI wire match, endpoint, and tooling decisions.';
COMMENT ON COLUMN hwi_resolution_memory.context_type IS
  'Category of decision: WIRE_MATCH | ENDPOINT | TERMINAL | TOOLING';
COMMENT ON COLUMN hwi_resolution_memory.context_signature IS
  'Normalized, deterministic key — see learningSignatures.ts for builder functions';
COMMENT ON COLUMN hwi_resolution_memory.decision IS
  'JSON payload specific to context_type — WireMatchDecision | EndpointDecision | TerminalDecision | ToolingDecision';
COMMENT ON COLUMN hwi_resolution_memory.confidence IS
  'Confidence in this decision (0–1). Defaults to 1.0 for MANUAL_APPROVED entries.';
COMMENT ON COLUMN hwi_resolution_memory.source IS
  'Origin of the decision: MANUAL_APPROVED (from approved job)';
