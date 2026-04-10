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

import { NextRequest, NextResponse } from 'next/server';
import { parseBOMToHWI } from '@/src/core/services/bomHWIAdapter';

export async function POST(request: NextRequest) {
  let body: { bomText?: string; partNumber?: string; revision?: string; fileName?: string };

  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { bomText, partNumber, revision, fileName } = body ?? {};

  if (!bomText || bomText.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: 'bomText is required (extract text from PDF in the browser first)' },
      { status: 400 }
    );
  }

  console.log('[HWI upload-bom] Received BOM text', {
    textLength: bomText.length,
    partNumber: partNumber ?? 'not provided',
    revision:   revision   ?? 'not provided',
    fileName:   fileName   ?? 'not provided',
  });

  try {
    const job = await parseBOMToHWI(bomText, partNumber, revision);

    return NextResponse.json({ ok: true, job });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[HWI upload-bom] Parsing failed:', msg);
    return NextResponse.json(
      { ok: false, error: 'BOM parsing failed', details: msg },
      { status: 500 }
    );
  }
}
