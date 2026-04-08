/**
 * V5.6 EMIP Core - PDF Text Extraction
 * 
 * EXTRACTION LAYER - PDF to Text Conversion
 * 
 * Responsibilities:
 * - Extract raw text from PDF files
 * - Use browser-compatible PDF.js library
 * - Provide clean text output for parser
 * 
 * Architecture:
 * - Uses existing documentEngine PDF extraction utility
 * - Handles browser File objects
 * - Returns plain text string
 */

import { extractTextFromPDF as documentEngineExtract } from '@/src/features/documentEngine/utils/pdfToText';

/**
 * Extract text content from PDF file
 * 
 * V5.6: Uses existing browser-compatible PDF extraction from documentEngine
 * 
 * @param file PDF file (File object from browser)
 * @returns Extracted text content
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  console.log('📄 V5.6 [PDF Extractor] Starting text extraction', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type
  });

  try {
    // Use existing documentEngine extraction (browser-compatible)
    const extractedText = await documentEngineExtract(file);
    
    console.log('📄 V5.6 PDF TEXT EXTRACTED', {
      fileName: file.name,
      length: extractedText.length,
      preview: extractedText.substring(0, 200)
    });
    
    return extractedText;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('📄 [PDF Extractor] Extraction failed:', errorMessage);
    throw new Error(`PDF text extraction failed: ${errorMessage}`);
  }
}
