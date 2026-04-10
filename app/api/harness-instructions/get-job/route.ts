/**
 * Harness Work Instruction Generator — Get Job
 * Phase HWI.0 — Scaffold Only
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    module: 'harness-work-instructions',
    route: 'get-job',
    status: 'scaffold'
  });
}
