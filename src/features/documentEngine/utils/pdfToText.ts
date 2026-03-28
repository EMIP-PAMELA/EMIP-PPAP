/**
 * PDF Text Extraction Utility
 * 
 * Client-side PDF text extraction using pdfjs-dist.
 * Provides pre-parser ingestion layer for PDF BOM files.
 * 
 * Architecture layer: Ingestion (preprocessing)
 * 
 * IMPORTANT: Uses dynamic import to prevent SSR evaluation.
 * pdfjs-dist must only be loaded in browser runtime, never during build/SSR.
 */

/**
 * Extract text content from a PDF file
 * 
 * @param file - PDF file to extract text from
 * @returns Extracted text content
 * @throws Error if PDF parsing fails
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    // Dynamic import ensures pdfjs is only loaded in browser, never during SSR
    const pdfjsLib = await import('pdfjs-dist');
    
    // Configure worker source for pdfjs
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
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
