/**
 * Harness Work Instruction Generator — Upload Source
 * Phase HWI.0 — Scaffold Only
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    ok: true,
    module: 'harness-work-instructions',
    route: 'upload-source',
    status: 'scaffold'
  });
}
