/**
 * SKU Audit Service — Phase T17.5
 *
 * Provides:
 *   - Pure utility functions (safe to import in tests — no Supabase at module level).
 *   - Async IO functions that write/read from `sku_audit_events` and
 *     `sku_audit_snapshots` Supabase tables via a lazy-loaded client.
 *
 * Governance:
 *   - IO functions NEVER throw. Audit failures are logged and swallowed so
 *     they NEVER block operator workflow.
 *   - Supabase client is loaded lazily (inside async functions only) so this
 *     module is safe to import in node:test test files.
 *   - Events are immutable after write.
 *
 * SKU key rule:
 *   normalizeSkuKey(confirmedPartNumber ?? proposedPartNumber ?? workbenchItemId)
 *   — trim whitespace; preserve original casing (part numbers may be case-sensitive).
 */

import type {
  SkuAuditEvent,
  SkuAuditEventInput,
  SkuAuditEventType,
  SkuAuditSnapshot,
  SkuAuditSnapshotInput,
} from '@/src/features/harness-work-instructions/types/skuAudit';

const AUDIT_ENABLED = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_ENABLE_AUDIT === 'true';
let auditDisabledNotified = false;
function notifyAuditDisabled() {
  if (auditDisabledNotified) return;
  auditDisabledNotified = true;
  console.log('[T23.6.58 AUDIT DISABLED]');
}

// ---------------------------------------------------------------------------
// Lazy Supabase loader (keeps module side-effect-free at import time)
// ---------------------------------------------------------------------------

async function getDb() {
  const { supabase } = await import('@/src/lib/supabaseClient');
  return supabase;
}

// ---------------------------------------------------------------------------
// Pure utilities — safe to test without DB
// ---------------------------------------------------------------------------

/**
 * Normalizes a raw part number / identifier into a stable audit grouping key.
 * Rule: trim leading/trailing whitespace. Case is preserved.
 */
export function normalizeSkuKey(raw: string): string {
  return raw.trim();
}

/**
 * Builds a complete SkuAuditEvent from input, generating id and timestamp
 * if they are not supplied.
 */
export function buildAuditEvent(input: SkuAuditEventInput): SkuAuditEvent {
  return {
    id:                    input.id        ?? crypto.randomUUID(),
    timestamp:             input.timestamp ?? new Date().toISOString(),
    skuKey:                normalizeSkuKey(input.skuKey),
    eventType:             input.eventType,
    actorType:             input.actorType,
    actorName:             input.actorName             ?? null,
    summary:               input.summary,
    reason:                input.reason               ?? null,
    payload:               input.payload              ?? null,
    beforeState:           input.beforeState          ?? null,
    afterState:            input.afterState           ?? null,
    sourceArtifactIds:     input.sourceArtifactIds    ?? null,
    generatedArtifactIds:  input.generatedArtifactIds ?? null,
  };
}

/**
 * Builds a complete SkuAuditSnapshot from input, generating id and timestamp
 * if they are not supplied.
 */
export function buildAuditSnapshot(input: SkuAuditSnapshotInput): SkuAuditSnapshot {
  return {
    id:             input.id        ?? crypto.randomUUID(),
    timestamp:      input.timestamp ?? new Date().toISOString(),
    skuKey:         normalizeSkuKey(input.skuKey),
    snapshotType:   input.snapshotType,
    effectiveState: input.effectiveState,
    summary:        input.summary,
  };
}

/**
 * Returns events sorted ascending by timestamp (earliest first).
 */
