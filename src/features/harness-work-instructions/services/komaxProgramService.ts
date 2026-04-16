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
 * T18.5 update:
 *   - Strip lengths: resolved from ACI table when partNumber is present; otherwise operator-required.
 *   - Terminal/applicator part numbers: operator-set or ACI-resolved; BLOCKED when missing for crimp ends.
 *   - Process source (ACI_TABLE / OPERATOR / null) is surfaced per endpoint for UI display.
 *
 * T19 update:
 *   - Tooling resolved via toolingService (ACI-first, direct-fallback).
 *   - BLOCKED when CRIMP/FERRULE_CRIMP has part number but no applicator (method === NONE).
 *   - DIRECT match: not blocked, adds warning.
 *   - Batch-level toolingCoverage: SINGLE_SETUP | MULTI_SETUP | MISSING.
 */

import type { EffectiveHarnessState } from './effectiveHarnessModelService';
import { resolveToolingForPart } from './toolingService';
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
  lengthInches:        number | null | undefined;
  wireGauge:           string | null | undefined;
  leftProcessType:     string | null;
  rightProcessType:    string | null;
  leftPartNumber:      string | null | undefined;
  rightPartNumber:     string | null | undefined;
  /** T19: Resolution method for left-end tooling. 'NONE' + part number present → BLOCKED. */
  leftToolingMethod?:  string | null;
  /** T19: Resolution method for right-end tooling. 'NONE' + part number present → BLOCKED. */
  rightToolingMethod?: string | null;
  missingFields:       string[];
  warnings:            string[];
}): KomaxProgramReadiness {
  if (args.lengthInches == null)        return 'BLOCKED';
  if (!args.wireGauge)                  return 'BLOCKED';
  if (args.leftProcessType  === null)   return 'BLOCKED';
  if (args.rightProcessType === null)   return 'BLOCKED';
  if (CRIMP_PROCESS_TYPES.has(args.leftProcessType)  && !args.leftPartNumber)  return 'BLOCKED';
  if (CRIMP_PROCESS_TYPES.has(args.rightProcessType) && !args.rightPartNumber) return 'BLOCKED';

  // T19: Block when part number is known but no applicator can be found.
  // DIRECT match is NOT blocked — it adds a warning instead (handled in buildWireProgram).
  if (CRIMP_PROCESS_TYPES.has(args.leftProcessType)  && args.leftPartNumber  && args.leftToolingMethod  === 'NONE') return 'BLOCKED';
  if (CRIMP_PROCESS_TYPES.has(args.rightProcessType) && args.rightPartNumber && args.rightToolingMethod === 'NONE') return 'BLOCKED';

  if (args.missingFields.length > 0 || args.warnings.length > 0) return 'PARTIAL';
  return 'READY';
}

/**
 * Enumerates machine-critical fields that are absent for a cut-sheet row.
 * Only flags fields that are ACTUALLY missing — already-resolved values
 * (via ACI lookup or operator input) are NOT reported as missing.
 *
 * T18.5: now accepts the actual resolved values so that ACI-filled
 * strip lengths and operator-set part numbers do not appear as missing.
 */
