/**
 * IMPORTANT: Uses dynamic import to prevent SSR evaluation.
 * pdfjs-dist must only be loaded in browser runtime, never during build/SSR.
 */

export const renderPdfToImage = async (url: string): Promise<string> => {
  // V2.3: SSR safety check
  if (typeof window === 'undefined') {
    throw new Error('[renderPdfToImage] Cannot run on server - browser context required');
  }
  
  // Dynamic import ensures pdfjs is only loaded in browser, never during SSR
  const pdfjsLib = await import('pdfjs-dist');
  
  // V2.3: Use CDN worker for Next.js compatibility (avoid import.meta.url SSR issues)
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const loadingTask = pdfjsLib.getDocument(url);
  const pdf = await loadingTask.promise;

  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 2 });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Failed to get canvas context');
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise;

  return canvas.toDataURL('image/png');
};
