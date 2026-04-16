-- Migration 015: SKU Audit Trail (T17.5)
-- Creates immutable event log and selective snapshot tables for full SKU
-- lifecycle traceability. Rows are never updated — only inserted.
--
-- sku_key: normalised part_number (trimmed), stable grouping key.
-- See skuAuditService.ts > normalizeSkuKey() for the normalisation rule.

-- ---------------------------------------------------------------------------
-- Event log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sku_audit_events (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_key                text        NOT NULL,
  event_type             text        NOT NULL,
  timestamp              timestamptz NOT NULL DEFAULT timezone('utc', now()),
  actor_type             text        NOT NULL DEFAULT 'UNKNOWN'
                           CHECK (actor_type IN ('USER', 'SYSTEM', 'UNKNOWN')),
  actor_name             text,
  summary                text        NOT NULL,
  reason                 text,
  payload                jsonb,
  before_state           jsonb,
  after_state            jsonb,
  source_artifact_ids    text[],
  generated_artifact_ids text[]
);

COMMENT ON TABLE sku_audit_events IS
  'Immutable lifecycle event log per SKU. Never UPDATE or DELETE rows.';

COMMENT ON COLUMN sku_audit_events.sku_key IS
  'Normalised part number (trimmed). See normalizeSkuKey() in skuAuditService.ts.';

COMMENT ON COLUMN sku_audit_events.event_type IS
  'One of the SkuAuditEventType union values defined in skuAudit.ts.';

COMMENT ON COLUMN sku_audit_events.actor_type IS
  'USER = operator action, SYSTEM = automated, UNKNOWN = actor not yet wired.';

CREATE INDEX IF NOT EXISTS idx_sku_audit_events_sku_key_ts
  ON sku_audit_events (sku_key, timestamp);

CREATE INDEX IF NOT EXISTS idx_sku_audit_events_event_type
  ON sku_audit_events (event_type);

-- ---------------------------------------------------------------------------
-- Snapshot table (selective checkpoints only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sku_audit_snapshots (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_key         text        NOT NULL,
  timestamp       timestamptz NOT NULL DEFAULT timezone('utc', now()),
  snapshot_type   text        NOT NULL
                    CHECK (snapshot_type IN (
                      'INGESTION_BASELINE',
                      'PRE_COMMIT',
                      'COMMITTED',
                      'MANUAL_CHECKPOINT'
                    )),
  effective_state jsonb       NOT NULL,
  summary         text        NOT NULL
);

COMMENT ON TABLE sku_audit_snapshots IS
  'Point-in-time snapshots of effective harness state at key lifecycle milestones.';

COMMENT ON COLUMN sku_audit_snapshots.snapshot_type IS
  'INGESTION_BASELINE: after first analysis. PRE_COMMIT: just before commit.
   COMMITTED: after successful commit. MANUAL_CHECKPOINT: operator-triggered.';

COMMENT ON COLUMN sku_audit_snapshots.effective_state IS
  'Serialised effective harness state (connectivity summary, topology, wire identities,
   decision, Komax cut sheet summary). Does not include raw extraction blobs.';

CREATE INDEX IF NOT EXISTS idx_sku_audit_snapshots_sku_key_ts
  ON sku_audit_snapshots (sku_key, timestamp);

-- ---------------------------------------------------------------------------
-- RLS: permissive for admin workbench (tighten when auth is wired)
-- ---------------------------------------------------------------------------

ALTER TABLE sku_audit_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_audit_snapshots ENABLE ROW LEVEL SECURITY;

-- Temporary open policies — replace with role-based policies once auth is available.
CREATE POLICY IF NOT EXISTS sku_audit_events_open
  ON sku_audit_events FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS sku_audit_snapshots_open
  ON sku_audit_snapshots FOR ALL USING (true) WITH CHECK (true);
