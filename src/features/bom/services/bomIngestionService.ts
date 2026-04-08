/**
 * V5.5 EMIP Core - BOM Ingestion Service (Upload Pipeline)
 * 
 * UI INTEGRATION LAYER - Complete BOM Upload Flow
 * 
 * Responsibilities:
 * - Accept PDF file from UI
 * - Extract text from PDF
 * - Upload artifact to storage
 * - Trigger ingestion pipeline
 * - Return comprehensive result
 * 
 * Pipeline:
 * Upload File → Extract Text → Store Artifact → Ingest BOM → Persist
 * 
 * Architecture:
 * - Orchestrates existing services (artifactService, ingestion)
 * - Provides single entry point for UI
 * - Handles all error cases
 */

import { uploadEngineeringMaster, type ArtifactMetadata } from '@/src/core/services/artifactService';
import { ingestBOMFromText, type IngestionMetadata } from '@/src/core/data/bom/ingestion';

// ============================================================
// TYPES
// ============================================================

export interface BOMUploadResult {
  success: boolean;
  partNumber: string;
  revision: string;
  recordsCreated: number;
  artifactUrl: string | null;
  errors: string[];
  warnings: string[];
}

// ============================================================
// PDF TEXT EXTRACTION (Simplified)
// ============================================================

// V5.6: Import real PDF extraction
import { extractTextFromPDF } from '../extraction/pdfExtractor';
import { parseBOMText } from '../extraction/bomParser';
// V6.0.1: Import core parser for part number extraction
import { parseBOMWithValidation } from '@/src/core/parser/parserService';

/**
 * Extract part number from filename
 * 
 * V5.6: Enhanced extraction for multiple patterns
 * 
 * Patterns supported:
 * - NH123456789012_RevB.pdf
 * - NH45-110858-01 BOM.pdf
 * - BOM_NH123456789012.pdf
 * - 45-110858-01.pdf
 * 
 * @param fileName File name
 * @returns Extracted part number or null if not found
 */
function extractPartNumberFromFilename(fileName: string): string | null {
  // V5.7: Preserve full part number - remove extensions and BOM suffix ONLY
  let cleaned = fileName
    .replace(/\.pdf$/i, '') // Remove .pdf extension
    .trim();
  
  // Remove "BOM" suffix if present (with optional separators)
  cleaned = cleaned.replace(/[\s_-]*BOM$/i, '');
  
  // Remove "BOM" prefix if present (with optional separators)
  cleaned = cleaned.replace(/^BOM[\s_-]*/i, '');
  
  cleaned = cleaned.trim();
  
  // Pattern 1: NH followed by digits with optional dashes (NH45-110858-01)
  const nhDashMatch = cleaned.match(/NH\d{2}-\d{6}-\d{2}/i);
  if (nhDashMatch) {
    return nhDashMatch[0];
  }
  
  // Pattern 2: NH followed by 12 consecutive digits
  const nhMatch = cleaned.match(/NH\d{12}/i);
  if (nhMatch) {
    return nhMatch[0];
  }
  
  // Pattern 3: XX-XXXXXX-XX format (common part number pattern)
  const dashPatternMatch = cleaned.match(/\d{2}-\d{6}-\d{2}/);
  if (dashPatternMatch) {
    return dashPatternMatch[0];
  }
  
  // Pattern 4: 12+ consecutive digits
  const digitMatch = cleaned.match(/\d{12,}/);
  if (digitMatch) {
    return digitMatch[0];
  }
  
  // Pattern 5: Use entire cleaned filename if it looks like a part number
  // Must be at least 6 characters and contain alphanumeric with optional dashes
  if (/^[A-Z0-9][A-Z0-9-]{5,}$/i.test(cleaned)) {
    return cleaned;
  }
  
  return null;
}

/**
 * Extract revision from filename
 * 
 * Attempts to extract revision from patterns like:
 * - RevB, Rev_B, REV-B
 * - _B.pdf, -B.pdf
 * 
 * @param fileName File name
 * @returns Extracted revision or 'A'
 */
function extractRevisionFromFilename(fileName: string): string {
  const nameWithoutExt = fileName.replace(/\.pdf$/i, '');
  
  // Try Rev patterns
  const revMatch = nameWithoutExt.match(/rev[_-]?([a-zA-Z0-9]+)/i);
  if (revMatch) {
    return revMatch[1].toUpperCase();
  }
  
  // Try suffix patterns (_B, -B)
  const suffixMatch = nameWithoutExt.match(/[_-]([A-Z])$/);
  if (suffixMatch) {
    return suffixMatch[1];
  }
  
  return 'A'; // Default to Rev A
}

