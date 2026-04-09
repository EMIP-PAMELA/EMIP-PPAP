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
  
  /** V5.6.4: Component part number (renamed from child_part_number to match live DB) */
  component_part_number: string;
  
  /** Quantity required */
  quantity: number;
  
  /** Unit of measure (EA, FT, IN, etc.) */
  unit: string | null;
  
  /** Component description */
  description: string | null;
  
  /** Length for wire/cable (optional) */
  length?: number | null;
  
  /** V5.6.4: Wire gauge (e.g., "18", "20", "22") */
  gauge?: string | null;
  
  /** V5.6.4: Wire color (e.g., "RED", "BLACK", "WHITE") */
  color?: string | null;
  
  // ============================================================
  // Phase 3H.14.1: Structured Classification & Normalization
  // ============================================================
  
  /** Phase 3H.14.1: Component category (WIRE, CONNECTOR, TERMINAL, etc.) */
  category?: string;
  
  /** Phase 3H.15.2: Original color before normalization */
  rawColor?: string | null;
  
  /** Phase 3H.16.5: Standardized color name (lowercase to match DB) */
  normalizedcolor?: string | null;
  
  /** Operation/step number where component is used */
  operation_step?: string | null;
  
  /** V5.6.4: Revision number if available from source */
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
  
  // V5.2.5: Revision Intelligence
  /** V5.2.5: Numeric order for revision comparison (higher = newer) */
  revision_order?: number;
  
  // V5.3: Artifact Storage
  /** V5.3: Public URL to original engineering master PDF */
  artifact_url?: string | null;
  
  /** V5.3: Storage path for artifact in Supabase Storage */
  artifact_path?: string | null;
  
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
 * Raw BOM data from parser output
 * 
 * This is the direct output from parserService before normalization.
 * 
 * V5.2.5: Added revision extraction fields
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
  
  /** V5.2.5: Raw revision string extracted from BOM header (null if not found) */
  revision_raw?: string | null;
  
  /** V5.2.5: Raw revision date string extracted from BOM header (null if not found) */
  revision_date_raw?: string | null;
  
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
