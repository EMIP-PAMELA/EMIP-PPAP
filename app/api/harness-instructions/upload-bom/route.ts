/**
 * Harness Work Instruction Generator — Upload BOM
 * Phase HWI.7 — Process-Aware BOM Ingestion
 *
 * POST body: { bomText: string, partNumber?: string, revision?: string }
 *
 * PDF text must be pre-extracted client-side (browser) using
 * extractTextFromPDF() from documentEngine/utils/pdfToText.ts.
 * pdfjs-dist is browser-only and cannot run server-side.
 *
 * Flow:
 *   1. Receive BOM text + optional metadata
 *   2. parseBOMToHWI() — parses operations/components, classifies, normalises
 *   3. Return HarnessInstructionJob ready for the HWI review UI
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    ok: false,
    error: 'DEPRECATED_ENDPOINT',
    message: 'Use /api/upload/bom (SKU-first ingestion path).',
  }, { status: 410 });
}
