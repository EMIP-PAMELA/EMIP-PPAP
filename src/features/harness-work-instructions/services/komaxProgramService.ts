/**
 * Komax Program Service — Phase T18
 *
 * Derives per-wire and per-batch Komax machine program parameters from the
 * effective harness model. This is Layer 3 of the manufacturing output stack:
 *
 *   Layer 1: KomaxCutSheetRow   (T16) — wire geometry + termination types
 *   Layer 2: KomaxBatch         (T17) — batch grouping for setup optimisation
 *   Layer 3: KomaxWireProgram / KomaxBatchProgram   (T18 ← this service)
 *
 * Governance:
 *   - Pure functions. No I/O, no DB, no side effects. Never throws.
 *   - Reads effectiveState only — never raw extraction.
 *   - Does NOT mutate cut sheet data, batch data, or effective state.
 *   - Does NOT guess or invent machine parameters.
 *   - Unknown / unresolvable values are left null and enumerated in missingFields.
 *   - Deterministic: same effectiveState → identical output every run.
 *   - Non-breaking: T11–T17.5 logic is untouched.
 *
 * Endpoint convention:
 *   left  = WireConnectivity.from   (fixed across every wire)
 *   right = WireConnectivity.to     (fixed across every wire)
 *
 * Process type derivation (§9.2):
 *   CONNECTOR_PIN                → 'CRIMP_FOR_INSERTION'
 *   TERMINAL                     → 'CRIMP'
 *   FERRULE                      → 'FERRULE_CRIMP'
 *   STRIP_ONLY                   → 'CUT_STRIP'
 *   GROUND | RING | SPADE |
 *   RECEPTACLE                   → 'CRIMP'
 *   SPLICE                       → 'SPLICE'
 *   UNKNOWN | OTHER_TREATMENT |
 *   null                         → null  (unresolvable → BLOCKED if endpoint present)
 *
 * Readiness rules (§10):
 *   BLOCKED when ANY of:
 *     - lengthInches is null                    (can't cut without length)
 *     - wireGauge is absent                     (tooling requires gauge)
 *     - leftProcessType is null                 (machine operation indeterminate)
 *     - rightProcessType is null                (machine operation indeterminate)
 *     - leftProcessType  ∈ CRIMP_TYPES AND leftPartNumber  is null  (terminal unknown)
 *     - rightProcessType ∈ CRIMP_TYPES AND rightPartNumber is null  (terminal unknown)
 *   PARTIAL when not BLOCKED but missingFields or warnings are present.
 *   READY   when not BLOCKED and missingFields is empty and warnings is empty.
 *
 * Known limitations documented in missingFields:
 *   - Strip lengths: not present in WireEndpoint model — always operator-required.
 *   - Terminal/applicator part numbers: not present in model — operator-required
 *     for CRIMP, CRIMP_FOR_INSERTION, FERRULE_CRIMP endpoints.
 *   - Applicator/tooling assignments: out of scope for T18.
 */

import type { EffectiveHarnessState } from './effectiveHarnessModelService';
import type { KomaxCutSheetRow, KomaxBatch } from './komaxCutSheetService';
import { buildKomaxCutSheet, buildKomaxBatches } from './komaxCutSheetService';
import type {
  KomaxWireProgram,
  KomaxBatchProgram,
  KomaxProgramBuildResult,
  KomaxProgramReadiness,
} from '../types/komaxProgram';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Process types that require a terminal part number for machine setup. */
const CRIMP_PROCESS_TYPES = new Set(['CRIMP', 'CRIMP_FOR_INSERTION', 'FERRULE_CRIMP']);

/** Process types that require an explicit strip length setting. */
const STRIP_REQUIRED_PROCESS_TYPES = new Set([
  'CRIMP', 'CRIMP_FOR_INSERTION', 'FERRULE_CRIMP', 'CUT_STRIP',
]);

// ---------------------------------------------------------------------------
// Exported helpers (testable independently)
// ---------------------------------------------------------------------------

