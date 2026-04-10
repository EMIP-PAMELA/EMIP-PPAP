/**
 * Phase 3H.16.7: Single Source of Truth - BOM Schema Definition
 * 
 * This file defines the AUTHORITATIVE schema for the bom_records table.
 * ALL code must reference this schema to prevent mismatches.
 * 
 * Database: Supabase (PostgreSQL)
 * Table: bom_records
 * 
 * GOVERNANCE RULES:
 * - Field names use PostgreSQL convention (lowercase, snake_case)
 * - All fields are optional (nullable) unless marked required
 * - This schema reflects the ACTUAL database schema (as of Phase 3H.16.7)
 */

export interface BOMRecordSchema {
  // ============================================================
  // PRIMARY IDENTIFIER
  // ============================================================
  
  /** Database primary key (auto-increment) */
  id: number;
  
  // ============================================================
  // PART IDENTIFICATION
  // ============================================================
  
  /** Parent assembly part number (e.g., "W20-GR-1015-BC") */
  parent_part_number: string;
  
  /** Component part number (child part) */
  component_part_number: string;
  
  /** Component description */
  description?: string | null;
  
  // ============================================================
  // QUANTITY & MEASUREMENTS
  // ============================================================
  
  /** Quantity of component per assembly */
  quantity?: number | null;
  
  /** Unit of measure (e.g., "EA", "FT", "IN") */
  unit?: string | null;
  
  /** Wire length (if wire component) */
  length?: number | null;
  
  /** Wire gauge (e.g., "18", "20", "22") */
  gauge?: string | null;
  
  // ============================================================
  // WIRE COLOR FIELDS
  // ============================================================
  
  /** Original color from BOM (may be abbreviation like "GR", "BK") */
  color?: string | null;
  
  /** Phase 3H.15.2: Raw color before any normalization */
  rawColor?: string | null;
  
  /** Phase 3H.16.5: Normalized color (lowercase, e.g., "green", "black") */
  normalizedcolor?: string | null;
  
  // ============================================================
  // CLASSIFICATION
  // ============================================================
  
  /** Phase 3H.16: Component category (WIRE, TERMINAL, CONNECTOR, HOUSING, SEAL, UNKNOWN) */
  category?: string | null;
  
  // ============================================================
  // MANUFACTURING INFO
  // ============================================================
  
  /** Operation step where component is used */
  operation_step?: string | null;
  
  // ============================================================
  // VERSION CONTROL
  // ============================================================
  
  /** Revision number (e.g., "08", "09", "A", "B") */
  revision?: string | null;
  
  /** Numeric revision order for sorting */
  revision_order?: number | null;
  
  /** Is this the currently active BOM version? */
  is_active?: boolean;
  
  /** Unique batch ID for this ingestion */
  ingestion_batch_id?: string | null;
  
  /** Version number within part history */
  version_number?: number | null;
  
  // ============================================================
  // METADATA
  // ============================================================
  
  /** Source reference (e.g., filename, URL) */
  source_reference?: string | null;
  
  /** When record was created */
  created_at?: string | null;
  
  /** When record was last updated */
  updated_at?: string | null;
  
  /** Artifact URL (PDF, document link) */
  artifact_url?: string | null;
}

/**
 * Minimal BOMRecord type for queries that only need core fields
 */
export interface BOMRecordCore {
  id: number;
  component_part_number: string;
  description?: string | null;
  color?: string | null;
  normalizedcolor?: string | null;
  category?: string | null;
}

/**
 * Type-safe field list for Supabase queries
 * Use this to ensure query field names match database schema
 */
export const BOM_FIELDS = {
  // Core fields
  CORE: 'id, component_part_number, description, color, normalizedcolor, category',
  
  // Wire-specific fields
  WIRE: 'length, gauge, color, normalizedcolor',
  
  // Version control fields
  VERSION: 'revision, revision_order, is_active, ingestion_batch_id, version_number',
  
  // All fields
  ALL: '*',
} as const;

/**
 * Valid category values
 * Phase 3H.17.7: Aligned with classifyComponent() outputs
 * All categories returned by the classifier must be listed here
 */
export const VALID_CATEGORIES = [
  'WIRE',
  'TERMINAL',
  'CONNECTOR',
  'HOUSING',
  'SEAL',
  'HARDWARE',
  'LABEL',
  'SLEEVING',
  'UNKNOWN',
] as const;

export type CategoryType = typeof VALID_CATEGORIES[number];

/**
 * Schema validation utility
 * Checks if a record conforms to expected schema
 */
export function validateBOMRecord(record: any): record is BOMRecordSchema {
  return (
    typeof record.id === 'number' &&
    typeof record.component_part_number === 'string' &&
    typeof record.parent_part_number === 'string'
  );
}

/**
 * Type guard for category validation
 */
export function isValidCategory(category: string): category is CategoryType {
  return VALID_CATEGORIES.includes(category as CategoryType);
}
