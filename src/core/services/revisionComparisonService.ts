/**
 * V6.0 EMIP Core - Revision Comparison Service
 * 
 * COMPARISON LAYER - BOM Revision Diff Engine
 * 
 * Responsibilities:
 * - Compare two revisions of the same SKU
 * - Detect added, removed, and changed components
 * - Track field-level changes (quantity, length, gauge, color, operation_step)
 * - Highlight wire-specific changes as manufacturing-critical
 * - Generate human-readable diff summaries
 * 
 * Architecture:
 * - Pure comparison logic (data in, diff out)
 * - No database access (receives record arrays)
 * - Wire changes treated as first-class citizens
 */

import type { BOMRecord } from '../data/bom/types';

// ============================================================
// TYPES
// ============================================================

export interface FieldChange<T = any> {
  from: T;
  to: T;
}

export interface ComponentChange {
  component_part_number: string;
  changes: {
    quantity?: FieldChange<number>;
    length?: FieldChange<number | null>;
    gauge?: FieldChange<string | null>;
    color?: FieldChange<string | null>;
    operation_step?: FieldChange<string | null>;
    unit?: FieldChange<string | null>;
  };
  isWire: boolean;
}

export interface RevisionDiff {
  partNumber: string;
  fromRevision: string;
  toRevision: string;
  summary: {
    addedCount: number;
    removedCount: number;
    changedCount: number;
    unchangedCount: number;
    wireChangesCount: number;
  };
  added: BOMRecord[];
  removed: BOMRecord[];
  changed: ComponentChange[];
  unchanged: BOMRecord[];
  humanSummary: string[];
}

// ============================================================
// DIFF ENGINE CORE
// ============================================================

/**
 * Compare two BOM revisions and detect all changes
 * 
 * @param partNumber Parent part number (for context)
 * @param fromRevision Source revision identifier
 * @param toRevision Target revision identifier
 * @param oldRecords Records from source revision
 * @param newRecords Records from target revision
 * @returns Comprehensive diff with added/removed/changed/unchanged
 */
export function compareBOMRevisions(
  partNumber: string,
  fromRevision: string,
  toRevision: string,
  oldRecords: BOMRecord[],
  newRecords: BOMRecord[]
): RevisionDiff {
  console.log('🧠 V6.0 REVISION DIFF ENGINE', {
    partNumber,
    fromRevision,
    toRevision,
    oldCount: oldRecords.length,
    newCount: newRecords.length,
  });

  // Build lookup maps by component_part_number
  const oldMap = new Map<string, BOMRecord[]>();
  const newMap = new Map<string, BOMRecord[]>();

  // Group records by component_part_number
  for (const record of oldRecords) {
    const key = record.component_part_number;
    if (!oldMap.has(key)) {
      oldMap.set(key, []);
    }
    oldMap.get(key)!.push(record);
  }

  for (const record of newRecords) {
    const key = record.component_part_number;
    if (!newMap.has(key)) {
      newMap.set(key, []);
    }
    newMap.get(key)!.push(record);
  }

  // Classification buckets
  const added: BOMRecord[] = [];
  const removed: BOMRecord[] = [];
  const changed: ComponentChange[] = [];
  const unchanged: BOMRecord[] = [];
  let wireChangesCount = 0;

  // Find all unique component_part_numbers
  const allComponents = new Set([...oldMap.keys(), ...newMap.keys()]);

  for (const componentPN of allComponents) {
    const oldInstances = oldMap.get(componentPN) || [];
    const newInstances = newMap.get(componentPN) || [];

    // CASE 1: Component exists only in new revision → ADDED
    if (oldInstances.length === 0) {
      added.push(...newInstances);
      continue;
    }

    // CASE 2: Component exists only in old revision → REMOVED
    if (newInstances.length === 0) {
      removed.push(...oldInstances);
      continue;
    }

    // CASE 3: Component exists in both → compare
    // For simplicity, compare first instance of each (most BOMs have 1 instance per component per operation)
    // TODO: If multiple instances exist, could do more sophisticated matching
    const oldInstance = oldInstances[0];
    const newInstance = newInstances[0];

    const changeObj = detectChanges(oldInstance, newInstance);

    if (changeObj) {
      changed.push(changeObj);
      if (changeObj.isWire) {
        wireChangesCount++;
      }
    } else {
      // No changes detected
      unchanged.push(newInstance);
    }
  }

  // Generate human-readable summary
  const humanSummary = generateHumanSummary(
    added.length,
    removed.length,
    changed.length,
    wireChangesCount
  );

  const diff: RevisionDiff = {
    partNumber,
    fromRevision,
    toRevision,
    summary: {
      addedCount: added.length,
      removedCount: removed.length,
      changedCount: changed.length,
      unchangedCount: unchanged.length,
      wireChangesCount,
    },
    added: sortByOperationStep(added),
    removed: sortByOperationStep(removed),
    changed: sortChangedByOperationStep(changed, newMap),
    unchanged: sortByOperationStep(unchanged),
    humanSummary,
  };

  console.log('🧠 V6.0 REVISION DIFF COMPLETE', {
    partNumber,
    added: diff.summary.addedCount,
    removed: diff.summary.removedCount,
    changed: diff.summary.changedCount,
    unchanged: diff.summary.unchangedCount,
    wireChanges: diff.summary.wireChangesCount,
  });

  return diff;
}