export function sortEventsByTimestamp(events: SkuAuditEvent[]): SkuAuditEvent[] {
  return [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Builds a concise one-line diff description for wire-level change events.
 * Used for timeline display and CSV summary column.
 */
export function buildWireDiffSummary(
  eventType: SkuAuditEventType,
  payload: Record<string, unknown>,
): string {
  const wireId = String(payload.wireId ?? 'unknown');
  switch (eventType) {
    case 'SKU_WIRE_ADDED':
      return `Wire added: ${wireId}`;
    case 'SKU_WIRE_EDITED': {
      const field  = payload.field  ? ` — ${payload.field} changed` : '';
      const before = payload.before ? ` from "${payload.before}"` : '';
      const after  = payload.after  ? ` to "${payload.after}"` : '';
      return `Wire edited: ${wireId}${field}${before}${after}`;
    }
    case 'SKU_WIRE_DELETED':
      return `Wire deleted: ${wireId}`;
    case 'WIRE_OVERRIDE_APPLIED':
      return `Override applied: wire ${wireId} mode ${payload.mode ?? ''}`;
    case 'BRANCH_DECLARED':
      return `Branch declared at wire ${wireId}`;
    default:
      return eventType.replace(/_/g, ' ').toLowerCase();
  }
}

/**
 * Produces a compact textual summary of a SKU's lifecycle from its events.
 */
export function buildSkuAuditSummary(events: SkuAuditEvent[]): string {
  if (events.length === 0) return 'No events recorded.';
  const sorted    = sortEventsByTimestamp(events);
  const first     = sorted[0];
  const last      = sorted[sorted.length - 1];
  const committed = sorted.find(e => e.eventType === 'SKU_COMMITTED');
  const parts: string[] = [
    `First: ${first.eventType} at ${first.timestamp}`,
    `Latest: ${last.eventType} at ${last.timestamp}`,
    committed
      ? `Committed: ${committed.timestamp}`
      : 'Not yet committed',
    `Total events: ${events.length}`,
  ];
  return parts.join(' | ');
}

// ---------------------------------------------------------------------------
// IO functions — async, lazy Supabase, never throw
// ---------------------------------------------------------------------------

/**
 * Writes a single audit event to `sku_audit_events`.
 * Fire-and-forget safe: never throws, logs errors to console only.
 */
export async function recordSkuAuditEvent(input: SkuAuditEventInput): Promise<void> {
  if (!AUDIT_ENABLED) {
    notifyAuditDisabled();
    return;
  }
  try {
    const event = buildAuditEvent(input);
    const db = await getDb();
    const { error } = await db.from('sku_audit_events').insert({
      id:                     event.id,
      sku_key:                event.skuKey,
      event_type:             event.eventType,
      timestamp:              event.timestamp,
      actor_type:             event.actorType,
      actor_name:             event.actorName,
      summary:                event.summary,
      reason:                 event.reason,
      payload:                event.payload,
      before_state:           event.beforeState,
      after_state:            event.afterState,
      source_artifact_ids:    event.sourceArtifactIds,
      generated_artifact_ids: event.generatedArtifactIds,
    });
    if (error) {
      console.warn('[SkuAudit] recordSkuAuditEvent failed:', error.message);
    }
  } catch (err) {
    console.warn('[SkuAudit] recordSkuAuditEvent exception:', err);
  }
}

/**
 * Writes a snapshot to `sku_audit_snapshots`.
 * Fire-and-forget safe: never throws.
 */
export async function recordSkuAuditSnapshot(input: SkuAuditSnapshotInput): Promise<void> {
  if (!AUDIT_ENABLED) {
    notifyAuditDisabled();
    return;
  }
  try {
    const snap = buildAuditSnapshot(input);
    const db = await getDb();
    const { error } = await db.from('sku_audit_snapshots').insert({
      id:              snap.id,
      sku_key:         snap.skuKey,
      timestamp:       snap.timestamp,
      snapshot_type:   snap.snapshotType,
      effective_state: snap.effectiveState,
      summary:         snap.summary,
    });
    if (error) {
      console.warn('[SkuAudit] recordSkuAuditSnapshot failed:', error.message);
    }
  } catch (err) {
    console.warn('[SkuAudit] recordSkuAuditSnapshot exception:', err);
  }
}

/**
 * Fetches all audit events for a SKU, ordered ascending by timestamp.
 * Returns [] on any error.
 */
export async function listSkuAuditEvents(skuKey: string): Promise<SkuAuditEvent[]> {
  if (!AUDIT_ENABLED) {
    notifyAuditDisabled();
    return [];
  }
  try {
    const key = normalizeSkuKey(skuKey);
    const db = await getDb();
    const { data, error } = await db
      .from('sku_audit_events')
      .select('*')
      .eq('sku_key', key)
      .order('timestamp', { ascending: true });
    if (error) {
      console.warn('[SkuAudit] listSkuAuditEvents failed:', error.message);
      return [];
    }
    return (data ?? []).map(row => ({
      id:                    row.id,
      skuKey:                row.sku_key,
      eventType:             row.event_type as SkuAuditEvent['eventType'],
      timestamp:             row.timestamp,
      actorType:             row.actor_type,
      actorName:             row.actor_name ?? null,
      summary:               row.summary,
      reason:                row.reason ?? null,
      payload:               row.payload ?? null,
      beforeState:           row.before_state ?? null,
      afterState:            row.after_state ?? null,
      sourceArtifactIds:     row.source_artifact_ids ?? null,
      generatedArtifactIds:  row.generated_artifact_ids ?? null,
    }));
  } catch (err) {
    console.warn('[SkuAudit] listSkuAuditEvents exception:', err);
    return [];
  }
}

/**
 * Fetches all snapshots for a SKU, ordered ascending by timestamp.
 * Returns [] on any error.
 */
export async function listSkuAuditSnapshots(skuKey: string): Promise<SkuAuditSnapshot[]> {
  if (!AUDIT_ENABLED) {
    notifyAuditDisabled();
    return [];
  }
  try {
    const key = normalizeSkuKey(skuKey);
    const db = await getDb();
    const { data, error } = await db
      .from('sku_audit_snapshots')
      .select('*')
      .eq('sku_key', key)
      .order('timestamp', { ascending: true });
    if (error) {
      console.warn('[SkuAudit] listSkuAuditSnapshots failed:', error.message);
      return [];
    }
    return (data ?? []).map(row => ({
      id:             row.id,
      skuKey:         row.sku_key,
      timestamp:      row.timestamp,
      snapshotType:   row.snapshot_type as SkuAuditSnapshot['snapshotType'],
      effectiveState: row.effective_state ?? {},
      summary:        row.summary,
    }));
  } catch (err) {
    console.warn('[SkuAudit] listSkuAuditSnapshots exception:', err);
    return [];
  }
}

/**
 * Serializes all events and snapshots for a SKU as a JSON string suitable
 * for download / audit export.
 */
export async function exportSkuAuditAsJson(skuKey: string): Promise<string> {
  if (!AUDIT_ENABLED) {
    notifyAuditDisabled();
    return JSON.stringify({ skuKey: normalizeSkuKey(skuKey), events: [], snapshots: [] }, null, 2);
  }
  const [events, snapshots] = await Promise.all([
    listSkuAuditEvents(skuKey),
    listSkuAuditSnapshots(skuKey),
  ]);
  return JSON.stringify({ skuKey: normalizeSkuKey(skuKey), events, snapshots }, null, 2);
}

/**
 * Converts the event list for a SKU to a CSV string for spreadsheet export.
 * Columns: id, timestamp, eventType, actorType, actorName, summary, reason
 */
export async function exportSkuAuditAsCsv(skuKey: string): Promise<string> {
  const header = 'id,timestamp,eventType,actorType,actorName,summary,reason';
  if (!AUDIT_ENABLED) {
    notifyAuditDisabled();
    return header;
  }
  const events = await listSkuAuditEvents(skuKey);
  const rows = events.map(e => [
    e.id,
    e.timestamp,
    e.eventType,
    e.actorType,
    e.actorName ?? '',
    `"${(e.summary ?? '').replace(/"/g, '""')}"`,
    `"${(e.reason  ?? '').replace(/"/g, '""')}"`,
  ].join(','));
  return [header, ...rows].join('\n');
}
