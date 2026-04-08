/**
 * V5.2.5 EMIP Core - Revision Service
 * 
 * FOUNDATION LAYER - Revision Intelligence and Comparison
 * 
 * Responsibilities:
 * - Normalize revision formats into comparable values
 * - Compare revision levels to determine ordering
 * - Decide BOM activation based on revision (not timestamp)
 * - Enforce truth-based BOM governance
 * 
 * Supported Revision Formats:
 * - Letter-based: "A", "B", "C", "AA", "AB"
 * - Numeric: "01", "02", "10"
 * - Prefixed: "Rev A", "REV B", "Rev 01"
 * - Alphanumeric: "A1", "B2" (basic support)
 * 
 * Architecture:
 * - Pure logic (no database access)
 * - Called by ingestion pipeline
 * - Determines ACTIVATE vs ARCHIVE decisions
 */

// ============================================================
// TYPES
// ============================================================

export interface NormalizedRevision {
  /** Normalized revision string (uppercase, stripped) */
  revision: string;
  /** Numeric order for comparison (higher = newer) */
  order: number;
  /** Original raw input */
  raw: string;
}

export type RevisionAction = 'ACTIVATE' | 'REPLACE' | 'ARCHIVE';

export interface RevisionDecision {
  action: RevisionAction;
  reason: string;
  incomingRevision: NormalizedRevision;
  existingRevision: NormalizedRevision | null;
}

// ============================================================
// REVISION NORMALIZATION
// ============================================================

/**
 * Normalize revision string into comparable format
 * 
 * Handles various revision formats and assigns numeric order.
 * 
 * Examples:
 * - "A" → { revision: "A", order: 1 }
 * - "Rev B" → { revision: "B", order: 2 }
 * - "01" → { revision: "01", order: 1 }
 * - "AA" → { revision: "AA", order: 27 }
 * 
 * @param revisionRaw Raw revision string from BOM
 * @returns Normalized revision with order
 */
export function normalizeRevision(revisionRaw: string | null | undefined): NormalizedRevision {
  // Handle null/undefined/empty
  if (!revisionRaw || revisionRaw.trim() === '') {
    return {
      revision: 'UNKNOWN',
      order: 0,
      raw: revisionRaw || ''
    };
  }
  
  const raw = revisionRaw;
  
  // Strip common prefixes and clean up
  let cleaned = revisionRaw
    .trim()
    .toUpperCase()
    .replace(/^REV\.?/i, '')
    .replace(/^REVISION/i, '')
    .trim();
  
  // If empty after cleaning, mark as unknown
  if (cleaned === '') {
    return {
      revision: 'UNKNOWN',
      order: 0,
      raw
    };
  }
  
  // V6.0.4: Revision sanity validation - reject clearly invalid revisions
  // Common extraction errors that should be caught:
  // - "M" (leading M from master part number line)
  // - Single digit like "7" or "2" (likely from part number, not revision)
  // - Part number segments like "72" from "NH45-42522-72"
  
  // Reject single letter "M" (common parser error)
  if (cleaned === 'M') {
    console.warn(`⚠️ V6.0.4 INVALID REVISION DETECTED: "${cleaned}" (raw: "${raw}") - likely parser error, treating as UNKNOWN`);
    return {
      revision: 'UNKNOWN',
      order: 0,
      raw
    };
  }
  
  // Reject 2-digit numbers > 50 (likely part number segment, not revision)
  // Valid revisions are typically 01-50, not 72
  if (/^\d{2}$/.test(cleaned)) {
    const numValue = parseInt(cleaned, 10);
    if (numValue > 50) {
      console.warn(`⚠️ V6.0.4 INVALID REVISION DETECTED: "${cleaned}" (raw: "${raw}") - likely part number segment, treating as UNKNOWN`);
      return {
        revision: 'UNKNOWN',
        order: 0,
        raw
      };
    }
  }
  
  // Determine order based on format
  const order = calculateRevisionOrder(cleaned);
  
  return {
    revision: cleaned,
    order,
    raw
  };
}

/**
 * Calculate numeric order from normalized revision string
 * 
 * @param cleaned Cleaned revision string (uppercase, no prefixes)
 * @returns Numeric order (higher = newer)
 */
