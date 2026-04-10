/**
 * Harness Work Instruction Generator — List Jobs
 * Phase HWI.0 — Scaffold Only
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    module: 'harness-work-instructions',
    route: 'list-jobs',
    status: 'scaffold'
  });
}