/**
 * V6.0.2: Resolve part number from multiple trusted sources
 * 
 * Trust hierarchy (UPDATED):
 * 1. User-provided manual input (explicit override)
 * 2. BOM text/header-derived part number (PRIMARY AUTOMATIC TRUTH)
 * 3. Filename-derived part number (fallback only)
 * 
 * Design intent:
 * - Engineering BOM content is more trustworthy than manually downloaded filenames
 * - Filenames are user-managed and may be mislabeled
 * - Parsed BOM header should determine SKU identity whenever available
 * - Manual user entry remains highest priority (explicit human intent)
 * 
 * @param sources Part number sources
 * @returns Resolved part number and source, or null if all sources fail
 */
function resolvePartNumber(sources: {
  userInput?: string | null;
  filename?: string | null;
  parsedText?: string | null;
}): { partNumber: string; source: 'user_input' | 'filename' | 'parsed_text' } | null {
  // Source 1: User input (highest priority - explicit override)
  if (sources.userInput && sources.userInput.trim().length > 0 && sources.userInput !== 'UNKNOWN') {
    return {
      partNumber: sources.userInput.trim(),
      source: 'user_input'
    };
  }
  
  // Source 2: Parsed text (PRIMARY AUTOMATIC TRUTH - BOM header is authoritative)
  if (sources.parsedText && sources.parsedText.trim().length > 0 && sources.parsedText !== 'UNKNOWN') {
    return {
      partNumber: sources.parsedText.trim(),
      source: 'parsed_text'
    };
  }
  
  // Source 3: Filename (fallback only - used when BOM header extraction fails)
  if (sources.filename && sources.filename.trim().length > 0 && sources.filename !== 'UNKNOWN') {
    return {
      partNumber: sources.filename.trim(),
      source: 'filename'
    };
  }
  
  // All sources failed
  return null;
}

// ============================================================
// MAIN INGESTION PIPELINE
// ============================================================

/**
 * Complete BOM upload and ingestion flow
 * 
 * V5.5: Upload → Extract → Store → Ingest
 * 
 * @param file PDF file to upload
 * @param bomText BOM text (if PDF extraction not available)
 * @param metadata Optional metadata overrides
 * @returns Upload result
 */
