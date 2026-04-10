/**
 * Harness Work Instruction Generator — Upload Drawing
 * Phase HWI.8 — Drawing Ingestion Foundation
 *
 * POST body: { drawingText: string, fileName?: string }
 *
 * PDF text must be pre-extracted client-side (browser) using
 * extractTextFromPDF() from documentEngine/utils/pdfToText.ts.
 * pdfjs-dist is browser-only and cannot run server-side.
 *
 * Flow:
 *   1. Receive drawing text + optional fileName
 *   2. ingestDrawingPdf() — classify, extract metadata, build draft
 *   3. Return CanonicalDrawingDraft
 */

import { NextRequest, NextResponse } from 'next/server';
import { ingestDrawingPdf } from '@/src/features/harness-work-instructions/services/drawingIngestionService';

export async function POST(request: NextRequest) {
  let body: { drawingText?: string; fileName?: string };

  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { drawingText, fileName } = body ?? {};

  if (!drawingText || drawingText.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: 'drawingText is required (extract text from PDF in the browser first)' },
      { status: 400 }
    );
  }

  console.log('[HWI upload-drawing] Received drawing text', {
    textLength: drawingText.length,
    fileName:   fileName ?? 'not provided',
  });

  try {
    const drawing = ingestDrawingPdf({ drawingText, fileName });
    return NextResponse.json({ ok: true, drawing });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[HWI upload-drawing] Ingestion failed:', msg);
    return NextResponse.json(
      { ok: false, error: 'Drawing ingestion failed', details: msg },
      { status: 500 }
    );
  }
}
