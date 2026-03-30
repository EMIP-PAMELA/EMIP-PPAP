/**
 * PDF Text Extraction Utility
 * Phase V2.5: Text structure reconstruction (line grouping)
 * 
 * Client-side PDF text extraction using pdfjs-dist.
 * Provides pre-parser ingestion layer for PDF BOM files.
 * 
 * Architecture layer: Ingestion (preprocessing)
 * 
 * IMPORTANT: This must only run in browser context.
 * All pdfjs imports are dynamic to prevent SSR DOMMatrix errors.
 * Worker is loaded from local bundle, not CDN.
 * 
 * V2.5 Fix: Reconstructs line structure from PDF text items using Y/X positioning
 * to prevent text flattening that breaks parser operation detection.
 */

/**
 * Extract text content from a PDF file
 * 
 * @param file - PDF file to extract text from
 * @returns Extracted text content with proper line structure
 * @throws Error if PDF parsing fails or if executed outside browser
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  // V2.3: SSR safety check - must run in browser
  if (typeof window === 'undefined') {
    throw new Error('[PDFExtractor] Cannot run on server - browser context required');
  }
  
  try {
    // V2.3: Dynamic import to prevent SSR evaluation and DOMMatrix errors
    const pdfjsLib = await import('pdfjs-dist');
    
    // V2.4: Local worker via module URL (stable, no CDN dependency)
    const workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    );
    
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc.toString();
    
    console.log('[PDFExtractor] Worker source:', workerSrc.toString());
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const allLines: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      // V2.5: Group text items by Y position to reconstruct lines
      const lineMap = new Map<number, Array<{ x: number; text: string }>>();
      
      for (const item of content.items as any[]) {
        if (!item.str || !item.transform) continue;
        
        const x = item.transform[4]; // X position
        const y = Math.round(item.transform[5]); // Y position (rounded for grouping)
        
        if (!lineMap.has(y)) {
          lineMap.set(y, []);
        }
        
        lineMap.get(y)!.push({ x, text: item.str });
      }
      
      // V2.5: Sort lines by Y position (top to bottom), then sort items by X position (left to right)
      const sortedYPositions = Array.from(lineMap.keys()).sort((a, b) => b - a); // Descending Y = top to bottom
      
      for (const y of sortedYPositions) {
        const items = lineMap.get(y)!;
        items.sort((a, b) => a.x - b.x); // Sort by X position (left to right)
        
        const lineText = items.map(item => item.text).join(' ');
        if (lineText.trim()) {
          allLines.push(lineText);
        }
      }
    }

    const fullText = allLines.join('\n');
    
    // V2.5: Structure reconstruction logging
    console.log(`[V2.5 STRUCTURE] Lines reconstructed: ${allLines.length}`);
    console.log(`[V2.5 PREVIEW] First 20 lines:`, allLines.slice(0, 20));
    console.log(`[PDFExtractor] Extracted ${fullText.length} characters from ${pdf.numPages} pages`);
    
    return fullText;
  } catch (error) {
    console.error('[PDFExtractor] Failed to extract text from PDF:', error);
    throw new Error('Failed to extract text from PDF. Please ensure the file is a valid PDF.');
  }
}
