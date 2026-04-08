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

/**
 * Extract text from PDF file
 * 
 * V5.5: Simplified approach - expects user to provide text
 * For full PDF parsing, integrate pdf.js or similar library
 * 
 * @param file PDF file
 * @returns Extracted text
 */
async function extractTextFromPDF(file: File): Promise<string> {
  // TODO: Implement proper PDF text extraction using pdf.js
  // For now, this is a placeholder that returns empty string
  // The UI should allow users to paste BOM text directly
  
  console.log('📥 V5.5 [BOM Upload] PDF text extraction placeholder', {
    fileName: file.name,
    fileSize: file.size
  });
  
  // Placeholder: Return empty string and rely on manual text input
  return '';
}

/**
 * Extract part number from filename
 * 
 * Attempts to extract part number from filename patterns like:
 * - NH123456789012_RevB.pdf
 * - BOM_NH123456789012.pdf
 * 
 * @param fileName File name
 * @returns Extracted part number or 'UNKNOWN'
 */
function extractPartNumberFromFilename(fileName: string): string {
  // Remove .pdf extension
  const nameWithoutExt = fileName.replace(/\.pdf$/i, '');
  
  // Try to find NH followed by 12 digits
  const nhMatch = nameWithoutExt.match(/NH\d{12}/);
  if (nhMatch) {
    return nhMatch[0];
  }
  
  // Try to find 12+ digit number
  const digitMatch = nameWithoutExt.match(/\d{12,}/);
  if (digitMatch) {
    return digitMatch[0];
  }
  
  return 'UNKNOWN';
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
    const partNumber = metadata?.partNumber || extractPartNumberFromFilename(file.name);
    const revision = metadata?.revision || extractRevisionFromFilename(file.name);
    const sourceReference = metadata?.sourceReference || file.name;

    if (partNumber === 'UNKNOWN') {
      warnings.push('Could not extract part number from filename. Using UNKNOWN.');
    }

    console.log('📥 V5.5 [BOM Upload] Extracted metadata', {
      partNumber,
      revision,
      sourceReference
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
      errors.push(`Artifact upload failed: ${uploadResult.error || 'Unknown error'}`);
      return {
        success: false,
        partNumber,
        revision,
        recordsCreated: 0,
        artifactUrl: null,
        errors,
        warnings
      };
    }

    console.log('📥 V5.5 [BOM Upload] Artifact uploaded', {
      url: uploadResult.url,
      path: uploadResult.path
    });

    // Step 4: Extract text from PDF or use provided text
    let textToIngest = bomText;
    
    if (!textToIngest || textToIngest.trim().length === 0) {
      // Try to extract from PDF
      textToIngest = await extractTextFromPDF(file);
      
      if (!textToIngest || textToIngest.trim().length === 0) {
        errors.push('No BOM text provided and PDF text extraction not available. Please paste BOM text manually.');
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