/**
 * Maps an EndpointTerminationType string to a Komax machine process type label.
 * Returns null when the termination type is unknown, unsupported, or absent —
 * the caller must flag this as a BLOCKED condition.
 */
export function deriveEndpointProcessType(
  terminationType: string | null | undefined,
): string | null {
  switch (terminationType) {
    case 'CONNECTOR_PIN':    return 'CRIMP_FOR_INSERTION';
    case 'TERMINAL':         return 'CRIMP';
    case 'FERRULE':          return 'FERRULE_CRIMP';
    case 'STRIP_ONLY':       return 'CUT_STRIP';
    case 'GROUND':           return 'CRIMP';
    case 'RING':             return 'CRIMP';
    case 'SPADE':            return 'CRIMP';
    case 'RECEPTACLE':       return 'CRIMP';
    case 'SPLICE':           return 'SPLICE';
    // UNKNOWN, OTHER_TREATMENT, null, undefined → unresolvable
    default:                 return null;
  }
}

/**
 * Determines KomaxProgramReadiness from the key fields of a wire program.
 *
 * BLOCKED conditions (any one):
 *   - lengthInches null
 *   - wireGauge absent
 *   - leftProcessType null
 *   - rightProcessType null
 *   - left end is a CRIMP_TYPE and leftPartNumber is null
 *   - right end is a CRIMP_TYPE and rightPartNumber is null
 *
 * PARTIAL: not BLOCKED but missingFields or warnings remain.
 * READY:   not BLOCKED and no missingFields and no warnings.
 */
export function deriveProgramReadiness(args: {
  lengthInches:      number | null | undefined;
  wireGauge:         string | null | undefined;
  leftProcessType:   string | null;
  rightProcessType:  string | null;
  leftPartNumber:    string | null | undefined;
  rightPartNumber:   string | null | undefined;
  missingFields:     string[];
  warnings:          string[];
}): KomaxProgramReadiness {
  if (args.lengthInches == null)        return 'BLOCKED';
  if (!args.wireGauge)                  return 'BLOCKED';
  if (args.leftProcessType  === null)   return 'BLOCKED';
  if (args.rightProcessType === null)   return 'BLOCKED';
  if (CRIMP_PROCESS_TYPES.has(args.leftProcessType)  && !args.leftPartNumber)  return 'BLOCKED';
  if (CRIMP_PROCESS_TYPES.has(args.rightProcessType) && !args.rightPartNumber) return 'BLOCKED';

  if (args.missingFields.length > 0 || args.warnings.length > 0) return 'PARTIAL';
  return 'READY';
}

/**
 * Enumerates machine-critical fields that are absent for a cut-sheet row.
 * Used to populate KomaxWireProgram.missingFields.
 * Strip lengths and terminal part numbers are never present in the current
 * model — these are explicitly flagged as operator-required.
 */
export function summarizeMissingProgramFields(
  leftProcessType:  string | null,
  rightProcessType: string | null,
): string[] {
  const missing: string[] = [];

  if (leftProcessType !== null) {
    if (STRIP_REQUIRED_PROCESS_TYPES.has(leftProcessType)) {
      missing.push('stripLengthLeft (operator-required)');
    }
    if (CRIMP_PROCESS_TYPES.has(leftProcessType)) {
      missing.push('leftPartNumber (operator-required)');
    }
  }

  if (rightProcessType !== null) {
    if (STRIP_REQUIRED_PROCESS_TYPES.has(rightProcessType)) {
      missing.push('stripLengthRight (operator-required)');
    }
    if (CRIMP_PROCESS_TYPES.has(rightProcessType)) {
      missing.push('rightPartNumber (operator-required)');
    }
  }

  return missing;
}

// ---------------------------------------------------------------------------
// Wire program builder
// ---------------------------------------------------------------------------

