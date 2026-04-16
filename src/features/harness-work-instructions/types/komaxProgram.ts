/**
 * Komax Program Parameter Types — Phase T18
 *
 * Layer 3 of the manufacturing output stack:
 *   1. Wire-level truth   → KomaxCutSheetRow        (T16)
 *   2. Batch-level truth  → KomaxBatch              (T17)
 *   3. Program-level truth → KomaxWireProgram /
 *                            KomaxBatchProgram       (T18 ← this file)
 *
 * Governance:
 *   - Known values are explicit; unknown / unresolvable values are null.
 *   - Missing fields are enumerated in `missingFields[]` with explicit labels.
 *   - readiness reflects data completeness — never optimistic.
 *   - Types are read-only output models; nothing in this file is mutated.
 */

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

/**
 * READY   — all required program fields for the derived process types are present.
 * PARTIAL — core machine geometry present; some machine-critical details missing
 *           (e.g. strip lengths, terminal part numbers for non-crimp ends).
 * BLOCKED — missing a core value that prevents any machine operation:
 *           length, gauge, process type derivation failure, or terminal part
 *           number for a crimp-type endpoint.
 */
export type KomaxProgramReadiness = 'READY' | 'PARTIAL' | 'BLOCKED';

// ---------------------------------------------------------------------------
// Wire-level program
// ---------------------------------------------------------------------------

/**
 * Per-wire Komax machine program parameters.
 *
 * Endpoint normalisation convention (fixed across all wires):
 *   left  = "from" endpoint (WireConnectivity.from)
 *   right = "to"   endpoint (WireConnectivity.to)
 *
 * This mapping never varies. See komaxProgramService.ts for derivation rules.
 */
export interface KomaxWireProgram {
  /** Normalised SKU part number — stable grouping key. */
  skuKey: string;
  /** Deterministic internal wire label (W1, W4A, W4B…). */
  internalWireId: string;
  /**
   * Customer-visible wire label from the drawing, if present.
   * Never auto-substituted with internalWireId.
   */
  customerWireId?: string | null;

  /** Batch this wire belongs to (B01, B02…), if batch grouping was applied. */
  batchId?: string | null;

  /** Wire gauge string as-extracted (e.g. "20 AWG"). Null = not in model. */
  wireGauge?: string | null;
  wireColor?: string | null;
  /** Wire length in inches. Null = not in model — BLOCKED condition. */
  lengthInches?: number | null;

  /**
   * Komax machine process type at the left (FROM) end.
   * Derived from EndpointTerminationType. Null = unresolvable → BLOCKED.
   * Values: 'CRIMP_FOR_INSERTION' | 'CRIMP' | 'FERRULE_CRIMP' |
   *         'CUT_STRIP' | 'SPLICE' | null
   */
  leftProcessType?: string | null;
  /** Komax machine process type at the right (TO) end. */
  rightProcessType?: string | null;

  /** Raw termination type string that drove leftProcessType derivation. */
  leftTerminationType?: string | null;
  rightTerminationType?: string | null;

  /**
   * Terminal or applicator part number at the left end.
   * Null = not in current model → operator-required for crimp endpoints.
   */
  leftPartNumber?: string | null;
  rightPartNumber?: string | null;

  /**
   * Strip length at the left end (machine setting).
   * Null = not in model or not resolved from ACI — operator-required.
   */
  stripLengthLeft?: string | null;
  stripLengthRight?: string | null;

  /**
   * T18.5: Authority source for left/right endpoint process data.
   * 'ACI_TABLE' = auto-resolved from ACI lookup.
   * 'OPERATOR'  = explicitly set by operator.
   * null        = not available / not enriched.
   */
  leftProcessSource?:  string | null;
  rightProcessSource?: string | null;

  /** True when a machine-printed wire label is required for this wire. */
  printRequired: boolean;
  /** The label text to print. null when printRequired is false. */
  printText?: string | null;

  /** Wire-level topology classification (NORMAL | BRANCH_DOUBLE_CRIMP | SPLICE). */
  topology?: string | null;

  readiness: KomaxProgramReadiness;
  /**
   * Explicit list of fields that are absent and needed for full machine setup.
   * Format: "fieldName (reason)" — e.g. "leftPartNumber (operator-required)".
   * Empty when readiness is READY.
   */
  missingFields: string[];
  /**
   * Advisory strings for the operator or programmer.
   * Examples: "Shared crimp group", "Review branch setup before machine run".
   */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Batch-level program
// ---------------------------------------------------------------------------

/**
 * Per-batch Komax machine program parameters, derived by rolling up the
 * wire programs belonging to the batch.
 */
export interface KomaxBatchProgram {
  skuKey: string;
  /** Deterministic batch ID (B01, B02…). */
  batchId: string;
  /** Human-readable one-line setup description. */
  setupSignature: string;

  /** Internal wire IDs in this batch. */
  wireIds: string[];
  totalWires: number;

  /**
   * Representative gauge for this batch (from batch grouping key).
   * All wires in a batch share the same gauge.
   */
  dominantGauge?: string | null;
  dominantColor?: string | null;

  /** True when any wire in the batch requires label printing. */
  printRequired: boolean;
  /** True when any wire in the batch is a branch/double-crimp wire. */
  branchWiresPresent: boolean;

  /**
   * Shared left-end process type across all wires in this batch.
   * Null when mixed (should not occur given batch grouping, but reported).
   */
  sharedLeftProcessType?: string | null;
  sharedRightProcessType?: string | null;

  readiness: KomaxProgramReadiness;
  missingFields: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Build result
// ---------------------------------------------------------------------------

export interface KomaxProgramBuildResult {
  wirePrograms: KomaxWireProgram[];
  batchPrograms: KomaxBatchProgram[];
  summary: {
    readyWirePrograms:    number;
    partialWirePrograms:  number;
    blockedWirePrograms:  number;
    readyBatchPrograms:   number;
    partialBatchPrograms: number;
    blockedBatchPrograms: number;
  };
}
