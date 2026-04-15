/**
 * Wire Operator Resolution Service — Phase T11
 *
 * Applies operator wire overrides to the HC-BOM connectivity model and
 * re-evaluates validation (T7), confidence (T8), and decision (T9) layers.
 *
 * Governance:
 *   - Pure functions. No I/O, no DB calls, no side effects. Never throws.
 *   - DOES NOT mutate original connectivity object.
 *   - DOES NOT auto-resolve ambiguous wires without explicit operator action.
 *   - DOES NOT weaken validation rules — suppresses only R8 for valid BRANCH_DOUBLE_CRIMP overrides.
 *   - Operator provenance is preserved as a rawText prefix on each patched wire.
 *   - All inputs are read-only; all outputs are new objects.
 */

import type { HarnessConnectivityResult, WireConnectivity } from './harnessConnectivityService';
import type { HarnessReconciliationResult } from './harnessReconciliationService';
import type { HarnessEndpointClassificationResult } from './endpointClassifier';
import type { HarnessValidationResult, ValidationIssue } from './harnessValidationService';
import type { HarnessConfidenceResult } from './harnessConfidenceService';
import type { HarnessDecisionResult } from './harnessDecisionService';
import type { WireOperatorOverride } from '@/src/features/vault/types/ingestionReview';
import { validateHarness, RULE_SEVERITIES } from './harnessValidationService';
import { adjustHarnessConfidence } from './harnessConfidenceService';
import { evaluateHarnessDecision } from './harnessDecisionService';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface OperatorRevalidationResult {
  resolvedConnectivity: HarnessConnectivityResult;
  resolvedValidation:   HarnessValidationResult;
  resolvedConfidence:   HarnessConfidenceResult;
  resolvedDecision:     HarnessDecisionResult;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function localMaxSeverity(issues: ValidationIssue[]): 'INFO' | 'WARNING' | 'ERROR' {
  let hasError = false, hasWarning = false;
  for (const issue of issues) {
    const sev = RULE_SEVERITIES[issue.code] ?? 'INFO';
    if (sev === 'ERROR')   hasError   = true;
    if (sev === 'WARNING') hasWarning = true;
  }
  if (hasError)   return 'ERROR';
  if (hasWarning) return 'WARNING';
  return 'INFO';
}

/** Returns true when a BRANCH_DOUBLE_CRIMP override carries all required fields. */
export function isValidBranchOverride(override: WireOperatorOverride): boolean {
  const b = override.branch ?? {};
  return Boolean(
    b.sharedSourceComponent?.trim() &&
    b.sharedSourceCavity?.trim() &&
    (b.terminalPartNumber?.trim() || b.ferrulePartNumber?.trim()),
  );
}

function applyOverrideToWire(
  wire: WireConnectivity,
  override: WireOperatorOverride,
): WireConnectivity {
  const prefix = `[OPERATOR:${override.mode}]`;

  switch (override.mode) {
    case 'BRANCH_DOUBLE_CRIMP': {
      const b = override.branch ?? {};
      return {
        ...wire,
        from: {
          component: b.sharedSourceComponent ?? wire.from.component,
          cavity:    b.sharedSourceCavity    ?? wire.from.cavity,
          treatment: wire.from.treatment,
        },
        to: {
          component: b.terminalPartNumber ?? b.ferrulePartNumber ?? wire.to.component,
          cavity:    b.secondaryCavity    ?? wire.to.cavity,
          treatment: wire.to.treatment,
        },
        unresolved: false,
        rawText:    `${prefix} ${wire.rawText}`,
        confidence: 0.90,
      };
    }

    case 'DIRECT_OVERRIDE':
      return {
        ...wire,
        from: {
          component: override.from?.component ?? wire.from.component,
          cavity:    override.from?.cavity    ?? wire.from.cavity,
          treatment: override.from?.treatment ?? wire.from.treatment,
        },
        to: {
          component: override.to?.component ?? wire.to.component,
          cavity:    override.to?.cavity    ?? wire.to.cavity,
          treatment: override.to?.treatment ?? wire.to.treatment,
        },
        unresolved: false,
        rawText:    `${prefix} ${wire.rawText}`,
        confidence: 0.90,
      };

    case 'GROUND':
      return {
        ...wire,
        to:         { component: 'GROUND', cavity: null, treatment: null },
        unresolved: false,
        rawText:    `${prefix} ${wire.rawText}`,
        confidence: 0.85,
      };

    case 'SPLICE':
      return {
        ...wire,
        to:         { component: 'SPLICE', cavity: null, treatment: 'SPLICE' },
        unresolved: false,
        rawText:    `${prefix} ${wire.rawText}`,
        confidence: 0.80,
      };

    case 'FLOATING':
      return {
        ...wire,
        unresolved: false,
        rawText:    `${prefix} ${wire.rawText}`,
        confidence: 0.70,
      };

    default:
      return wire;
  }
}

/**
 * Remove R8_MISSING_TERMINATION from wires whose BRANCH_DOUBLE_CRIMP override is complete.
 * All other validation issues are preserved untouched.
 */
function suppressR8ForBranchWires(
  validation:    HarnessValidationResult,
  branchWireIds: Set<string>,
): HarnessValidationResult {
  if (branchWireIds.size === 0) return validation;

  const updatedWires = validation.wires.map(wv => {
    if (!branchWireIds.has(wv.wireId)) return wv;
    const filteredIssues = wv.issues.filter(i => i.code !== 'R8_MISSING_TERMINATION');
    const severity = localMaxSeverity(filteredIssues);
    const isValid  = severity !== 'WARNING' && severity !== 'ERROR';
    return { ...wv, issues: filteredIssues, severity, isValid };
  });

  let valid = 0, warnings = 0, errors = 0;
  for (const wv of updatedWires) {
    if (wv.severity === 'ERROR')        errors++;
    else if (wv.severity === 'WARNING') warnings++;
    else                                valid++;
  }

  return {
    ...validation,
    wires:   updatedWires,
    summary: { total: validation.summary.total, valid, warnings, errors },
  };
}

// ---------------------------------------------------------------------------
// Primary exports
// ---------------------------------------------------------------------------

/**
 * Apply a set of operator overrides to a connectivity model.
 * Returns a new HarnessConnectivityResult — never mutates the original.
 */
export function applyWireOperatorOverrides(args: {
  connectivity: HarnessConnectivityResult;
  overrides:    WireOperatorOverride[];
}): HarnessConnectivityResult {
  const { connectivity, overrides } = args;

  if (overrides.length === 0) return connectivity;

  const overrideMap = new Map(overrides.map(o => [o.wireId, o]));

  const updatedWires: WireConnectivity[] = connectivity.wires.map(wire => {
    const override = overrideMap.get(wire.wireId);
    if (!override) return wire;

    console.log('[T11 OVERRIDE] Applied wire override', {
      wireId: wire.wireId,
      mode:   override.mode,
      reason: override.reason,
    });

    return applyOverrideToWire(wire, override);
  });

  const unresolvedWires = updatedWires.filter(w => w.unresolved).map(w => w.wireId);
  const resolved   = updatedWires.filter(w => !w.unresolved && w.from.component !== null && w.to.component !== null).length;
  const partial    = updatedWires.filter(w => !w.unresolved && (w.from.component === null || w.to.component === null)).length;
  const unresolved = unresolvedWires.length;

  return {
    wires:             updatedWires,
    unresolvedWires,
    confidenceSummary: { total: updatedWires.length, resolved, partial, unresolved },
  };
}

/**
 * Apply overrides then re-evaluate T7 → T8 → T9.
 * Returns a full OperatorRevalidationResult. Never throws. Never mutates inputs.
 */
export function revalidateWithOverrides(args: {
  connectivity:            HarnessConnectivityResult;
  overrides:               WireOperatorOverride[];
  reconciliation?:         HarnessReconciliationResult | null;
  endpointClassification?: HarnessEndpointClassificationResult | null;
}): OperatorRevalidationResult {
  const { connectivity, overrides, reconciliation, endpointClassification } = args;

  const resolvedConnectivity = applyWireOperatorOverrides({ connectivity, overrides });

  let resolvedValidation = validateHarness({
    connectivity: resolvedConnectivity,
    reconciliation,
    endpointClassification,
  });

  const branchWireIds = new Set(
    overrides
      .filter(o => o.mode === 'BRANCH_DOUBLE_CRIMP' && isValidBranchOverride(o))
      .map(o => o.wireId),
  );
  resolvedValidation = suppressR8ForBranchWires(resolvedValidation, branchWireIds);

  const resolvedConfidence = adjustHarnessConfidence({
    connectivity:            resolvedConnectivity,
    reconciliation,
    endpointClassification,
    validation:              resolvedValidation,
  });

  const resolvedDecision = evaluateHarnessDecision({
    connectivity:            resolvedConnectivity,
    reconciliation,
    endpointClassification,
    validation:              resolvedValidation,
    confidence:              resolvedConfidence,
  });

  return { resolvedConnectivity, resolvedValidation, resolvedConfidence, resolvedDecision };
}
