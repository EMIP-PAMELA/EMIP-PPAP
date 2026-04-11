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

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    ok: false,
    error: 'DEPRECATED_ENDPOINT',
    message: 'Use /api/upload/drawing (SKU-first ingestion path).',
  }, { status: 410 });
}
