/**
 * Harness Work Instruction Generator — Approve Job
 * Phase HWI.5 — Approval Workflow + Persistence
 *
 * POST body: { job: HarnessInstructionJob, approvedBy?: string }
 *
 * Flow:
 *   1. Validate job schema
 *   2. Gate: reject if unresolved non-info flags remain
 *   3. Generate PDF via Puppeteer
 *   4. Save job + upload PDF artifact to Supabase
 *   5. Return { ok, jobId, version, artifactUrl, approvedAt }
 *
 * After success the UI must lock all editing. Immutability is enforced here
 * by writing only to the approved jobs table — the source data is never
 * mutated by subsequent requests.
 */

import { NextRequest, NextResponse } from 'next/server';
import { safeValidateInstruction } from '@/src/features/harness-work-instructions/services/instructionValidation';
import { generateInstructionPDF } from '@/src/features/harness-work-instructions/services/pdfService';
import { saveApprovedJob } from '@/src/features/harness-work-instructions/services/jobService';
import { learnPatternsFromApprovedJob } from '@/src/core/services/patternLearningService';
import { learnFromApprovedJob } from '@/src/features/harness-work-instructions/services/learningService';

export async function POST(request: NextRequest) {
  let body: { job?: unknown; approvedBy?: string };
  try {
    body = await request.json() as { job?: unknown; approvedBy?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  // 1. Schema validation
  const validation = safeValidateInstruction(body?.job);
  if (!validation.success) {
    return NextResponse.json(
      { ok: false, error: 'Job data failed validation', issues: validation.issues },
      { status: 400 }
    );
  }
  const job = validation.data;

  // 2. Block approval if unresolved non-info flags remain (server-side gate)
  const unresolved = job.engineering_flags.filter(
    f => !f.resolved && f.flag_type !== 'info'
  );
  if (unresolved.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `Cannot approve: ${unresolved.length} unresolved flag(s) remain`,
        unresolved: unresolved.map(f => ({ id: f.flag_id, message: f.message })),
      },
      { status: 422 }
    );
  }

  // 3. Generate PDF
  let pdfBuffer: Buffer;
  try {
    const result = await generateInstructionPDF(job);
    pdfBuffer = result.buffer;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[HWI approve-job] PDF generation failed:', msg);
    return NextResponse.json(
      { ok: false, error: 'PDF generation failed', details: msg },
      { status: 500 }
    );
  }

  // 4. Persist: save job + upload artifact
  try {
    const approvedBy = body?.approvedBy ?? 'system';
    const result = await saveApprovedJob(job, pdfBuffer, approvedBy);

    // Pattern learning — fire-and-forget, never fails the approval response
    learnPatternsFromApprovedJob(job).catch((err: Error) =>
      console.error('[HWI approve-job] Pattern learning failed (non-fatal):', err.message)
    );

    // Resolution memory learning — fire-and-forget
    learnFromApprovedJob(job).catch((err: Error) =>
      console.error('[HWI approve-job] Resolution learning failed (non-fatal):', err.message)
    );

    return NextResponse.json({
      ok:          true,
      jobId:       result.jobId,
      version:     result.version,
      artifactUrl: result.artifactUrl,
      approvedAt:  result.approvedAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[HWI approve-job] Persistence failed:', msg);
    return NextResponse.json(
      { ok: false, error: 'Approval persistence failed', details: msg },
      { status: 500 }
    );
  }
}
