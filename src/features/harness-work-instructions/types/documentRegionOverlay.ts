/**
 * Document Region Overlay Types — Phase 3H.35 / 3H.43.Y
 *
 * Defines the normalized bounding-box overlays used for AI + heuristic region debugging.
 * All coordinates are normalized 0–1 relative to the rendered page size.
 *
 * Phase 3H.43.Y additions:
 *   - RegionOrientation: spatial orientation of the region (HORIZONTAL/VERTICAL/UNKNOWN)
 *   - authority: explicit authority score separate from confidence
 *   - usedForField: which extracted fields were resolved from this region
 *   - normalizedText: text after vertical normalization, if applied
 */

export type RegionOverlayLabel =
  | 'REVISION'
  | 'PART_NUMBER'
  | 'DRAWING_NUMBER'
  | 'TITLE_BLOCK'
  | 'TABLE'
  | 'UNKNOWN';

export type RegionOverlaySource = 'OCR' | 'HEURISTIC' | 'AI';

/** Phase 3H.43.Y: Detected spatial orientation of a region. */
export type RegionOrientation = 'HORIZONTAL' | 'VERTICAL' | 'UNKNOWN';

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
  /** Raw OCR text captured from this region (first ~400 chars). */
  extractedText?: string;
  source: RegionOverlaySource;
  /** Phase 3H.43.Y: Spatial orientation of the region (heuristic from bounding box geometry). */
  orientation?: RegionOrientation;
  /**
   * Phase 3H.43.Y: Explicit authority score (0–1).
   * Higher than confidence — used to rank competing regions for field resolution.
   * A TITLE_BLOCK with anchor evidence should be 0.90+.
   */
  authority?: number;
  /** Phase 3H.43.Y: Which extracted fields were resolved using this region as the winning source. */
  usedForField?: Array<'REVISION' | 'PART_NUMBER' | 'DRAWING_NUMBER'>;
  /** Phase 3H.43.Y: Normalized text if vertical reinterpretation was applied to this region. */
  normalizedText?: string;
}
