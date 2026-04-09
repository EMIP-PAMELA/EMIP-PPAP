/**
 * Phase 3H.16.1: Backfill API Route
 * 
 * Provides secure endpoint for running classification backfill
 * 
 * POST /api/admin/backfill
 */

import { NextRequest, NextResponse } from 'next/server';
import { runClassificationBackfill } from '@/src/core/services/backfillService';

/**
 * Phase 3H.16.2: GET health check
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'OK',
    endpoint: '/api/admin/backfill',
    methods: ['GET', 'POST']
  });
}

/**
 * Phase 3H.16.2: POST backfill execution
 */
export async function POST(request: NextRequest) {
  try {
    // Phase 3H.16.2: Environment check with override
    const isDev = process.env.NODE_ENV !== 'production';
    const adminEnabled = process.env.ENABLE_ADMIN === 'true';
    
    if (!isDev && !adminEnabled) {
      console.warn('⚠️ Backfill blocked: Not in development and ENABLE_ADMIN not set');
      return NextResponse.json(
        { error: 'Backfill not allowed in production without admin authentication' },
        { status: 403 }
      );
    }

    console.log('🔄 Starting classification backfill...');
    
    const result = await runClassificationBackfill();
    
    console.log('✅ Backfill complete:', {
      updated: result.updatedCount,
      skipped: result.skippedCount,
      errors: result.errorCount,
      duration: `${result.duration}ms`
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Backfill error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        updatedCount: 0,
        skippedCount: 0,
        errorCount: 1
      },
      { status: 500 }
    );
  }
}
