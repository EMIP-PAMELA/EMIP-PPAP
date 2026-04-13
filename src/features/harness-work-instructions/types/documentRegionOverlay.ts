/**
 * Document Region Overlay Types — Phase 3H.35
 *
 * Defines the normalized bounding-box overlays used for AI + heuristic region debugging.
 * All coordinates are normalized 0–1 relative to the rendered page size.
 */

export type RegionOverlayLabel =
  | 'REVISION'
  | 'PART_NUMBER'
  | 'DRAWING_NUMBER'
  | 'TITLE_BLOCK'
  | 'TABLE'
  | 'UNKNOWN';

export type RegionOverlaySource = 'OCR' | 'HEURISTIC' | 'AI';

export interface RegionBoundingBox {
  /** Normalized X coordinate of the top-left corner (0–1). */
  x: number;
  /** Normalized Y coordinate of the top-left corner (0–1). */
  y: number;
  /** Normalized width (0–1). */
  width: number;
  /** Normalized height (0–1). */
  height: number;
}

export interface RegionOverlay {
  id: string;
  label: RegionOverlayLabel;
  boundingBox: RegionBoundingBox;
  confidence: number;
  extractedText?: string;
  source: RegionOverlaySource;
}
