/**
 * V5.0 EMIP Core - Canonical BOM Data Model
 * 
 * FOUNDATION LAYER - Engineering Data Backbone
 * 
 * This is the SINGLE SOURCE OF TRUTH for BOM data structures.
 * All feature modules (PPAP, Copper Index, etc.) consume these types.
 * 
 * Principles:
 * - Normalized structure
 * - Versioning and traceability
 * - Source tracking
 * - Extensible metadata
 */

// ============================================================
// CANONICAL BOM RECORD (Normalized, Database-Ready)
// ============================================================

/**
 * Normalized BOM record - canonical storage format
 * 
 * This represents a single parent-child relationship in the BOM tree.
 * All BOM data should be stored/retrieved in this format.
 */
export interface BOMRecord {
  /** Unique identifier for this BOM record */
  id?: string;
  
  /** Parent part number (assembly) */
  parent_part_number: string;
  
  /** Child part number (component) */
  child_part_number: string;
  
  /** Quantity required */
  quantity: number;
  
  /** Unit of measure (EA, FT, IN, etc.) */
  unit: string | null;
  
  /** Component description */
  description: string | null;
  
  /** Length for wire/cable (optional) */
  length?: number | null;
  
  /** ACI code if applicable */
  aci_code?: string | null;
  
  /** Operation/step number where component is used */
  operation_step?: string | null;
  
  /** Resource ID (work center, machine, etc.) */
  resource_id?: string | null;
  
  /** Extended metadata (process notes, special instructions, etc.) */
  metadata?: Record<string, unknown>;
  
  // ============================================================
  // TRACEABILITY FIELDS (V5.0 Requirement)
  // ============================================================
  
  /** Source reference (file name, system ID, etc.) */
  source_reference: string;
  
  /** Source type (visual_export, engineering_master, manual_entry, etc.) */
  source_type: 'visual_export' | 'engineering_master' | 'manual_entry' | 'system_import';
  
  /** Ingestion timestamp */
  ingestion_timestamp: string;
  
  /** Parser version used for extraction */
  parser_version?: string;
  
  /** Revision number if available from source */
  revision?: string | null;
  
  // ============================================================
  // VERSION CONTROL FIELDS (V5.2 Requirement)
  // ============================================================
  
  /** V5.2: Is this the current active BOM version? Only one active per part. */
  is_active?: boolean;
  
  /** V5.2: Ingestion batch ID - groups all records from single ingestion */
  ingestion_batch_id?: string;
  
  /** V5.2: Optional sequential version number for user reference */
  version_number?: number | null;
  
  /** Created/updated timestamps */
  created_at?: string;
  updated_at?: string;
}

// ============================================================
// RAW PARSING TYPES (Pre-Normalization)
// ============================================================

/**
 * Raw operation data from parser
 * 
 * Represents a single operation/step in the manufacturing process.
 */
export interface RawOperation {
  /** Operation step number (e.g., "10", "20", "30") */
  step: string;
  
  /** Resource/work center ID */
  resourceId: string;
  
  /** Operation description */
  description: string;
  
  /** Raw text lines for this operation */
  rawLines: string[];
  
  /** Components used in this operation */
  components: RawComponent[];
}

/**
 * Raw component data from parser
 * 
 * Represents a single component before normalization.
 */
export interface RawComponent {
  /** Original line from source document */
  rawLine: string;
  
  /** All candidate part IDs detected in line */
  candidateIds: string[];
  
  /** Primary detected part ID */
  detectedPartId: string;
  
  /** Detected ACI code (if any) */
  detectedAci: string | null;
  
  /** Detected quantity */
  detectedQty: number;
  
  /** Detected unit of measure */
  detectedUom: string | null;
}

/**
 * Raw BOM data structure from parser
 * 
 * Output format from parser before normalization.
 */
export interface RawBOMData {
  /** Master part number */
  masterPartNumber: string;
  
  /** List of operations with their components */
  operations: RawOperation[];
  
  /** Original raw text */
  rawText: string;
  
  /** Page-level parsing logs */
  pageLogs: PageLog[];
  
  /** Process instructions extracted from text */
  processInstructions?: ProcessInstruction[];
}

/**
 * Page-level parsing information
 */
export interface PageLog {
  pageNumber: number;
  hasText: boolean;
  componentCount: number;
  operationCount: number;
  warning?: string | null;
}

/**
 * Process instruction/note
 */
export interface ProcessInstruction {
  step: string;
  instruction: string;
}

// ============================================================
// WIRE DETECTION TYPES
// ============================================================

/**
 * Wire/cable specific detection data
 */
export interface WireDetectionResult {
  /** Is this component a wire/cable? */
  isWire: boolean;
  
  /** Detected gauge (e.g., "18", "22") */
  gauge?: string;
  
  /** Detected length */
  length?: number;
  
  /** Length unit (IN, FT, etc.) */
  lengthUnit?: string;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Matching patterns found */
  matchedPatterns?: string[];
}

// ============================================================
// BOM QUERY TYPES
// ============================================================

/**
 * Flattened BOM view (multi-level explosion)
 */
export interface FlattenedBOM {
  parentPartNumber: string;
  components: BOMRecord[];
  totalLevels: number;
}

/**
 * Wire-specific BOM view
 */
export interface WireBOM {
  parentPartNumber: string;
  wires: BOMRecord[];
  totalWireLength?: number;
}

// ============================================================
// PARSER CONFIDENCE & ERROR TYPES
// ============================================================

/**
 * Parser confidence scoring
 */
export interface ParserConfidence {
  overall: number;
  partIdConfidence: number;
  quantityConfidence: number;
  uomConfidence: number;
  aciConfidence: number;
}

/**
 * Parser error/warning
 */
export interface ParserError {
  lineNumber: number;
  rawLine: string;
  errorType: 'parse_failed' | 'ambiguous_part_id' | 'missing_qty' | 'ocr_issue';
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Parsing result with errors
 */
export interface ParseResult {
  success: boolean;
  data?: RawBOMData;
  errors: ParserError[];
  warnings: ParserError[];
  confidence: ParserConfidence;
}
