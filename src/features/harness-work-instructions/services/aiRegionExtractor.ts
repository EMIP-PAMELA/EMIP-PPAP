/**
 * AI Region Extractor — Phase 3H.35
 *
 * Non-persistent, read-only layer that requests a vision model to highlight
 * key document regions (revision block, part number, drawing number, tables).
 *
 * This module is intentionally isolated so the rest of the ingestion pipeline
 * can gracefully degrade when the AI is unavailable. Callers MUST handle
 * failures by falling back to heuristic-only regions.
 */

import type { RegionOverlay } from '../types/documentRegionOverlay';

export interface AIRegionExtractorParams {
  /**
   * Rendered page snapshot (PNG/JPEG data URL or array buffer). Optional for now
   * because the bridge to the canvas renderer may not exist yet.
   */
  pageImage?: ArrayBuffer | Uint8Array | string | null;
  /** Optional textual summary to provide the model with context. */
  textualHint?: string | null;
}

/**
 * Calls an external vision model to detect regions. Currently a placeholder that
 * returns an empty array so the UI can be wired before the model is provisioned.
 */
export async function extractRegionsWithAI(_: AIRegionExtractorParams): Promise<RegionOverlay[]> {
  try {
    // TODO: Wire in OpenAI/Anthropic vision call once credentials + proxy are approved.
    // Prompt sketch (see Phase spec): identify revision, part number, drawing number,
    // title block, connector / table regions. Return normalized bounding boxes 0–1.
    return [];
  } catch (err) {
    console.warn('[AI REGION EXTRACTOR] Vision model unavailable, falling back to heuristics.', err);
    return [];
  }
}
