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
    // Step 1: Extract metadata from filename if not provided
    const extractedPartNumber = extractPartNumberFromFilename(file.name);
    const partNumber = metadata?.partNumber || extractedPartNumber;
    const revision = metadata?.revision || extractRevisionFromFilename(file.name);
    const sourceReference = metadata?.sourceReference || file.name;

    // V5.6: Require valid part number
    if (!partNumber) {
      errors.push('Could not extract part number from filename. Please provide the part number in the form.');
      return {
        success: false,
        partNumber: 'UNKNOWN',
        revision,
        recordsCreated: 0,
        artifactUrl: null,
        errors,
        warnings
      };
    }

    console.log('📥 V5.6 [BOM Upload] Extracted metadata', {
      partNumber,
      revision,
      sourceReference,
      autoDetected: {
        partNumber: extractedPartNumber !== null && !metadata?.partNumber,
        revision: !metadata?.revision
      }
    });

    // Step 2: Generate ingestion batch ID
    const ingestionBatchId = crypto.randomUUID();

    // Step 3: Upload artifact to storage
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

    console.log('📥 V5.5 [BOM Upload] Artifact uploaded', {
      url: uploadResult.url,
      path: uploadResult.path
    });

    // Step 4: Extract text from PDF or use provided text
    let textToIngest = bomText;
    
    if (!textToIngest || textToIngest.trim().length === 0) {
      // V5.6: Extract text from PDF
      try {
        textToIngest = await extractTextFromPDF(file);
        console.log('📥 V5.6 [BOM Upload] Text extracted from PDF', {
          length: textToIngest.length
        });
      } catch (extractError) {
        const extractMsg = extractError instanceof Error ? extractError.message : 'Unknown extraction error';
        warnings.push(`PDF text extraction failed: ${extractMsg}`);
      }
      
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
    }
    
    // V5.6: Parse BOM text to validate structure
    try {
      const parsed = parseBOMText(textToIngest);
      
      if (parsed.components.length === 0) {
        warnings.push('No components found in BOM text. Parser may need adjustment for this BOM format.');
      }
      
      console.log('📥 V5.6 [BOM Upload] Parsed structure preview', {
        totalComponents: parsed.components.length,
        wires: parsed.components.filter(c => c.type === 'wire').length,
        hasGaugeData: parsed.components.some(c => c.gauge)
      });
    } catch (parseError) {
      warnings.push('BOM structure preview failed - proceeding with raw text ingestion');
    }

    // Step 5: Ingest BOM data
    const ingestionMetadata: IngestionMetadata = {
      sourceReference,
      sourceType: 'engineering_master',
      revision,
      artifactUrl: uploadResult.url,
      artifactPath: uploadResult.path
    };

    const ingestionResult = await ingestBOMFromText(textToIngest, ingestionMetadata);

    console.log('💾 V5.5 DB INSERT COMPLETE', {
      partNumber: ingestionResult.masterPartNumber,
      recordsCreated: ingestionResult.recordsCreated,
      timestamp: new Date().toISOString()
    });

    // Merge errors and warnings
    errors.push(...ingestionResult.errors);
    warnings.push(...ingestionResult.warnings);

    return {
      success: ingestionResult.success,
      partNumber: ingestionResult.masterPartNumber,
      revision,
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