export function summarizeMissingProgramFields(args: {
  leftProcessType:   string | null;
  rightProcessType:  string | null;
  leftPartNumber:    string | null | undefined;
  rightPartNumber:   string | null | undefined;
  stripLengthLeft:   string | null | undefined;
  stripLengthRight:  string | null | undefined;
}): string[] {
  const {
    leftProcessType, rightProcessType,
    leftPartNumber,  rightPartNumber,
    stripLengthLeft, stripLengthRight,
  } = args;

  const missing: string[] = [];

  if (leftProcessType !== null) {
    if (STRIP_REQUIRED_PROCESS_TYPES.has(leftProcessType) && !stripLengthLeft) {
      missing.push('stripLengthLeft (operator-required)');
    }
    if (CRIMP_PROCESS_TYPES.has(leftProcessType) && !leftPartNumber) {
      missing.push('leftPartNumber (operator-required)');
    }
  }

  if (rightProcessType !== null) {
    if (STRIP_REQUIRED_PROCESS_TYPES.has(rightProcessType) && !stripLengthRight) {
      missing.push('stripLengthRight (operator-required)');
    }
    if (CRIMP_PROCESS_TYPES.has(rightProcessType) && !rightPartNumber) {
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

  // T18.5: use actual resolved values from enriched cut-sheet row
  const leftPartNumber   = row.fromPartNumber   ?? null;
  const rightPartNumber  = row.toPartNumber     ?? null;
  const stripLengthLeft  = row.fromStripLength  ?? null;
  const stripLengthRight = row.toStripLength    ?? null;
  const leftProcessSource  = row.fromProcessSource ?? null;
  const rightProcessSource = row.toProcessSource   ?? null;

  const printRequired = Boolean(row.customerWireId && row.customerWireId.trim() !== '');
  const printText     = printRequired ? (row.customerWireId ?? null) : null;

  // ── T19: Tooling resolution (crimp endpoints with known part numbers only) ───
  const leftNeedsCrimp  = leftProcessType  !== null && CRIMP_PROCESS_TYPES.has(leftProcessType);
  const rightNeedsCrimp = rightProcessType !== null && CRIMP_PROCESS_TYPES.has(rightProcessType);

  const leftTooling  = (leftNeedsCrimp  && leftPartNumber)  ? resolveToolingForPart(leftPartNumber)  : null;
  const rightTooling = (rightNeedsCrimp && rightPartNumber) ? resolveToolingForPart(rightPartNumber) : null;

  // ── missingFields ───────────────────────────────────────────────────────────
  const missingFields: string[] = summarizeMissingProgramFields({
    leftProcessType,
    rightProcessType,
    leftPartNumber,
    rightPartNumber,
    stripLengthLeft,
    stripLengthRight,
  });

  // Tooling missing fields (only when part number is known but no applicator found)
  if (leftNeedsCrimp  && leftPartNumber  && leftTooling?.method  === 'NONE') {
    missingFields.push('leftTooling (no applicator found)');
  }
  if (rightNeedsCrimp && rightPartNumber && rightTooling?.method === 'NONE') {
    missingFields.push('rightTooling (no applicator found)');
  }

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

  // ── warnings ───────────────────────────────────────────────────────────
  const warnings: string[] = [];

  if (row.topology === 'BRANCH_DOUBLE_CRIMP') {
    warnings.push('Shared crimp group');
    warnings.push('Review branch setup before machine run');
  }

  // T19: Direct tooling match — not blocked but operator should verify
  if (leftTooling?.method  === 'DIRECT') warnings.push('Left tooling resolved via direct part match — verify applicator');
  if (rightTooling?.method === 'DIRECT') warnings.push('Right tooling resolved via direct part match — verify applicator');

  // Pass through notes from cut sheet (de-duplicated)
  for (const note of row.notes) {
    if (!warnings.includes(note)) warnings.push(note);
  }

  // ── T19: Wire-level tooling summary ─────────────────────────────────────
  const leftHasTooling  = !leftNeedsCrimp  || !leftPartNumber  || leftTooling?.method  !== 'NONE';
  const rightHasTooling = !rightNeedsCrimp || !rightPartNumber || rightTooling?.method !== 'NONE';
  const toolingAvailable: boolean | null =
    (leftNeedsCrimp || rightNeedsCrimp) ? (leftHasTooling && rightHasTooling) : null;

  const toolingLocations = [...new Set([
    ...(leftTooling?.locations  ?? []),
    ...(rightTooling?.locations ?? []),
  ])];

  // Worst-case method across crimp endpoints
  let toolingMethod: string | null = null;
  if (leftNeedsCrimp  && leftPartNumber)  toolingMethod = leftTooling?.method  ?? 'NONE';
  if (rightNeedsCrimp && rightPartNumber) {
    const rm = rightTooling?.method ?? 'NONE';
    if      (toolingMethod === null)    toolingMethod = rm;
    else if (rm === 'NONE')             toolingMethod = 'NONE';
    else if (toolingMethod !== 'NONE' && rm === 'DIRECT') toolingMethod = 'DIRECT';
  }
  const toolingConfidence: string | null =
    toolingMethod === 'ACI'    ? 'HIGH'   :
    toolingMethod === 'DIRECT' ? 'MEDIUM' :
    toolingMethod === 'NONE'   ? 'NONE'   : null;

  // ── readiness ───────────────────────────────────────────────────────────
  const readiness = deriveProgramReadiness({
    lengthInches:       row.lengthInches,
    wireGauge:          row.wireGauge,
    leftProcessType,
    rightProcessType,
    leftPartNumber,
    rightPartNumber,
    leftToolingMethod:  leftTooling?.method  ?? null,
    rightToolingMethod: rightTooling?.method ?? null,
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
    leftPartNumber,
    rightPartNumber,
    stripLengthLeft,
    stripLengthRight,
    leftProcessSource,
    rightProcessSource,
    toolingAvailable,
    toolingMethod,
    toolingConfidence,
    toolingLocations,
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

  // ── T19: Batch tooling coverage ─────────────────────────────────────────
  const CRIMP_SET = new Set(['CRIMP', 'CRIMP_FOR_INSERTION', 'FERRULE_CRIMP']);
  const crimpWires = wirePrograms.filter(w =>
    CRIMP_SET.has(w.leftProcessType ?? '') || CRIMP_SET.has(w.rightProcessType ?? ''),
  );

  let toolingCoverage: 'SINGLE_SETUP' | 'MULTI_SETUP' | 'MISSING' | null = null;
  if (crimpWires.length > 0) {
    const anyMissing = crimpWires.some(w => w.toolingAvailable === false);
    if (anyMissing) {
      toolingCoverage = 'MISSING';
      warnings.push('Batch missing tooling for one or more wires');
    } else {
      const locSets = crimpWires.map(w => new Set(w.toolingLocations ?? []));
      let intersection = new Set(locSets[0]);
      for (let i = 1; i < locSets.length; i++) {
        for (const loc of intersection) {
          if (!locSets[i].has(loc)) intersection.delete(loc);
        }
      }
      if (intersection.size === 0 && locSets.length > 1) {
        toolingCoverage = 'MULTI_SETUP';
        warnings.push('Batch requires multiple plant/tooling setups');
      } else {
        toolingCoverage = 'SINGLE_SETUP';
      }
    }
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
    toolingCoverage,
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
