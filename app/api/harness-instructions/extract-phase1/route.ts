/**
 * Harness Work Instruction Generator — AI Extraction (Phase 1)
 * Phase HWI.1 — Validation integrated (mock data path)
 *
 * AI extraction is NOT implemented yet (HWI.2).
 * Currently validates mock data to confirm schema enforcement is live.
 */

import { NextResponse } from 'next/server';
import { safeValidateInstruction } from '@/src/features/harness-work-instructions/services/instructionValidation';
import { MOCK_VALID_INSTRUCTION } from '@/src/features/harness-work-instructions/constants/mockInstruction';

export async function POST() {
  const validation = safeValidateInstruction(MOCK_VALID_INSTRUCTION);

  if (!validation.success) {
    console.error('[extract-phase1] Mock data failed schema validation:', validation.error);
    return NextResponse.json(
      {
        ok: false,
        module: 'harness-work-instructions',
        route: 'extract-phase1',
        error: 'Schema validation failed on mock data',
        issues: validation.issues,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    module: 'harness-work-instructions',
    route: 'extract-phase1',
    status: 'scaffold',
    validation: 'passed',
    data: validation.data,
  });
}
