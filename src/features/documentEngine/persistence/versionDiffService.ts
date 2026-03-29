/**
 * Phase 36: Version Comparison and Diff Layer
 * 
 * Service for comparing document versions to show field and mapping differences.
 * Enables visual diff view for document evolution tracking.
 */

import { DocumentVersion } from './versionService';
import { FieldMappingMeta } from '../templates/templateMappingService';

/**
 * Field-level difference metadata
 */
export interface FieldDiff {
  oldValue: any;
  newValue: any;
  changed: boolean;
}

/**
 * Mapping-level difference metadata
 */
export interface MappingDiff {
  oldMapping: FieldMappingMeta | null;
  newMapping: FieldMappingMeta | null;
  changed: boolean;
}

/**
 * Complete version comparison result
 */
export interface VersionComparison {
  fieldDiffs: Record<string, FieldDiff>;
  mappingDiffs: Record<string, MappingDiff>;
  oldVersion: DocumentVersion;
  newVersion: DocumentVersion;
}

/**
 * Compare two document versions and return differences
 * 
 * @param oldVersion - Earlier version
 * @param newVersion - Later version
 * @returns Comparison result with field and mapping diffs
 */
export function compareVersions(
  oldVersion: DocumentVersion,
  newVersion: DocumentVersion
): VersionComparison {
  const fieldDiffs: Record<string, FieldDiff> = {};
  const mappingDiffs: Record<string, MappingDiff> = {};

  // Get all unique field keys from both versions
  const oldFields = oldVersion.editableData?.fields || {};
  const newFields = newVersion.editableData?.fields || {};
  const allFieldKeys = new Set([
    ...Object.keys(oldFields),
    ...Object.keys(newFields)
  ]);

  // Compare each field
  for (const fieldKey of allFieldKeys) {
    const oldValue = oldFields[fieldKey];
    const newValue = newFields[fieldKey];
    const changed = !deepEqual(oldValue, newValue);

    fieldDiffs[fieldKey] = {
      oldValue,
      newValue,
      changed
    };
  }

  // Compare mapping metadata if available
  const oldMappingMeta = oldVersion.mappingMetadata || {};
  const newMappingMeta = newVersion.mappingMetadata || {};
  const allMappingKeys = new Set([
    ...Object.keys(oldMappingMeta),
    ...Object.keys(newMappingMeta)
  ]);

  for (const fieldKey of allMappingKeys) {
    const oldMapping = oldMappingMeta[fieldKey] || null;
    const newMapping = newMappingMeta[fieldKey] || null;
    const changed = !deepEqual(oldMapping, newMapping);

    mappingDiffs[fieldKey] = {
      oldMapping,
      newMapping,
      changed
    };
  }

  return {
    fieldDiffs,
    mappingDiffs,
    oldVersion,
    newVersion
  };
}

/**
 * Deep equality comparison for values
 * Handles primitives, objects, arrays, null, undefined
 */
function deepEqual(a: any, b: any): boolean {
  // Strict equality check (handles primitives, null, undefined, same references)
  if (a === b) return true;

  // Type mismatch or one is null/undefined
  if (typeof a !== typeof b || a == null || b == null) {
    return false;
  }

  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  // Objects
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    return keysA.every(key => deepEqual(a[key], b[key]));
  }

  // Other types (functions, symbols, etc.)
  return false;
}

/**
 * Get only changed fields from comparison
 */
export function getChangedFields(comparison: VersionComparison): Record<string, FieldDiff> {
  const changed: Record<string, FieldDiff> = {};
  
  for (const [key, diff] of Object.entries(comparison.fieldDiffs)) {
    if (diff.changed) {
      changed[key] = diff;
    }
  }
  
  return changed;
}

/**
 * Get only changed mappings from comparison
 */
export function getChangedMappings(comparison: VersionComparison): Record<string, MappingDiff> {
  const changed: Record<string, MappingDiff> = {};
  
  for (const [key, diff] of Object.entries(comparison.mappingDiffs)) {
    if (diff.changed) {
      changed[key] = diff;
    }
  }
  
  return changed;
}

/**
 * Format field value for display in diff view
 */
export function formatFieldValue(value: any): string {
  if (value == null) return '(empty)';
  
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }
    return JSON.stringify(value, null, 2);
  }
  
  return String(value);
}

/**
 * Format mapping metadata for display
 */
export function formatMapping(mapping: FieldMappingMeta | null): string {
  if (!mapping) return '(no mapping)';
  
  const source = `${mapping.sourceModel}.${mapping.sourceField}`;
  
  if (mapping.success) {
    return `✓ ${source}`;
  } else {
    return `✗ ${source} (${mapping.error || 'failed'})`;
  }
}
