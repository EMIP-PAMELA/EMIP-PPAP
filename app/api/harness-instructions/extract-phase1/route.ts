/**
 * Harness Work Instruction Generator — AI Extraction (Phase 1)
 * Phase HWI.2 — Full AI extraction + validation-aware reconciliation pipeline
 *
 * Pipeline:
 *   1. Parse request (jobId, partNumber, revision, rawBomText, drawingNotes)
 *   2. Call runPhase1Extraction() → rawData + preFlags (AI-level errors)
 *   3. Call validateAndMapErrors() → valid job + validation flags
 *   4. Merge all flags into job.engineering_flags
 *   5. Always return { data: HarnessInstructionJob, flags: EngineeringFlag[] }
 *
 * Never throws unhandled exceptions — all errors surface as engineering_flags.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runPhase1Extraction } from '@/src/features/harness-work-instructions/services/instructionAI';
import { validateAndMapErrors } from '@/src/features/harness-work-instructions/services/instructionValidation';
import { buildFlag } from '@/src/features/harness-work-instructions/utils/validationMapper';
import { MOCK_VALID_INSTRUCTION } from '@/src/features/harness-work-instructions/constants/mockInstruction';

const DEFAULT_JOB_ID = 'hwi-phase1-draft';

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const jobId = typeof body.jobId === 'string' && body.jobId.trim()
    ? body.jobId.trim()
    : DEFAULT_JOB_ID;

  const partNumber = typeof body.partNumber === 'string' && body.partNumber.trim()
    ? body.partNumber.trim()
    : MOCK_VALID_INSTRUCTION.metadata.part_number;

  const revision = typeof body.revision === 'string' && body.revision.trim()
    ? body.revision.trim()
    : MOCK_VALID_INSTRUCTION.metadata.revision;

  const rawBomText = typeof body.rawBomText === 'string' ? body.rawBomText : undefined;
  const drawingNotes = typeof body.drawingNotes === 'string' ? body.drawingNotes : undefined;

  const fallback = { id: jobId, partNumber, revision };

  // ---------------------------------------------------------------------------
  // Step 1: AI extraction
  // ---------------------------------------------------------------------------

  let rawData: unknown;
  let preFlags;

  try {
    const result = await runPhase1Extraction({
      jobId,
      partNumber,
      revision,
      rawBomText,
      drawingNotes,
    });
    rawData = result.rawData;
    preFlags = result.preFlags;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[extract-phase1] runPhase1Extraction threw unexpectedly:', errMsg);
    rawData = null;
    preFlags = [
      buildFlag('AI_UNEXPECTED_ERROR', `Unexpected AI extraction error: ${errMsg}`, {
        flag_type: 'error',
      }),
    ];
  }

  // ---------------------------------------------------------------------------
  // Step 2: If AI returned nothing, use mock as safe fallback with AI_FAILURE flag
  // ---------------------------------------------------------------------------

  const effectiveData = rawData ?? MOCK_VALID_INSTRUCTION;

  // ---------------------------------------------------------------------------
  // Step 3: Schema validation + error → flag mapping
  // ---------------------------------------------------------------------------

  const { job, flags: validationFlags } = validateAndMapErrors(effectiveData, fallback);

  // ---------------------------------------------------------------------------
  // Step 4: Merge all flags (preFlags + validation flags) into job
  // ---------------------------------------------------------------------------

  const allFlags = [...preFlags, ...validationFlags];

  if (rawData === null) {
    allFlags.unshift(
      buildFlag('AI_FALLBACK_USED', 'AI returned no data — mock fallback used for review', {
        flag_type: 'warning',
      })
    );
  }

  const mergedJob = {
    ...job,
    engineering_flags: [...job.engineering_flags, ...allFlags],
  };

  console.log('[HWI VALIDATION RESULT]', {
    jobId,
    totalFlags: mergedJob.engineering_flags.length,
    validationFlags: validationFlags.length,
    preFlags: preFlags.length,
  });

  // ---------------------------------------------------------------------------
  // Step 5: Return always-valid structured response
  // ---------------------------------------------------------------------------

  return NextResponse.json({
    ok: true,
    data: mergedJob,
    flags: allFlags,
  });
}
