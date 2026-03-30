/**
 * PDF Text Extraction Service
 * Phase W1.5 - PDF Text Extraction Layer
 * 
 * Purpose: Extract structured text from PDF files before preprocessing and parsing.
 * This fixes the root cause of parser receiving binary PDF data (e.g., "%PDF-1.7").
 * 
 * This is NOT a parser.
 * This is NOT AI.
 * This is a text extraction layer only.
 * 
 * SSR Fix: pdfjs-dist is dynamically imported to prevent server-side execution
 * and DOMMatrix undefined errors during Next.js build.
 */

export interface PDFExtractionResult {
  text: string;
  pageCount: number;
  extractedLineCount: number;
  success: boolean;
  error?: string;
}

/**
 * Extract text from PDF file
 * 
 * Process:
 * 1. Load PDF as ArrayBuffer
 * 2. Iterate all pages
 * 3. Extract text content using getTextContent()
 * 4. Reconstruct lines intelligently
 * 5. Return single string with newline-separated lines
 * 
 * @param file PDF file to extract text from
 * @returns Extraction result with text and metadata
 */
export async function extractTextFromPDF(file: File): Promise<PDFExtractionResult> {
  console.log('[W1.5 PDF] Loading PDF...');
  
  try {
    // SSR Fix: Dynamically import pdfjs-dist to prevent server-side execution
    const pdfjsLib = await import('pdfjs-dist');
    
    // Configure PDF.js worker (browser-only)
    if (typeof window !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    }
    
    // Step 1: Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Step 2: Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;
    
    const pageCount = pdf.numPages;
    console.log('[W1.5 PDF] Pages detected:', pageCount);
    
    // Step 3: Extract text from all pages
    const allLines: string[] = [];
    
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      console.log('[W1.5 PDF] Extracting page', pageNum, '...');
      
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Step 4: Reconstruct lines from text items
      const pageLines = reconstructLinesFromTextContent(textContent);
      
      console.log('[W1.5 PDF] Page', pageNum, 'lines:', pageLines.length);
      
      allLines.push(...pageLines);
    }
    
    // Step 5: Join all lines into single string
    const extractedText = allLines.join('\n');
    
    console.log('[W1.5 PDF] Total extracted lines:', allLines.length);
    console.log('[W1.5 PDF] Extraction complete');
    
    return {
      text: extractedText,
      pageCount,
      extractedLineCount: allLines.length,
      success: true
    };
    
  } catch (error) {
    console.error('[W1.5 PDF ERROR] Extraction failed:', error);
    
    return {
      text: '',
      pageCount: 0,
      extractedLineCount: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Reconstruct lines from PDF text content items
 * 
 * PDF.js returns text as individual items with positions.
 * We need to reconstruct logical lines based on Y-position.
 * 
 * @param textContent Text content from PDF.js getTextContent()
 * @returns Array of reconstructed lines
 */
function reconstructLinesFromTextContent(textContent: any): string[] {
  interface TextItem {
    str: string;
    transform: number[];
    width: number;
    height: number;
  }
  
  const items = textContent.items as TextItem[];
  
  if (!items || items.length === 0) {
    return [];
  }
  
  // Group items by Y-position (same line)
  interface LineGroup {
    y: number;
    items: { x: number; text: string }[];
  }
  
  const lineGroups: LineGroup[] = [];
  const yTolerance = 2; // Pixels tolerance for same line
  
  for (const item of items) {
    if (!item.str || item.str.trim() === '') {
      continue;
    }
    
    const y = item.transform[5]; // Y-position
    const x = item.transform[4]; // X-position
    
    // Find existing line group with similar Y
    let lineGroup = lineGroups.find(
      group => Math.abs(group.y - y) < yTolerance
    );
    
    if (!lineGroup) {
      lineGroup = { y, items: [] };
      lineGroups.push(lineGroup);
    }
    
    lineGroup.items.push({ x, text: item.str });
  }
  
  // Sort line groups by Y (top to bottom)
  lineGroups.sort((a, b) => b.y - a.y);
  
  // Reconstruct lines by sorting items within each line by X (left to right)
  const lines: string[] = [];
  
  for (const lineGroup of lineGroups) {
    // Sort items by X position
    lineGroup.items.sort((a, b) => a.x - b.x);
    
    // Join items with space
    const lineText = lineGroup.items.map(item => item.text).join(' ');
    
    if (lineText.trim()) {
      lines.push(lineText);
    }
  }
  
  return lines;
}

/**
 * Check if text appears to be raw PDF binary
 * 
 * @param text Text to check
 * @returns True if text looks like raw PDF binary
 */
export function isRawPDFBinary(text: string): boolean {
  return text.startsWith('%PDF');
}

/**
 * Get extraction preview (first N lines)
 * 
 * @param text Extracted text
 * @param maxLines Maximum lines to include
 * @returns Preview string
 */
export function getExtractionPreview(text: string, maxLines: number = 20): string {
  const lines = text.split('\n');
  const preview = lines.slice(0, maxLines);
  const hasMore = lines.length > maxLines;
  
  return preview.join('\n') + (hasMore ? `\n\n... (${lines.length - maxLines} more lines)` : '');
}
