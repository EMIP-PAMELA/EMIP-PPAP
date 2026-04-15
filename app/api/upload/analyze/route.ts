/**
 * POST /api/upload/analyze
 * Phase 3H.31 — Analyze-only endpoint (STEP 2 PHASE A).
 *
 * Runs full extraction and classification analysis WITHOUT writing to the database.
 * Returns an IngestionAnalysisResult with proposed values, confidence scores,
 * extraction evidence, and any unresolved questions that block commit.
 *
 * Callers: UploadWorkbench (admin batch mode).
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeFileIngestion } from '@/src/features/harness-work-instructions/services/analyzeIngestion';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file');
  const extractedTextField    = formData.get('extracted_text');
  const partNumberHint        = formData.get('part_number_hint');
  const revisionHint          = formData.get('revision_hint');
  const regionTextField       = formData.get('title_block_region_text');
  const cropDataUrlField      = formData.get('title_block_crop');
  const fallbackRegionField   = formData.get('title_block_fallback_region_text');
  const fallbackCropField     = formData.get('title_block_fallback_crop');

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 });
  }

  const extractedText = typeof extractedTextField === 'string' && extractedTextField.trim().length > 0
    ? extractedTextField.trim()
    : null;

  // C12.2: coordinate-filtered region text lines (JSON array from browser pdfjs extraction)
  let titleBlockRegionLines: string[] | null = null;
  if (typeof regionTextField === 'string' && regionTextField.trim().length > 0) {
    try {
      const parsed = JSON.parse(regionTextField);
      if (Array.isArray(parsed)) titleBlockRegionLines = parsed as string[];
    } catch { /* ignore malformed */ }
  }

  // C12.2: base64 PNG data URL of cropped title block image (browser-rendered)
  const titleBlockCropDataUrl = typeof cropDataUrlField === 'string' && cropDataUrlField.startsWith('data:')
    ? cropDataUrlField
    : null;

  // C12.4: fallback region lines (bottom 25%, right 50%) — sent when primary OCR missed the DRN
  let titleBlockFallbackLines: string[] | null = null;
  if (typeof fallbackRegionField === 'string' && fallbackRegionField.trim().length > 0) {
    try {
      const parsed = JSON.parse(fallbackRegionField);
      if (Array.isArray(parsed)) titleBlockFallbackLines = parsed as string[];
    } catch { /* ignore malformed */ }
  }

  // C12.4: base64 PNG data URL of fallback region crop (browser-rendered)
  const titleBlockFallbackCrop = typeof fallbackCropField === 'string' && fallbackCropField.startsWith('data:')
    ? fallbackCropField
    : null;

  console.log('[C12.4 DEBUG] Received fallback OCR lines:', titleBlockFallbackLines?.length);
  console.log('[C12.4 DEBUG] Received fallback crop:', !!titleBlockFallbackCrop);

  try {
    console.log('🔥🔥🔥 ROUTE: BEFORE INGESTION CALL 🔥🔥🔥');
    console.log('🔥 INGESTION FUNCTION NAME:', analyzeFileIngestion?.name);
    console.log('🔥 INGESTION FUNCTION SOURCE:', analyzeFileIngestion?.toString?.().slice(0, 200));

    const analysis = await analyzeFileIngestion({
      fileName: file.name,
      fileSize: file.size,
      normalizedText: extractedText,
      partNumberHint:         typeof partNumberHint === 'string' ? partNumberHint : null,
      revisionHint:           typeof revisionHint   === 'string' ? revisionHint   : null,
      titleBlockRegionLines,
      titleBlockCropDataUrl,
      titleBlockFallbackLines,
      titleBlockFallbackCrop,
    });

    console.log('🔥🔥🔥 ROUTE: AFTER INGESTION CALL 🔥🔥🔥');

    return NextResponse.json({ ok: true, analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed';
    console.error('[ANALYZE ENDPOINT ERROR]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
