/**
 * Phase 3H.16.1: Backfill API Route
 * 
 * Provides secure endpoint for running classification backfill
 * 
 * POST /api/admin/backfill
 */

import { NextRequest, NextResponse } from 'next/server';
import { runClassificationBackfill } from '@/src/core/services/backfillService';

export async function POST(request: NextRequest) {
  try {
    // Phase 3H.16.1: Safety check - only allow in development
    // TODO: Replace with proper admin authentication in production
    if (process.env.NODE_ENV === 'production') {
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
