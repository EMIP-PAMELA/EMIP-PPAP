/**
 * Harness Validation Service — Phase T7
 * Physical Plausibility Engine
 *
 * Evaluates each wire and the overall harness for:
 *   - physical plausibility
 *   - engineering correctness patterns
 *   - invalid or suspicious endpoint configurations
 *
 * All outputs are WARNING/ERROR advisory flags only.
 * Source data is NEVER modified.
 *
 * Governance:
 *   - Pure function. No I/O, no DB calls, no side effects. Never throws.
 *   - DOES NOT modify T2/T5/T6 outputs.
 *   - DOES NOT force-correct data.
 *   - DOES NOT use AI.
 *   - Degrades gracefully when T5 and/or T6 data is unavailable.
 *   - All outputs are ADVISORY — not authoritative.
 *
 * Wire-level rules  R1–R10 map to issue codes:
 *   R1  CONNECTOR_NO_PIN           – connector endpoint missing cavity
 *   R2  OPEN_OPEN                  – both ends bare/open
 *   R3  TERMINAL_TERMINAL          – jumper/cable (INFO only)
 *   R4  CONNECTOR_CONNECTOR        – direct connector bridge, no splice
 *   R5  SPLICE_SOLO                – splice on single-wire component
 *   R6  AMBIGUOUS_ENDPOINT         – T6 tie; requires human review
 *   R7  UNMATCHED_RECONCILIATION   – T5 NONE/AMBIGUOUS match
 *   R8  MISSING_TERMINATION        – no component, treatment, or strip callout
 *   R9  CONNECTOR_SINGLE_WIRE      – connector housing with 1 wire (likely misclass)
 *   R10 CONFIDENCE_CONFLICT        – T6 high-conf but T5 failed (system disagreement)
 *
 * Harness-level rules H1–H4:
 *   H1  EXCESSIVE_AMBIGUOUS        – >20% AMBIGUOUS endpoints
 *   H2  EXCESSIVE_UNMATCHED        – >20% NONE-match endpoints
 *   H3  NO_CONNECTORS              – multi-wire harness with zero connectors
 *   H4  ALL_OPEN                   – entire harness is bare wire
 */

import type { HarnessConnectivityResult, WireConnectivity, WireEndpoint } from './harnessConnectivityService';
import { endpointHasAuthoritativeTermination, inferTerminationType } from './harnessConnectivityService';
import type { HarnessReconciliationResult, ReconciledWire } from './harnessReconciliationService';
import type {
  HarnessEndpointClassificationResult,
  WireClassification,
} from './endpointClassifier';

// ---------------------------------------------------------------------------
// Data Model
// ---------------------------------------------------------------------------

export type ValidationSeverity = 'INFO' | 'WARNING' | 'ERROR';

export interface ValidationIssue {
  code: string;
  message: string;
  details?: string;
}

export interface WireValidation {
  wireId: string;
  /** False when at least one WARNING or ERROR issue is present. */
  isValid: boolean;
  /**
   * Highest-severity issue on this wire.
   * 'INFO' for clean wires (no WARNING/ERROR) — treat as "no issues" when
   * isValid === true and issues.length === 0.
   */
  severity: ValidationSeverity;
  issues: ValidationIssue[];
}

export interface HarnessLevelIssue {
  code: string;
  message: string;
  severity: ValidationSeverity;
}

export interface HarnessValidationResult {
  wires: WireValidation[];
  /** Harness-wide aggregate issues (not tied to a specific wire). */
  harnessIssues: HarnessLevelIssue[];
  summary: {
    total: number;
    /** Wires with no WARNING or ERROR (may still have INFO). */
    valid: number;
    warnings: number;
    errors: number;
  };
}

// ---------------------------------------------------------------------------
// Severity map for issue codes
// ---------------------------------------------------------------------------

/**
 * Authoritative severity for every issue code.
 * Unknown codes default to INFO.
 */
