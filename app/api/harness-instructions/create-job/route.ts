/**
 * Harness Work Instruction Generator — Create Job
 * Phase HWI.0 — Scaffold Only
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    ok: true,
    module: 'harness-work-instructions',
    route: 'create-job',
    status: 'scaffold'
  });
}