function calculateRevisionOrder(cleaned: string): number {
  // Pattern 1: Pure numeric (e.g., "01", "02", "10")
  if (/^\d+$/.test(cleaned)) {
    return parseInt(cleaned, 10);
  }
  
  // Pattern 2: Single letter (e.g., "A", "B", "Z")
  if (/^[A-Z]$/.test(cleaned)) {
    return cleaned.charCodeAt(0) - 64; // A=1, B=2, ..., Z=26
  }
  
  // Pattern 3: Double letter (e.g., "AA", "AB", "BA")
  if (/^[A-Z]{2}$/.test(cleaned)) {
    const first = cleaned.charCodeAt(0) - 64;
    const second = cleaned.charCodeAt(1) - 64;
    return (first * 26) + second; // AA=27, AB=28, etc.
  }
  
  // Pattern 4: Letter followed by number (e.g., "A1", "B2")
  const letterNumMatch = cleaned.match(/^([A-Z])(\d+)$/);
  if (letterNumMatch) {
    const letter = letterNumMatch[1].charCodeAt(0) - 64;
    const num = parseInt(letterNumMatch[2], 10);
    return (letter * 100) + num; // A1=101, A2=102, B1=201
  }
  
  // Pattern 5: Number followed by letter (e.g., "1A", "2B")
  const numLetterMatch = cleaned.match(/^(\d+)([A-Z])$/);
  if (numLetterMatch) {
    const num = parseInt(numLetterMatch[1], 10);
    const letter = numLetterMatch[2].charCodeAt(0) - 64;
    return (num * 100) + letter;
  }
  
  // Fallback: Unknown format
  console.warn(`🧠 [Revision Service] Unknown revision format: "${cleaned}"`);
  return 0;
}

// ============================================================
// REVISION COMPARISON
// ============================================================

/**
 * Compare two revisions to determine ordering
 * 
 * @param a First revision
 * @param b Second revision
 * @returns 1 if a > b, -1 if a < b, 0 if equal
 */
export function compareRevisions(
  a: NormalizedRevision,
  b: NormalizedRevision
): number {
  if (a.order > b.order) return 1;
  if (a.order < b.order) return -1;
  return 0;
}

// ============================================================
// REVISION DECISION ENGINE
// ============================================================

/**
 * Determine what action to take with incoming BOM based on revision
 * 
 * Rules:
 * - No existing BOM → ACTIVATE (first version)
 * - Incoming > existing → ACTIVATE (newer revision)
 * - Incoming === existing → REPLACE (same revision, re-upload)
 * - Incoming < existing → ARCHIVE (older revision, don't activate)
 * 
 * @param incoming Incoming BOM revision
 * @param existing Current active BOM revision (null if none)
 * @returns Decision with action and reason
 */
export function determineRevisionAction(
  incoming: NormalizedRevision,
  existing: NormalizedRevision | null
): RevisionDecision {
  // No existing BOM → activate this one
  if (!existing || existing.order === 0) {
    return {
      action: 'ACTIVATE',
      reason: 'No existing active BOM',
      incomingRevision: incoming,
      existingRevision: existing
    };
  }
  
  const comparison = compareRevisions(incoming, existing);
  
  // Incoming is newer → activate
  if (comparison > 0) {
    return {
      action: 'ACTIVATE',
      reason: `Incoming revision (${incoming.revision}, order=${incoming.order}) is newer than existing (${existing.revision}, order=${existing.order})`,
      incomingRevision: incoming,
      existingRevision: existing
    };
  }
  
  // Same revision → replace
  if (comparison === 0) {
    return {
      action: 'REPLACE',
      reason: `Incoming revision (${incoming.revision}) matches existing revision, replacing`,
      incomingRevision: incoming,
      existingRevision: existing
    };
  }
  
  // Incoming is older → archive only (don't activate)
  return {
    action: 'ARCHIVE',
    reason: `Incoming revision (${incoming.revision}, order=${incoming.order}) is older than existing (${existing.revision}, order=${existing.order}), archiving without activation`,
    incomingRevision: incoming,
    existingRevision: existing
  };
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Extract revision from existing BOM records
 * 
 * Looks for revision in metadata or revision field.
 * 
 * @param records Array of BOM records
 * @returns Normalized revision or null if not found
 */
export function extractRevisionFromRecords(
  records: Array<{ revision?: string | null; metadata?: any }>
): NormalizedRevision | null {
  if (!records || records.length === 0) {
    return null;
  }
  
  // Check first record for revision
  const firstRecord = records[0];
  
  // Try direct revision field first
  if (firstRecord.revision) {
    return normalizeRevision(firstRecord.revision);
  }
  
  // Try metadata
  if (firstRecord.metadata?.revision) {
    return normalizeRevision(firstRecord.metadata.revision);
  }
  
  // No revision found
  return null;
}

/**
 * Validate revision format (basic check)
 * 
 * @param revision Revision string
 * @returns true if valid format
 */
export function isValidRevisionFormat(revision: string): boolean {
  if (!revision || revision.trim() === '') {
    return false;
  }
  
  const cleaned = revision.trim().toUpperCase().replace(/^REV\.?/i, '').trim();
  
  // Valid patterns: letters, numbers, or alphanumeric
  return /^[A-Z0-9]+$/.test(cleaned);
}