/**
 * Builds a KomaxWireProgram from a single KomaxCutSheetRow.
 * Exported so callers and tests can invoke it directly without a full
 * EffectiveHarnessState.
 *
 * @param row      Cut sheet row (Layer 1 source of truth).
 * @param skuKey   Normalised SKU part number.
 * @param batchId  Batch assignment for this wire (Layer 2). Null if no batches.
 */
export function buildWireProgram(
  row:     KomaxCutSheetRow,
  skuKey:  string,
  batchId: string | null | undefined,
): KomaxWireProgram {
  const leftProcessType  = deriveEndpointProcessType(row.fromTerminationType ?? null);
  const rightProcessType = deriveEndpointProcessType(row.toTerminationType   ?? null);

  const printRequired = Boolean(row.customerWireId && row.customerWireId.trim() !== '');
  const printText     = printRequired ? (row.customerWireId ?? null) : null;

  // ── missingFields (when process types are resolvable) ──────────────────
  const missingFields: string[] = summarizeMissingProgramFields(leftProcessType, rightProcessType);

  // Unresolvable endpoints — note explicitly
  if (leftProcessType === null) {
    missingFields.push(
      row.fromTerminationType
        ? `leftProcessType (unsupported termination: ${row.fromTerminationType})`
        : 'leftProcessType (termination type unknown)',
    );
  }
  if (rightProcessType === null) {
    missingFields.push(
      row.toTerminationType
        ? `rightProcessType (unsupported termination: ${row.toTerminationType})`
        : 'rightProcessType (termination type unknown)',
    );
  }

  // ── warnings ────────────────────────────────────────────────────────────
  const warnings: string[] = [];

  if (row.topology === 'BRANCH_DOUBLE_CRIMP') {
    warnings.push('Shared crimp group');
    warnings.push('Review branch setup before machine run');
  }

  // Pass through notes from cut sheet (de-duplicated)
  for (const note of row.notes) {
    if (!warnings.includes(note)) warnings.push(note);
  }

  // ── readiness ───────────────────────────────────────────────────────────
  const readiness = deriveProgramReadiness({
    lengthInches:     row.lengthInches,
    wireGauge:        row.wireGauge,
    leftProcessType,
    rightProcessType,
    leftPartNumber:   null, // not in current model
    rightPartNumber:  null, // not in current model
    missingFields,
    warnings,
  });

  return {
    skuKey,
    internalWireId:      row.internalWireId,
    customerWireId:      row.customerWireId ?? null,
    batchId:             batchId ?? null,
    wireGauge:           row.wireGauge           ?? null,
    wireColor:           row.wireColor           ?? null,
    lengthInches:        row.lengthInches,
    leftProcessType,
    rightProcessType,
    leftTerminationType:  row.fromTerminationType ?? null,
    rightTerminationType: row.toTerminationType   ?? null,
    leftPartNumber:       null,
    rightPartNumber:      null,
    stripLengthLeft:      null,
    stripLengthRight:     null,
    printRequired,
    printText,
    topology:            row.topology,
    readiness,
    missingFields,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Batch program builder
// ---------------------------------------------------------------------------

/**
 * Builds a KomaxBatchProgram by rolling up wire program readiness and
 * deriving shared batch-level setup characteristics.
 *
 * Readiness roll-up:
 *   Any BLOCKED wire  → batch BLOCKED
 *   Any PARTIAL wire  → batch PARTIAL (if not already BLOCKED)
 *   All READY wires   → batch READY
 *
 * Heterogeneous process type warning:
 *   If wires in a batch have mixed left or right process types (which
 *   should not occur given the T17 batch grouping key but is checked
 *   defensively), a warning is added.
 */
export function buildBatchProgram(
  batch:        KomaxBatch,
  wirePrograms: KomaxWireProgram[],
  skuKey:       string,
): KomaxBatchProgram {
  // ── Readiness roll-up ──────────────────────────────────────────────────
  let readiness: KomaxProgramReadiness = 'READY';
  if (wirePrograms.some(w => w.readiness === 'BLOCKED'))       readiness = 'BLOCKED';
  else if (wirePrograms.some(w => w.readiness === 'PARTIAL'))  readiness = 'PARTIAL';

  // ── Dominant gauge / color (batch is grouped by these) ────────────────
  const dominantGauge = batch.wires[0]?.wireGauge ?? null;
  const dominantColor = batch.wires[0]?.wireColor ?? null;

  // ── Shared process types ───────────────────────────────────────────────
  const leftTypes  = new Set(wirePrograms.map(w => w.leftProcessType));
  const rightTypes = new Set(wirePrograms.map(w => w.rightProcessType));

  const sharedLeftProcessType  = leftTypes.size  === 1 ? (wirePrograms[0]?.leftProcessType  ?? null) : null;
  const sharedRightProcessType = rightTypes.size === 1 ? (wirePrograms[0]?.rightProcessType ?? null) : null;

  // ── Warnings ───────────────────────────────────────────────────────────
  const warnings: string[] = [];

  if (batch.hasBranchWires) {
    warnings.push('Batch contains branch wires — verify shared crimp setup');
  }
  if (leftTypes.size > 1) {
    warnings.push('Mixed left-end process types within batch — review setup before run');
  }
  if (rightTypes.size > 1) {
    warnings.push('Mixed right-end process types within batch — review setup before run');
  }

  // ── Aggregate missing fields (unique, across all wires) ────────────────
  const allMissing = new Set<string>();
  for (const wp of wirePrograms) {
    for (const f of wp.missingFields) allMissing.add(f);
  }

  return {
    skuKey,
    batchId:              batch.batchId,
    setupSignature:       batch.setupSignature,
    wireIds:              batch.wireIds,
    totalWires:           batch.totalWires,
    dominantGauge,
    dominantColor,
    printRequired:        batch.requiresPrinting,
    branchWiresPresent:   batch.hasBranchWires,
    sharedLeftProcessType,
    sharedRightProcessType,
    readiness,
    missingFields:        Array.from(allMissing),
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

/**
 * Derives the complete Komax program parameter set for the current effective
 * harness state.
 *
 * Call from a useMemo. Internally calls buildKomaxCutSheet and
 * buildKomaxBatches — results are not cached.
 * Returns an empty result when connectivity or identity data is absent.
 */
export function buildKomaxPrograms(
  effectiveState: EffectiveHarnessState,
): KomaxProgramBuildResult {
  const skuKey    = effectiveState.effectivePartNumber?.trim() ?? '';
  const cutSheet  = buildKomaxCutSheet(effectiveState);
  const batches   = buildKomaxBatches(effectiveState);

  if (cutSheet.rows.length === 0) {
    return {
      wirePrograms:  [],
      batchPrograms: [],
      summary: {
        readyWirePrograms:    0,
        partialWirePrograms:  0,
        blockedWirePrograms:  0,
        readyBatchPrograms:   0,
        partialBatchPrograms: 0,
        blockedBatchPrograms: 0,
      },
    };
  }

  // ── Wire ID → batch ID lookup ──────────────────────────────────────────
  const wireIdToBatchId = new Map<string, string>();
  for (const batch of batches.batches) {
    for (const wid of batch.wireIds) wireIdToBatchId.set(wid, batch.batchId);
  }

  // ── Wire programs ──────────────────────────────────────────────────────
  const wirePrograms: KomaxWireProgram[] = cutSheet.rows.map(row =>
    buildWireProgram(row, skuKey, wireIdToBatchId.get(row.internalWireId) ?? null),
  );

  const wireProgramByInternalId = new Map<string, KomaxWireProgram>(
    wirePrograms.map(wp => [wp.internalWireId, wp]),
  );

  // ── Batch programs ─────────────────────────────────────────────────────
  const batchPrograms: KomaxBatchProgram[] = batches.batches.map(batch => {
    const batchWirePrograms = batch.wireIds
      .map(id => wireProgramByInternalId.get(id))
      .filter((wp): wp is KomaxWireProgram => wp != null);
    return buildBatchProgram(batch, batchWirePrograms, skuKey);
  });

  // ── Summary ────────────────────────────────────────────────────────────
  const summary = {
    readyWirePrograms:    wirePrograms.filter(w => w.readiness === 'READY').length,
    partialWirePrograms:  wirePrograms.filter(w => w.readiness === 'PARTIAL').length,
    blockedWirePrograms:  wirePrograms.filter(w => w.readiness === 'BLOCKED').length,
    readyBatchPrograms:   batchPrograms.filter(b => b.readiness === 'READY').length,
    partialBatchPrograms: batchPrograms.filter(b => b.readiness === 'PARTIAL').length,
    blockedBatchPrograms: batchPrograms.filter(b => b.readiness === 'BLOCKED').length,
  };

  console.log('[T18 KOMAX PROGRAMS]', {
    totalWires:           wirePrograms.length,
    readyWirePrograms:    summary.readyWirePrograms,
    partialWirePrograms:  summary.partialWirePrograms,
    blockedWirePrograms:  summary.blockedWirePrograms,
  });

  return { wirePrograms, batchPrograms, summary };
}

// ---------------------------------------------------------------------------
// CSV export helpers
// ---------------------------------------------------------------------------

function csvCell(v: string | number | boolean | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const WIRE_PROGRAM_HEADERS = [
  'Wire', 'Cust ID', 'Batch', 'Length (in)', 'Gauge', 'Color',
  'Left Process', 'Right Process', 'Print', 'Print Text',
  'Topology', 'Readiness', 'Missing Fields', 'Warnings',
] as const;

const BATCH_PROGRAM_HEADERS = [
  'Batch', 'Setup', 'Qty', 'Gauge', 'Color',
  'Left Process', 'Right Process', 'Print Required', 'Branch Wires',
  'Readiness', 'Missing Fields', 'Warnings',
] as const;

/**
 * Serialises wire programs to CSV.
 * Exported separately so the UI can trigger wire-only or batch-only downloads.
 */
export function buildKomaxProgramWireCsv(result: KomaxProgramBuildResult): string {
  const header = WIRE_PROGRAM_HEADERS.join(',');
  const rows   = result.wirePrograms.map(w => [
    w.internalWireId,
    w.customerWireId,
    w.batchId,
    w.lengthInches,
    w.wireGauge,
    w.wireColor,
    w.leftProcessType,
    w.rightProcessType,
    w.printRequired ? 'YES' : 'NO',
    w.printText,
    w.topology,
    w.readiness,
    w.missingFields.join('; '),
    w.warnings.join('; '),
  ].map(csvCell).join(','));
  return [header, ...rows].join('\r\n');
}

/**
 * Serialises batch programs to CSV.
 */
export function buildKomaxProgramBatchCsv(result: KomaxProgramBuildResult): string {
  const header = BATCH_PROGRAM_HEADERS.join(',');
  const rows   = result.batchPrograms.map(b => [
    b.batchId,
    b.setupSignature,
    b.totalWires,
    b.dominantGauge,
    b.dominantColor,
    b.sharedLeftProcessType,
    b.sharedRightProcessType,
    b.printRequired      ? 'YES' : 'NO',
    b.branchWiresPresent ? 'YES' : 'NO',
    b.readiness,
    b.missingFields.join('; '),
    b.warnings.join('; '),
  ].map(csvCell).join(','));
  return [header, ...rows].join('\r\n');
}

/**
 * Combined wire + batch program CSV in one file.
 * Wire section first (## WIRE PROGRAMS), batch section second (## BATCH PROGRAMS).
 */
export function buildKomaxProgramCsv(result: KomaxProgramBuildResult): string {
  return [
    '## WIRE PROGRAMS',
    buildKomaxProgramWireCsv(result),
    '',
    '## BATCH PROGRAMS',
    buildKomaxProgramBatchCsv(result),
  ].join('\r\n');
}
