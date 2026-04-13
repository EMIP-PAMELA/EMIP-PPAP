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
  const extractedTextField = formData.get('extracted_text');
  const partNumberHint = formData.get('part_number_hint');
  const revisionHint = formData.get('revision_hint');

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 });
  }

  const extractedText = typeof extractedTextField === 'string' && extractedTextField.trim().length > 0
    ? extractedTextField.trim()
    : null;

  try {
    const analysis = await analyzeFileIngestion({
      fileName: file.name,
      fileSize: file.size,
      normalizedText: extractedText,
      partNumberHint: typeof partNumberHint === 'string' ? partNumberHint : null,
      revisionHint:   typeof revisionHint   === 'string' ? revisionHint   : null,
    });

    return NextResponse.json({ ok: true, analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed';
    console.error('[ANALYZE ENDPOINT ERROR]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
