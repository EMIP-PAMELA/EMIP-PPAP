/**
 * Harness Work Instruction Generator — List Approved Jobs
 * Phase HWI.5 — Approval Workflow + Persistence
 *
 * GET  /api/harness-instructions/list-jobs
 * GET  /api/harness-instructions/list-jobs?part_number=HA-12345-A
 *
 * Returns approved job history (descending by created_at) with artifact URLs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listApprovedJobs } from '@/src/features/harness-work-instructions/services/jobService';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partNumber = searchParams.get('part_number') ?? undefined;

  try {
    const jobs = await listApprovedJobs(partNumber);
    return NextResponse.json({ ok: true, jobs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[HWI list-jobs] Failed:', msg);
    return NextResponse.json(
      { ok: false, error: 'Failed to list jobs', details: msg },
      { status: 500 }
    );
  }
}
