import * as pdfjsLib from 'pdfjs-dist';

// Use local worker from pdfjs-dist package instead of unreliable CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export const renderPdfToImage = async (url: string): Promise<string> => {
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