export async function uploadAndIngestBOM(
  file: File,
  bomText: string,
  metadata?: Partial<{
    partNumber: string;
    revision: string;
    sourceReference: string;
  }>
): Promise<BOMUploadResult> {
  console.log('📥 V5.5 BOM INGESTION START', {
    fileName: file.name,
    fileSize: file.size,
    timestamp: new Date().toISOString()
  });

  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // V6.0.1: STEP 1 - Extract metadata from filename (but don't fail yet)
    const filenamePartNumber = extractPartNumberFromFilename(file.name);
    const filenameRevision = extractRevisionFromFilename(file.name);
    const sourceReference = metadata?.sourceReference || file.name;

    console.log('📥 V6.0.1 [BOM Upload] Filename extraction attempt', {
      filenamePartNumber: filenamePartNumber || 'NOT_FOUND',
      filenameRevision,
      sourceReference
    });

    // V6.0.1: STEP 2 - Extract text from PDF BEFORE validating part number
    // This allows us to use parsed text as fallback source
    let textToIngest = bomText;
    
    if (!textToIngest || textToIngest.trim().length === 0) {
      try {
        textToIngest = await extractTextFromPDF(file);
        console.log('📥 V6.0.1 [BOM Upload] Text extracted from PDF', {
          length: textToIngest.length
        });
      } catch (extractError) {
        const extractMsg = extractError instanceof Error ? extractError.message : 'Unknown extraction error';
        warnings.push(`PDF text extraction failed: ${extractMsg}`);
      }
    }
    
    // V6.0.1: STEP 3 - Parse BOM text to extract part number from content
    let parsedTextPartNumber: string | null = null;
    
    if (textToIngest && textToIngest.trim().length > 0) {
      try {
        // Use core parser to extract part number from BOM header
        const parseResult = parseBOMWithValidation(textToIngest);
        
        if (parseResult.success && parseResult.data) {
          parsedTextPartNumber = parseResult.data.masterPartNumber;
          
          console.log('📥 V6.0.1 [BOM Upload] Parsed text part number', {
            parsedPartNumber: parsedTextPartNumber || 'NOT_FOUND',
            operationCount: parseResult.data.operations.length
          });
        }
        
        // Also try simple bomParser for component count preview
        try {
          const simpleParseResult = parseBOMText(textToIngest);
          if (simpleParseResult.components.length === 0) {
            warnings.push('No components found in BOM text. Parser may need adjustment for this BOM format.');
          }
        } catch {
          // Ignore simple parser errors
        }
      } catch (parseError) {
        warnings.push('BOM structure preview failed - will attempt ingestion with available metadata');
      }
    }
    
    // V6.0.2: STEP 4 - Resolve part number using trust hierarchy
    const partNumberResolution = resolvePartNumber({
      userInput: metadata?.partNumber,
      filename: filenamePartNumber,
      parsedText: parsedTextPartNumber
    });
    
    if (!partNumberResolution) {
      errors.push('Could not determine part number from filename, BOM content, or manual entry. Please provide a valid part number.');
      return {
        success: false,
        partNumber: 'UNKNOWN',
        revision: metadata?.revision || filenameRevision,
        recordsCreated: 0,
        artifactUrl: null,
        errors,
        warnings
      };
    }
    
    const partNumber = partNumberResolution.partNumber;
    const partNumberSource = partNumberResolution.source;
    const revision = metadata?.revision || filenameRevision;
    
    // V6.0.2: STEP 5 - Conflict detection and warning
    if (parsedTextPartNumber && 
        filenamePartNumber && 
        parsedTextPartNumber !== filenamePartNumber) {
      console.warn('⚠️ V6.0.2 PART NUMBER MISMATCH', {
        parsedTextPartNumber,
        filenamePartNumber,
        chosenSource: partNumberSource,
        finalPartNumber: partNumber,
        fileName: file.name,
        timestamp: new Date().toISOString()
      });
      
      warnings.push(
        `Part number mismatch detected: Filename suggests "${filenamePartNumber}" but BOM header contains "${parsedTextPartNumber}". Using ${partNumberSource === 'parsed_text' ? 'BOM header' : partNumberSource} as source of truth.`
      );
    }
    
    // V6.0.2: STEP 6 - Enhanced source trace logging
    console.log('🧠 V6.0.2 PART NUMBER RESOLUTION', {
      userInputPartNumber: metadata?.partNumber || 'NOT_PROVIDED',
      parsedTextPartNumber: parsedTextPartNumber || 'NOT_FOUND',
      filenamePartNumber: filenamePartNumber || 'NOT_FOUND',
      finalPartNumber: partNumber,
      source: partNumberSource,
      revision,
      timestamp: new Date().toISOString()
    });

    // V6.0.1: STEP 5 - Generate ingestion batch ID
    const ingestionBatchId = crypto.randomUUID();

    // V6.0.1: STEP 6 - Upload artifact to storage
    const artifactMetadata: ArtifactMetadata = {
      partNumber,
      revision,
      ingestion_batch_id: ingestionBatchId,
      sourceReference
    };

    const uploadResult = await uploadEngineeringMaster(file, artifactMetadata);

    if (!uploadResult.success) {
      const errorMsg = `Artifact upload failed: ${uploadResult.error || 'Unknown error'}`;
      errors.push(errorMsg);
      
      console.error('🚫 V5.5.1A INFRASTRUCTURE ERROR', {
        type: 'artifact_upload_failure',
        detail: uploadResult.error,
        partNumber,
        revision
      });
      
      // V5.5.1A: Do NOT proceed with ingestion if artifact upload failed
      return {
        success: false,
        partNumber,
        revision,
        recordsCreated: 0,
        artifactUrl: null,
        errors,
        warnings: [...warnings, 'Ingestion stopped - artifact must be stored before BOM records can be created']
      };
    }

    console.log('📥 V6.0.1 [BOM Upload] Artifact uploaded', {
      url: uploadResult.url,
      path: uploadResult.path
    });
    
    // V6.0.1: STEP 7 - Validate we have text to ingest
    if (!textToIngest || textToIngest.trim().length === 0) {
      errors.push('No BOM text extracted from PDF and no manual text provided. Please paste BOM text in the form.');
      return {
        success: false,
        partNumber,
        revision,
        recordsCreated: 0,
        artifactUrl: uploadResult.url,
        errors,
        warnings
      };
    }

    // V6.0.1: STEP 8 - Ingest BOM data
    const ingestionMetadata: IngestionMetadata = {
      sourceReference,
      sourceType: 'engineering_master',
      revision,
      partNumber, // V5.7.2: Pass filename-derived part number as canonical source
      artifactUrl: uploadResult.url,
      artifactPath: uploadResult.path
    };

    const ingestionResult = await ingestBOMFromText(textToIngest, ingestionMetadata);

    console.log('💾 V5.7.1 DB INSERT COMPLETE', {
      partNumber: ingestionResult.masterPartNumber,
      revision: ingestionResult.revision,
      recordsCreated: ingestionResult.recordsCreated,
      timestamp: new Date().toISOString()
    });

    // Merge errors and warnings
    errors.push(...ingestionResult.errors);
    warnings.push(...ingestionResult.warnings);

    // V5.7.1: Return canonical persisted values from ingestion result
    return {
      success: ingestionResult.success,
      partNumber: ingestionResult.masterPartNumber,
      revision: ingestionResult.revision || revision, // Use persisted revision or fallback
      recordsCreated: ingestionResult.recordsCreated,
      artifactUrl: uploadResult.url,
      errors,
      warnings
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during BOM upload';
    console.error('📥 [BOM Upload] Error:', errorMessage);
    
    errors.push(errorMessage);
    
    return {
      success: false,
      partNumber: 'UNKNOWN',
      revision: 'UNKNOWN',
      recordsCreated: 0,
      artifactUrl: null,
      errors,
      warnings
    };
  }
}
