/**
 * Harness Work Instruction Generator — Generate PDF
 * Phase HWI.4 — Puppeteer HTML → PDF
 *
 * POST body: { job: HarnessInstructionJob }
 * Response: application/pdf binary stream
 *
 * Falls back to mock data if no job is provided in the body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateInstructionPDF } from '@/src/features/harness-work-instructions/services/pdfService';
import { safeValidateInstruction } from '@/src/features/harness-work-instructions/services/instructionValidation';
import { MOCK_VALID_INSTRUCTION } from '@/src/features/harness-work-instructions/constants/mockInstruction';
import type { HarnessInstructionJob } from '@/src/features/harness-work-instructions/types/harnessInstruction.schema';

export async function POST(request: NextRequest) {
  let job: HarnessInstructionJob;

  try {
    const body = await request.json() as { job?: unknown };
    const candidate = body?.job ?? MOCK_VALID_INSTRUCTION;

    const validation = safeValidateInstruction(candidate);
    if (!validation.success) {
      return NextResponse.json(
        { ok: false, error: 'Job data failed schema validation', issues: validation.issues },
        { status: 400 }
      );
    }
    job = validation.data;
  } catch {
    job = MOCK_VALID_INSTRUCTION;
  }

  try {
    const { buffer, filename } = await generateInstructionPDF(job);

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[HWI PDF GENERATION ERROR]', errMsg);
    return NextResponse.json(
      { ok: false, error: 'PDF generation failed', details: errMsg },
      { status: 500 }
    );
  }
}
