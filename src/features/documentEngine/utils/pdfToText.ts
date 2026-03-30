/**
 * PDF Text Extraction Utility
 * Phase V2.2: Next.js-compatible worker configuration
 * 
 * Client-side PDF text extraction using pdfjs-dist.
 * Provides pre-parser ingestion layer for PDF BOM files.
 * 
 * Architecture layer: Ingestion (preprocessing)
 * 
 * IMPORTANT: This must only run in browser context.
 * The worker is loaded using Next.js-compatible ?url import.
 */

import * as pdfjsLib from 'pdfjs-dist';

/**
 * Extract text content from a PDF file
 * 
 * @param file - PDF file to extract text from
 * @returns Extracted text content
 * @throws Error if PDF parsing fails or if executed outside browser
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  // V2.2: Ensure browser-only execution
  if (typeof window === 'undefined') {
    throw new Error('[PDFExtractor] Must run in browser context');
  }
  
  try {
    // V2.2: Next.js-compatible worker configuration
    // Use CDN worker for browser compatibility with Next.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    
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
