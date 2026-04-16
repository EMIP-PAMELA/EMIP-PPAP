/**
 * Tooling Service — Phase T19
 *
 * Centralized, reusable resolution layer that maps terminal part numbers
 * and ACI codes to physical applicators in the plant inventory.
 *
 * Resolution strategy (part-primary, ACI-augmented):
 *   1. Resolve ACI via aciLookupService.getAciByPartNumber()
 *   2. If ACI found → search applicators by ACI  (HIGH confidence)
 *   3. If no ACI match → search applicators by part number directly (MEDIUM confidence)
 *   4. If no match at either step → NONE
 *
 * This guarantees tooling resolution even when ACI data is incomplete,
 * while surfacing higher confidence when the full ACI chain is intact.
 *
 * Data source:
 *   src/data/applicators.json — normalized from Master Applicator List Excel
 *   (see T19 PREP commit for transformation details)
 *
 * Governance:
 *   - Pure functions. No I/O, no DB, no side effects. Never throws.
 *   - Returns empty array / NONE resolution — never guesses.
 *   - ACI comparison is case-insensitive (source data has mixed casing).
 *   - Part number comparison uses normalizeComponentIdentity (trim + uppercase).
 *   - Lazy-built indexes — constructed once on first call.
 *   - Only ACTIVE applicators are returned from availability functions.
 *   - Deterministic: same input → same output every call.
 */

import applicatorsRaw from '../../../data/applicators.json';
import { getAciByPartNumber, normalizeComponentIdentity } from './aciLookupService';
import type {
  Applicator,
  ApplicatorLocation,
  ToolingResolution,
  ToolingResolutionMethod,
} from '../types/tooling';

// ---------------------------------------------------------------------------
// JSON file shape
// ---------------------------------------------------------------------------

interface ApplicatorsFile {
  _metadata: Record<string, unknown>;
  entries:   Applicator[];
}

// ---------------------------------------------------------------------------
// Lazy indexes (built once on first call)
// ---------------------------------------------------------------------------

let _allApplicators: Applicator[] | null = null;
let _aciIndex:        Map<string, Applicator[]> | null = null;
let _pnIndex:         Map<string, Applicator[]> | null = null;

function getAllEntries(): Applicator[] {
  if (!_allApplicators) {
    _allApplicators = (applicatorsRaw as unknown as ApplicatorsFile).entries ?? [];
  }
  return _allApplicators;
}

function buildAciIndex(): Map<string, Applicator[]> {
  const idx = new Map<string, Applicator[]>();
  for (const app of getAllEntries()) {
    if (!app.aci) continue;
    const key = app.aci.toUpperCase();
    const list = idx.get(key) ?? [];
    list.push(app);
    idx.set(key, list);
  }
  return idx;
}

function buildPnIndex(): Map<string, Applicator[]> {
  const idx = new Map<string, Applicator[]>();
  for (const app of getAllEntries()) {
    for (const pn of app.terminalPartNumbers) {
      const key = normalizeComponentIdentity(pn);
      const list = idx.get(key) ?? [];
      list.push(app);
      idx.set(key, list);
    }
  }
  return idx;
}

function aciIndex(): Map<string, Applicator[]> {
  return _aciIndex ?? (_aciIndex = buildAciIndex());
}

function pnIndex(): Map<string, Applicator[]> {
  return _pnIndex ?? (_pnIndex = buildPnIndex());
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns all applicators (any status) whose ACI matches the given value.
 * Comparison is case-insensitive to handle mixed-case source data.
 * Returns empty array when ACI is blank or not found.
 */
export function getApplicatorsByAci(aci: string): Applicator[] {
  if (!aci?.trim()) return [];
  return aciIndex().get(aci.trim().toUpperCase()) ?? [];
}

/**
 * Returns all applicators (any status) that list the given part number
 * in their terminalPartNumbers array.
 * Comparison uses normalizeComponentIdentity (trim + uppercase).
 * Returns empty array when part number is blank or not found.
 */
export function getApplicatorsByPartNumber(partNumber: string): Applicator[] {
  if (!partNumber?.trim()) return [];
  return pnIndex().get(normalizeComponentIdentity(partNumber)) ?? [];
}

/**
 * Returns only ACTIVE applicators for a given part number.
 * Tries ACI path first; falls back to direct part number lookup.
 * This is the preferred function for availability checks.
 */
export function getAvailableApplicators(partNumber: string): Applicator[] {
  if (!partNumber?.trim()) return [];

  const aci = getAciByPartNumber(partNumber);
  if (aci) {
    const byAci = getApplicatorsByAci(aci).filter(a => a.status === 'ACTIVE');
    if (byAci.length > 0) return byAci;
  }

  return getApplicatorsByPartNumber(partNumber).filter(a => a.status === 'ACTIVE');
}

/**
 * Checks tooling availability for a part number without full resolution detail.
 * Returns available flag, location list, and the ACTIVE applicators found.
 */
export function checkToolingAvailability(partNumber: string): {
  available:   boolean;
  locations:   string[];
  applicators: Applicator[];
} {
  const applicators = getAvailableApplicators(partNumber);
  const locations   = [...new Set(
    applicators.map(a => a.location).filter((l): l is ApplicatorLocation => l != null),
  )];
  return { available: applicators.length > 0, locations, applicators };
}

/**
 * Full tooling resolution for a part number.
 *
 * Resolution path:
 *   1. getAciByPartNumber → if ACI found, search by ACI (HIGH confidence)
 *   2. Fallback to direct part number lookup (MEDIUM confidence)
 *   3. No match → NONE
 *
 * Only ACTIVE applicators are included in the result.
 * Returns NONE resolution for blank or null part numbers.
 */
export function resolveToolingForPart(partNumber: string): ToolingResolution {
  if (!partNumber?.trim()) {
    return { applicators: [], method: 'NONE', confidence: 'NONE', locations: [] };
  }

  let applicators: Applicator[] = [];
  let method: ToolingResolutionMethod = 'NONE';

  const aci = getAciByPartNumber(partNumber);
  if (aci) {
    const aciMatches = getApplicatorsByAci(aci).filter(a => a.status === 'ACTIVE');
    if (aciMatches.length > 0) {
      applicators = aciMatches;
      method      = 'ACI';
    }
  }

  if (applicators.length === 0) {
    const directMatches = getApplicatorsByPartNumber(partNumber).filter(a => a.status === 'ACTIVE');
    if (directMatches.length > 0) {
      applicators = directMatches;
      method      = 'DIRECT';
    }
  }

  const confidence =
    method === 'ACI'    ? 'HIGH'   :
    method === 'DIRECT' ? 'MEDIUM' :
    'NONE';

  const locations = [...new Set(
    applicators.map(a => a.location).filter((l): l is ApplicatorLocation => l != null),
  )];

  return { applicators, method, confidence, locations };
}

/**
 * Returns all applicator entries (any status) for use in the Tooling Dashboard.
 * The caller is responsible for filtering by status, location, etc.
 */
export function getAllApplicatorEntries(): Applicator[] {
  return getAllEntries();
}
