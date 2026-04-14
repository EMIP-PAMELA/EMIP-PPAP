/**
 * Extract text from a specific normalized region of a PDF page.
 *
 * C12.2: Coordinate-filtered pdfjs text extraction — isolates the title block
 * text items by bounding box so scanForApogeePN45 can operate on a clean
 * subset instead of the full document text.
 *
 * Browser-only — uses pdfjs-dist text content API. Throws in SSR context.
 *
 * Coordinate systems:
 *   - Input  `region`: normalized, top-left origin, [0, 1] × [0, 1]
 *   - pdfjs  `transform[4/5]`: PDF user space, bottom-left origin, in points
 *   - Conversion: x_pdf = region.x * pageWidth; y_pdf_min = pageHeight * (1 - (region.y + region.h))
 *
 * @param file     PDF File object.
 * @param region   Normalized bounding box { x, y, w, h } matching overlay coords.
 * @param pageNum  1-indexed page number (default: 1).
 * @returns        Sorted text lines extracted from the given region.
 */
export async function extractPDFRegionText(
  file: File,
  region: { x: number; y: number; w: number; h: number },
  pageNum = 1,
): Promise<string[]> {
  if (typeof window === 'undefined') {
    throw new Error('[extractPDFRegionText] Browser context required');
  }

  const pdfjsLib = await import('pdfjs-dist');

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(pageNum);

  // page.view = [x0, y0, x1, y1] in PDF user units (usually points)
  const pageWidth  = page.view[2] - page.view[0];
  const pageHeight = page.view[3] - page.view[1];

  // Convert normalized top-left region to PDF bottom-left space
  const xMin = region.x * pageWidth;
  const xMax = (region.x + region.w) * pageWidth;
  const yMin = pageHeight * (1 - (region.y + region.h)); // bottom of region in PDF coords
  const yMax = pageHeight * (1 - region.y);              // top of region in PDF coords

  console.log('[C12.2 OCR CROP] region filter', {
    pageSize: `${pageWidth}×${pageHeight}pt`,
    xRange: `[${xMin.toFixed(0)}, ${xMax.toFixed(0)}]`,
    yRange: `[${yMin.toFixed(0)}, ${yMax.toFixed(0)}]`,
  });

  interface PdfjsTextItem {
    str:       string;
    transform: number[];
  }

  const content = await page.getTextContent();

  // Group items by rounded Y (bucket same-line items)
  const lineMap = new Map<number, Array<{ x: number; text: string }>>();

  for (const rawItem of content.items) {
    const item = rawItem as PdfjsTextItem;
    if (!item.str?.trim() || !item.transform) continue;

    const ix: number = item.transform[4];
    const iy: number = item.transform[5];

    if (ix < xMin || ix > xMax || iy < yMin || iy > yMax) continue;

    const bucket = Math.round(iy);
    if (!lineMap.has(bucket)) lineMap.set(bucket, []);
    lineMap.get(bucket)!.push({ x: ix, text: item.str });
  }

  // Sort descending by PDF Y (= top-to-bottom in screen space), then L→R within each line
  const sorted = Array.from(lineMap.keys()).sort((a, b) => b - a);
  const lines: string[] = [];

  for (const y of sorted) {
    const lineItems = lineMap.get(y)!.sort((a, b) => a.x - b.x);
    const lineText = lineItems.map(i => i.text).join(' ').trim();
    if (lineText) lines.push(lineText);
  }

  console.log('[C12.2 OCR CROP] extracted', {
    totalItems: content.items.length,
    regionLines: lines.length,
    preview: lines.slice(0, 5),
  });

  return lines;
}