// ============================================================
// CHANGE DETECTION
// ============================================================

/**
 * Detect field-level changes between two BOM records
 * 
 * Returns null if no changes detected (records are identical)
 * 
 * @param oldRecord Record from source revision
 * @param newRecord Record from target revision
 * @returns ComponentChange object or null
 */
function detectChanges(oldRecord: BOMRecord, newRecord: BOMRecord): ComponentChange | null {
  const changes: ComponentChange['changes'] = {};
  let hasChanges = false;

  // Check quantity
  if (oldRecord.quantity !== newRecord.quantity) {
    changes.quantity = { from: oldRecord.quantity, to: newRecord.quantity };
    hasChanges = true;
  }

  // Check length (wire-specific)
  if (oldRecord.length !== newRecord.length) {
    changes.length = { from: oldRecord.length ?? null, to: newRecord.length ?? null };
    hasChanges = true;
  }

  // Check gauge (wire-specific)
  if (oldRecord.gauge !== newRecord.gauge) {
    changes.gauge = { from: oldRecord.gauge ?? null, to: newRecord.gauge ?? null };
    hasChanges = true;
  }

  // Check color (wire-specific)
  if (oldRecord.color !== newRecord.color) {
    changes.color = { from: oldRecord.color ?? null, to: newRecord.color ?? null };
    hasChanges = true;
  }

  // Check operation_step
  if (oldRecord.operation_step !== newRecord.operation_step) {
    changes.operation_step = { from: oldRecord.operation_step ?? null, to: newRecord.operation_step ?? null };
    hasChanges = true;
  }

  // Check unit
  if (oldRecord.unit !== newRecord.unit) {
    changes.unit = { from: oldRecord.unit ?? null, to: newRecord.unit ?? null };
    hasChanges = true;
  }

  if (!hasChanges) {
    return null;
  }

  // Detect if this is a wire component
  const isWire = isWireComponent(newRecord);

  return {
    component_part_number: newRecord.component_part_number,
    changes,
    isWire,
  };
}

/**
 * Detect if a BOM record represents a wire component
 * 
 * Wire detection criteria:
 * - Has length field populated
 * - OR has gauge field populated
 * - OR part number starts with 'W' (wire prefix pattern)
 * 
 * @param record BOM record
 * @returns true if wire component
 */
function isWireComponent(record: BOMRecord): boolean {
  // Has length or gauge → likely wire
  if (record.length !== null && record.length !== undefined) return true;
  if (record.gauge !== null && record.gauge !== undefined) return true;

  // Part number starts with W → wire pattern
  if (record.component_part_number.startsWith('W')) return true;

  return false;
}

// ============================================================
// SORTING
// ============================================================

/**
 * Sort BOM records by operation_step (numeric) then component_part_number
 */
function sortByOperationStep(records: BOMRecord[]): BOMRecord[] {
  return [...records].sort((a, b) => {
    // Sort by operation_step numerically
    const stepA = parseInt(a.operation_step || '0', 10);
    const stepB = parseInt(b.operation_step || '0', 10);
    
    if (stepA !== stepB) {
      return stepA - stepB;
    }
    
    // Then by component_part_number alphabetically
    return a.component_part_number.localeCompare(b.component_part_number);
  });
}

/**
 * Sort changed components by operation_step (using new revision data)
 */
function sortChangedByOperationStep(
  changes: ComponentChange[],
  newMap: Map<string, BOMRecord[]>
): ComponentChange[] {
  return [...changes].sort((a, b) => {
    const recordA = newMap.get(a.component_part_number)?.[0];
    const recordB = newMap.get(b.component_part_number)?.[0];
    
    const stepA = parseInt(recordA?.operation_step || '0', 10);
    const stepB = parseInt(recordB?.operation_step || '0', 10);
    
    if (stepA !== stepB) {
      return stepA - stepB;
    }
    
    return a.component_part_number.localeCompare(b.component_part_number);
  });
}

// ============================================================
// SUMMARY GENERATION
// ============================================================

/**
 * Generate human-readable summary of changes
 */
function generateHumanSummary(
  addedCount: number,
  removedCount: number,
  changedCount: number,
  wireChangesCount: number
): string[] {
  const summary: string[] = [];

  if (addedCount > 0) {
    summary.push(`${addedCount} component${addedCount === 1 ? '' : 's'} added`);
  }

  if (removedCount > 0) {
    summary.push(`${removedCount} component${removedCount === 1 ? '' : 's'} removed`);
  }

  if (changedCount > 0) {
    summary.push(`${changedCount} item${changedCount === 1 ? '' : 's'} changed`);
  }

  if (wireChangesCount > 0) {
    summary.push(`${wireChangesCount} wire change${wireChangesCount === 1 ? '' : 's'} detected`);
  }

  if (summary.length === 0) {
    summary.push('No differences detected');
  }

  return summary;
}
