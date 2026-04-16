/**
 * ACI Lookup Service — Phase T18.5
 *
 * Centralized, reusable lookup layer for Applicator Component Identifiers (ACIs).
 * An ACI links a terminal/ferrule part number to a canonical applicator identity
 * used across the manufacturing system.  Strip lengths derive from the ACI table.
 *
 * Data sources (static JSON — populated from manufacturer applicator data sheets):
 *   aci_part_lookup.json  — part number → ACI mapping (with aliases)
 *   aci_strip_length.json — ACI → strip length in mm
 *
 * Governance:
 *   - Pure functions. No I/O, no DB, no side effects. Never throws.
 *   - Returns null when a lookup produces no match — never guesses or defaults.
 *   - Deterministic: same input → same output every call.
 *   - JSON tables are imported statically at module load — no runtime I/O.
 *   - normalizeComponentIdentity is the canonical normalisation rule for all callers.
 *   - Do NOT add heuristics or fuzzy matching — explicit matches only.
 */

import partLookupData from '../data/aci_part_lookup.json';
import stripLengthData from '../data/aci_strip_length.json';

// ---------------------------------------------------------------------------
// JSON table shapes (typed minimally to avoid JSON import complexity)
// ---------------------------------------------------------------------------

interface PartLookupEntry {
  partNumber:         string;
  partNumberAliases:  string[];
  aci:                string;
  description:        string;
  terminationType:    string;
}

interface StripLengthEntry {
  aci:              string;
  stripLengthMm:    number;
  strippingNote:    string;
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * Canonical normalisation applied to all part numbers before lookup.
 * Rule: trim whitespace + convert to uppercase.
 * No other transformation (hyphens are preserved — they are meaningful in PNs).
 */
export function normalizeComponentIdentity(component: string): string {
  return component.trim().toUpperCase();
}

// ---------------------------------------------------------------------------
// Lazy-built indexes (built once on first call, not at module load)
// ---------------------------------------------------------------------------

let _partToAci:    Map<string, string>   | null = null;
let _aciToStrip:   Map<string, StripLengthEntry> | null = null;
let _aciToParts:   Map<string, string[]> | null = null;

function buildPartToAciIndex(): Map<string, string> {
  const idx = new Map<string, string>();
  const entries = (partLookupData as unknown as { entries: PartLookupEntry[] }).entries ?? [];
  for (const entry of entries) {
    idx.set(normalizeComponentIdentity(entry.partNumber), entry.aci);
    for (const alias of entry.partNumberAliases) {
      idx.set(normalizeComponentIdentity(alias), entry.aci);
    }
  }
  return idx;
}

function buildAciToStripIndex(): Map<string, StripLengthEntry> {
  const idx = new Map<string, StripLengthEntry>();
  const entries = (stripLengthData as unknown as { entries: StripLengthEntry[] }).entries ?? [];
  for (const entry of entries) {
    idx.set(entry.aci, entry);
  }
  return idx;
}

function buildAciToPartsIndex(): Map<string, string[]> {
  const idx = new Map<string, string[]>();
  const entries = (partLookupData as unknown as { entries: PartLookupEntry[] }).entries ?? [];
  for (const entry of entries) {
    const existing = idx.get(entry.aci) ?? [];
    existing.push(entry.partNumber);
    idx.set(entry.aci, existing);
  }
  return idx;
}

function partToAciIndex():  Map<string, string>          { return _partToAci   ?? (_partToAci  = buildPartToAciIndex()); }
function aciToStripIndex(): Map<string, StripLengthEntry> { return _aciToStrip  ?? (_aciToStrip = buildAciToStripIndex()); }
function aciToPartsIndex(): Map<string, string[]>         { return _aciToParts  ?? (_aciToParts = buildAciToPartsIndex()); }

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the ACI for a given part number.
 * Returns null when the part number is not in the lookup table.
 * Normalises the input before searching.
 */
export function getAciByPartNumber(partNumber: string): string | null {
  if (!partNumber?.trim()) return null;
  return partToAciIndex().get(normalizeComponentIdentity(partNumber)) ?? null;
}

/**
 * Returns all part numbers (primary + aliases) registered for an ACI.
 * Returns an empty array when the ACI is not found.
 */
export function getPartNumbersByAci(aci: string): string[] {
  if (!aci?.trim()) return [];
  return aciToPartsIndex().get(aci) ?? [];
}

/**
 * Returns the strip length string for an ACI, formatted as "<value> mm".
 * Returns null when the ACI is not in the strip length table.
 */
export function getStripLengthByAci(aci: string): string | null {
  if (!aci?.trim()) return null;
  const entry = aciToStripIndex().get(aci);
  if (!entry) return null;
  return `${entry.stripLengthMm.toFixed(1)} mm`;
}

/**
 * Resolve strip length directly from a part number.
 * Combines getAciByPartNumber + getStripLengthByAci in one call.
 * Returns null when either lookup produces no match.
 */
export function getStripLengthByPartNumber(partNumber: string): string | null {
  const aci = getAciByPartNumber(partNumber);
  if (!aci) return null;
  return getStripLengthByAci(aci);
}

/**
 * Returns the strip length note for a part number (for UI tooltips / audit).
 * Returns null when no match found.
 */
export function getStripLengthNoteByPartNumber(partNumber: string): string | null {
  const aci = getAciByPartNumber(partNumber);
  if (!aci) return null;
  const entry = aciToStripIndex().get(aci);
  return entry?.strippingNote ?? null;
}

/**
 * Returns all ACI entries from the part lookup table.
 * Useful for admin UI display of the full table.
 */
export function getAllAciEntries(): Array<{
  partNumber:      string;
  aci:             string;
  description:     string;
  terminationType: string;
}> {
  const entries = (partLookupData as unknown as { entries: PartLookupEntry[] }).entries ?? [];
  return entries.map(e => ({
    partNumber:      e.partNumber,
    aci:             e.aci,
    description:     e.description,
    terminationType: e.terminationType,
  }));
}
