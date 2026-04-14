/**
 * Crop a rendered image data URL to a normalized region.
 *
 * C12.2: Used to isolate the title block region of a rendered PDF page for
 * targeted AI vision extraction when full-page OCR misses the part number.
 *
 * Browser-only — uses HTMLCanvasElement. Throws if called in SSR context.
 *
 * @param imageDataUrl  Full-page rendered image (data URL, PNG or JPEG).
 * @param region        Normalized bounding box { x, y, w, h } in [0, 1] range,
 *                      top-left origin (matches overlay coordinate system).
 * @returns             Cropped image as PNG data URL.
 */
export async function cropImageRegion(
  imageDataUrl: string,
  region: { x: number; y: number; w: number; h: number },
): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('[cropImageRegion] Browser context required');
  }

  return new Promise<string>((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;

      const px = Math.floor(region.x * w);
      const py = Math.floor(region.y * h);
      const pw = Math.floor(region.w * w);
      const ph = Math.floor(region.h * h);

      if (pw <= 0 || ph <= 0) {
        reject(new Error('[cropImageRegion] Crop dimensions are zero — check region coordinates'));
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width  = pw;
      canvas.height = ph;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('[cropImageRegion] Failed to get 2D canvas context'));
        return;
      }

      ctx.drawImage(img, px, py, pw, ph, 0, 0, pw, ph);

      console.log('[C12.2 CROP]', {
        imageSize:  `${w}×${h}`,
        regionNorm: region,
        cropPx:     `${px},${py} ${pw}×${ph}`,
      });

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new Error('[cropImageRegion] Failed to load image for cropping'));
    img.src = imageDataUrl;
  });
}