export const RULE_SEVERITIES: Record<string, ValidationSeverity> = {
  R1_CONNECTOR_NO_PIN:          'WARNING',
  R2_OPEN_OPEN:                 'WARNING',
  R3_TERMINAL_TERMINAL:         'INFO',
  R4_CONNECTOR_CONNECTOR:       'WARNING',
  R5_SPLICE_SOLO:               'WARNING',
  R6_AMBIGUOUS_ENDPOINT:        'WARNING',
  R7_UNMATCHED_RECONCILIATION:  'WARNING',
  R8_MISSING_TERMINATION:       'ERROR',
  R9_CONNECTOR_SINGLE_WIRE:     'WARNING',
  R10_CONFIDENCE_CONFLICT:      'ERROR',
};

const HARNESS_RULE_SEVERITIES: Record<string, ValidationSeverity> = {
  H1_EXCESSIVE_AMBIGUOUS: 'WARNING',
  H2_EXCESSIVE_UNMATCHED: 'WARNING',
  H3_NO_CONNECTORS:       'WARNING',
  H4_ALL_OPEN:            'INFO',
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function issueSeverity(code: string): ValidationSeverity {
  return RULE_SEVERITIES[code] ?? HARNESS_RULE_SEVERITIES[code] ?? 'INFO';
}

function wireMaxSeverity(issues: ValidationIssue[]): ValidationSeverity {
  let hasError   = false;
  let hasWarning = false;
  for (const issue of issues) {
    const sev = issueSeverity(issue.code);
    if (sev === 'ERROR')   hasError = true;
    if (sev === 'WARNING') hasWarning = true;
  }
  if (hasError)   return 'ERROR';
  if (hasWarning) return 'WARNING';
  return 'INFO';
}

/**
 * Rule 8: endpoint is a dangling bare wire end with no identifiable termination.
 */
function isMissingTermination(endpoint: WireEndpoint, rawText: string): boolean {
  if (endpointHasAuthoritativeTermination(endpoint)) return false;
  const inferred = inferTerminationType({
    component: endpoint.component,
    cavity:    endpoint.cavity,
    treatment: endpoint.treatment ?? null,
    rawText,
  });
  return inferred === 'UNKNOWN';
}

// ---------------------------------------------------------------------------
// Wire-level rule implementations
// ---------------------------------------------------------------------------

interface WireRuleContext {
  wire:        WireConnectivity;
  classified:  WireClassification | undefined;
  reconciled:  ReconciledWire | undefined;
  fromShare:   number;
  toShare:     number;
}

function applyWireRules(ctx: WireRuleContext): ValidationIssue[] {
  const { wire, classified, reconciled, fromShare, toShare } = ctx;
  const issues: ValidationIssue[] = [];

  const fromType = classified?.from.type;
  const toType   = classified?.to.type;
  const fromConf = classified?.from.confidence ?? 0;
  const toConf   = classified?.to.confidence   ?? 0;
  const fromMatch = reconciled?.from.matchType;
  const toMatch   = reconciled?.to.matchType;

  // R1 — CONNECTOR PIN CONSISTENCY
  // Applies per-endpoint when T6 classification is available.
  if (fromType === 'CONNECTOR' && !wire.from.cavity) {
    issues.push({
      code:    'R1_CONNECTOR_NO_PIN',
      message: 'CONNECTOR endpoint missing pin/cavity assignment',
      details: `from: ${wire.from.component ?? '(null)'}`,
    });
  }
  if (toType === 'CONNECTOR' && !wire.to.cavity) {
    issues.push({
      code:    'R1_CONNECTOR_NO_PIN',
      message: 'CONNECTOR endpoint missing pin/cavity assignment',
      details: `to: ${wire.to.component ?? '(null)'}`,
    });
  }

  // R2 — OPEN END MISUSE
  // Both T6 endpoints OPEN → possible raw/unconnected wire.
  if (fromType === 'OPEN' && toType === 'OPEN') {
    issues.push({
      code:    'R2_OPEN_OPEN',
      message: 'Both endpoints classified OPEN — possible raw wire',
      details: `from: ${wire.from.component ?? '(null)'}, to: ${wire.to.component ?? '(null)'}`,
    });
  }

  // R3 — TERMINAL TO TERMINAL (INFO: valid jumper/cable)
  if (fromType === 'TERMINAL' && toType === 'TERMINAL') {
    issues.push({
      code:    'R3_TERMINAL_TERMINAL',
      message: 'Terminal-to-terminal wire — valid jumper or cable',
      details: `from: ${wire.from.component}, to: ${wire.to.component}`,
    });
  }

  // R4 — CONNECTOR TO CONNECTOR
  // Flag only when neither endpoint carries a SPLICE treatment.
  const hasSplice = wire.from.treatment === 'SPLICE' || wire.to.treatment === 'SPLICE';
  if (fromType === 'CONNECTOR' && toType === 'CONNECTOR' && !hasSplice) {
    issues.push({
      code:    'R4_CONNECTOR_CONNECTOR',
      message: 'Connector-to-connector wire without splice — possible missing intermediate structure',
      details: `from: ${wire.from.component}, to: ${wire.to.component}`,
    });
  }

  // R5 — SPLICE VALIDATION
  // Solo splice: SPLICE treatment on a named component shared by < 2 wires.
  // Skipped when component is null (null-component splices are untrackable).
  if (wire.from.treatment === 'SPLICE' && wire.from.component !== null && fromShare < 2) {
    issues.push({
      code:    'R5_SPLICE_SOLO',
      message: 'SPLICE treatment on component shared by fewer than 2 wires',
      details: `from: ${wire.from.component} (share: ${fromShare})`,
    });
  }
  if (wire.to.treatment === 'SPLICE' && wire.to.component !== null && toShare < 2) {
    issues.push({
      code:    'R5_SPLICE_SOLO',
      message: 'SPLICE treatment on component shared by fewer than 2 wires',
      details: `to: ${wire.to.component} (share: ${toShare})`,
    });
  }

  // R6 — AMBIGUOUS ENDPOINT (T6 tie, requires human review)
  if (fromType === 'AMBIGUOUS') {
    issues.push({
      code:    'R6_AMBIGUOUS_ENDPOINT',
      message: 'FROM endpoint classification is AMBIGUOUS — requires review',
      details: wire.from.component ?? undefined,
    });
  }
  if (toType === 'AMBIGUOUS') {
    issues.push({
      code:    'R6_AMBIGUOUS_ENDPOINT',
      message: 'TO endpoint classification is AMBIGUOUS — requires review',
      details: wire.to.component ?? undefined,
    });
  }

  // R7 — UNMATCHED RECONCILIATION (T5 required)
  if (reconciled) {
    if (fromMatch === 'NONE') {
      issues.push({
        code:    'R7_UNMATCHED_RECONCILIATION',
        message: 'FROM endpoint has no diagram component match',
        details: `label: ${wire.from.component ?? '(null)'}`,
      });
    } else if (fromMatch === 'AMBIGUOUS') {
      issues.push({
        code:    'R7_UNMATCHED_RECONCILIATION',
        message: 'FROM endpoint reconciliation is AMBIGUOUS (multiple candidates)',
        details: `label: ${wire.from.component ?? '(null)'}`,
      });
    }
    if (toMatch === 'NONE') {
      issues.push({
        code:    'R7_UNMATCHED_RECONCILIATION',
        message: 'TO endpoint has no diagram component match',
        details: `label: ${wire.to.component ?? '(null)'}`,
      });
    } else if (toMatch === 'AMBIGUOUS') {
      issues.push({
        code:    'R7_UNMATCHED_RECONCILIATION',
        message: 'TO endpoint reconciliation is AMBIGUOUS (multiple candidates)',
        details: `label: ${wire.to.component ?? '(null)'}`,
      });
    }
  }

  // R8 — MISSING TERMINATION (ERROR — checked from T2 data directly)
  if (isMissingTermination(wire.from, wire.rawText)) {
    console.log('[T12.3 TERMINATION]', {
      wireId: wire.wireId,
      endpoint: 'FROM',
      terminationType: wire.from.terminationType ?? 'UNKNOWN',
      treatment: wire.from.treatment ?? null,
    });
    issues.push({
      code:    'R8_MISSING_TERMINATION',
      message: 'FROM endpoint has no component, treatment, or strip callout — bare dangling end',
      details: `wire: ${wire.wireId}`,
    });
  }
  if (isMissingTermination(wire.to, wire.rawText)) {
    console.log('[T12.3 TERMINATION]', {
      wireId: wire.wireId,
      endpoint: 'TO',
      terminationType: wire.to.terminationType ?? 'UNKNOWN',
      treatment: wire.to.treatment ?? null,
    });
    issues.push({
      code:    'R8_MISSING_TERMINATION',
      message: 'TO endpoint has no component, treatment, or strip callout — bare dangling end',
      details: `wire: ${wire.wireId}`,
    });
  }

  // R9 — CONNECTOR WITHOUT MULTIPLE WIRES (T6 required)
  // Applies per-endpoint: a connector housing with only 1 wire is suspicious.
  if (fromType === 'CONNECTOR' && fromShare < 2) {
    issues.push({
      code:    'R9_CONNECTOR_SINGLE_WIRE',
      message: 'CONNECTOR FROM endpoint has only 1 wire — possible misclassification',
      details: `from: ${wire.from.component} (share: ${fromShare})`,
    });
  }
  if (toType === 'CONNECTOR' && toShare < 2) {
    issues.push({
      code:    'R9_CONNECTOR_SINGLE_WIRE',
      message: 'CONNECTOR TO endpoint has only 1 wire — possible misclassification',
      details: `to: ${wire.to.component} (share: ${toShare})`,
    });
  }

  // R10 — HIGH CONFIDENCE CONFLICT (T5 + T6 required)
  // T6 high-confidence classification that T5 could not match → system disagreement.
  if (reconciled) {
    if (fromConf >= 0.8 && fromMatch === 'NONE') {
      issues.push({
        code:    'R10_CONFIDENCE_CONFLICT',
        message: 'High-confidence T6 classification contradicts T5 reconciliation failure (FROM)',
        details: `T6 confidence: ${fromConf.toFixed(2)}, T5 match: NONE`,
      });
    }
    if (toConf >= 0.8 && toMatch === 'NONE') {
      issues.push({
        code:    'R10_CONFIDENCE_CONFLICT',
        message: 'High-confidence T6 classification contradicts T5 reconciliation failure (TO)',
        details: `T6 confidence: ${toConf.toFixed(2)}, T5 match: NONE`,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Harness-level rule implementations
// ---------------------------------------------------------------------------

function applyHarnessRules(
  wires:                  WireConnectivity[],
  endpointClassification: HarnessEndpointClassificationResult | null | undefined,
  reconciliation:         HarnessReconciliationResult | null | undefined,
): HarnessLevelIssue[] {
  const issues: HarnessLevelIssue[] = [];
  if (wires.length === 0) return issues;

  const totalEndpoints = wires.length * 2;

  // T6-based harness rules
  if (endpointClassification) {
    const { byType } = endpointClassification.summary;

    // H1 — Excessive AMBIGUOUS endpoints (> 20%)
    const ambiguousRatio = byType.AMBIGUOUS / totalEndpoints;
    if (ambiguousRatio > 0.20) {
      issues.push({
        code:     'H1_EXCESSIVE_AMBIGUOUS',
        message:  `${Math.round(ambiguousRatio * 100)}% of endpoints are AMBIGUOUS (threshold: 20%)`,
        severity: HARNESS_RULE_SEVERITIES.H1_EXCESSIVE_AMBIGUOUS,
      });
    }

    // H3 — Zero connectors in a multi-wire harness
    if (byType.CONNECTOR === 0 && wires.length > 1) {
      issues.push({
        code:     'H3_NO_CONNECTORS',
        message:  'Multi-wire harness contains no CONNECTOR endpoints',
        severity: HARNESS_RULE_SEVERITIES.H3_NO_CONNECTORS,
      });
    }

    // H4 — All endpoints are OPEN (possible raw wire batch)
    if (byType.OPEN === totalEndpoints) {
      issues.push({
        code:     'H4_ALL_OPEN',
        message:  'All endpoints are OPEN — possible raw wire batch',
        severity: HARNESS_RULE_SEVERITIES.H4_ALL_OPEN,
      });
    }
  }

  // T5-based harness rules
  if (reconciliation) {
    // H2 — Excessive NONE-match endpoints (> 20%)
    let unmatchedEndpoints = 0;
    for (const rw of reconciliation.wires) {
      if (rw.from.matchType === 'NONE') unmatchedEndpoints++;
      if (rw.to.matchType   === 'NONE') unmatchedEndpoints++;
    }
    const unmatchedRatio = unmatchedEndpoints / totalEndpoints;
    if (unmatchedRatio > 0.20) {
      issues.push({
        code:     'H2_EXCESSIVE_UNMATCHED',
        message:  `${Math.round(unmatchedRatio * 100)}% of endpoints are unmatched against diagram (threshold: 20%)`,
        severity: HARNESS_RULE_SEVERITIES.H2_EXCESSIVE_UNMATCHED,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Primary export: validateHarness
// ---------------------------------------------------------------------------

/**
 * Validate a full harness for physical plausibility and engineering correctness.
 *
 * Inputs:
 *   connectivity            — T2 HC-BOM result (required)
 *   reconciliation          — T5 result (optional; rules R7, R10, H2 degrade if absent)
 *   endpointClassification  — T6 result (optional; rules R1–R6, R9, H1, H3, H4 degrade if absent)
 *
 * Never throws. Never modifies inputs.
 */
export function validateHarness(args: {
  connectivity:           HarnessConnectivityResult;
  reconciliation?:        HarnessReconciliationResult | null;
  endpointClassification?: HarnessEndpointClassificationResult | null;
}): HarnessValidationResult {
  const { connectivity, reconciliation, endpointClassification } = args;

  // Pre-compute wire-share count per component label (from T2)
  const shareCount = new Map<string, number>();
  for (const wire of connectivity.wires) {
    const fk = wire.from.component?.toLowerCase().trim();
    const tk = wire.to.component?.toLowerCase().trim();
    if (fk) shareCount.set(fk, (shareCount.get(fk) ?? 0) + 1);
    if (tk) shareCount.set(tk, (shareCount.get(tk) ?? 0) + 1);
  }

  // Index T5 and T6 by wireId for O(1) lookup
  const reconciledByWireId = new Map<string, ReconciledWire>();
  for (const rw of reconciliation?.wires ?? []) {
    reconciledByWireId.set(rw.wireId, rw);
  }

  // Apply wire-level rules
  const wireValidations: WireValidation[] = connectivity.wires.map(wire => {
    const fromShare = shareCount.get(wire.from.component?.toLowerCase().trim() ?? '') ?? 1;
    const toShare   = shareCount.get(wire.to.component?.toLowerCase().trim()   ?? '') ?? 1;

    const ctx: WireRuleContext = {
      wire,
      classified: endpointClassification?.classifications.get(wire.wireId),
      reconciled: reconciledByWireId.get(wire.wireId),
      fromShare,
      toShare,
    };

    const issues   = applyWireRules(ctx);
    const severity = wireMaxSeverity(issues);
    const isValid  = severity !== 'WARNING' && severity !== 'ERROR';

    return { wireId: wire.wireId, isValid, severity, issues };
  });

  // Apply harness-level rules
  const harnessIssues = applyHarnessRules(
    connectivity.wires,
    endpointClassification,
    reconciliation,
  );

  // Compute summary
  let valid = 0, warnings = 0, errors = 0;
  for (const wv of wireValidations) {
    if (wv.severity === 'ERROR')        errors++;
    else if (wv.severity === 'WARNING') warnings++;
    else                                valid++;
  }

  const issueCodes = wireValidations
    .flatMap(wv => wv.issues.map(i => i.code))
    .reduce<Record<string, number>>((acc, code) => {
      acc[code] = (acc[code] ?? 0) + 1;
      return acc;
    }, {});

  console.log('[T7 VALIDATION]', {
    total:       connectivity.wires.length,
    valid,
    warnings,
    errors,
    topIssueCodes: Object.entries(issueCodes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => `${code}×${count}`),
  });

  return {
    wires: wireValidations,
    harnessIssues,
    summary: { total: connectivity.wires.length, valid, warnings, errors },
  };
}
