/**
 * PDF Text Extraction Utility
 * Phase V2.4: Local worker for stability (no CDN dependency)
 * 
 * Client-side PDF text extraction using pdfjs-dist.
 * Provides pre-parser ingestion layer for PDF BOM files.
 * 
 * Architecture layer: Ingestion (preprocessing)
 * 
 * IMPORTANT: This must only run in browser context.
 * All pdfjs imports are dynamic to prevent SSR DOMMatrix errors.
 * Worker is loaded from local bundle, not CDN.
 */

/**
 * Extract text content from a PDF file
 * 
 * @param file - PDF file to extract text from
 * @returns Extracted text content
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

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      const pageText = content.items
        .map((item: any) => item.str)
        .join(' ');

      fullText += pageText + '\n';
    }

    console.log(`[PDFExtractor] Extracted ${fullText.length} characters from ${pdf.numPages} pages`);
    return fullText;
  } catch (error) {
    console.error('[PDFExtractor] Failed to extract text from PDF:', error);
    throw new Error('Failed to extract text from PDF. Please ensure the file is a valid PDF.');
  }
}
