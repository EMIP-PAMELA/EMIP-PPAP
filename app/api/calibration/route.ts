/**
 * V6.4.3: Wire Calibration API
 * 
 * Endpoints:
 * - GET: Fetch all calibration data
 * - POST: Save/update calibration for a specific gauge
 * 
 * Purpose: Enable UI to persist calibration values from 10 ft sample method
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/src/lib/supabaseClient';

/**
 * GET /api/calibration
 * Fetch all wire calibration data
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('wire_calibration')
      .select('*')
      .order('gauge', { ascending: true });

    if (error) {
      console.error('❌ [Calibration API] GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ [Calibration API] Retrieved calibrations', {
      count: data?.length || 0
    });

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error('❌ [Calibration API] GET exception:', err);
    return NextResponse.json(
      { error: 'Failed to fetch calibration data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calibration
 * Save or update calibration for a specific gauge
 * 
 * Body: { gauge: string, copper: number, gross: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { gauge, copper, gross } = body;

    // Validate inputs
    if (!gauge || typeof copper !== 'number' || typeof gross !== 'number') {
      return NextResponse.json(
        { error: 'Invalid input: gauge, copper, and gross are required' },
        { status: 400 }
      );
    }

    if (copper <= 0 || gross <= 0) {
      return NextResponse.json(
        { error: 'Copper and gross weights must be positive values' },
        { status: 400 }
      );
    }

    if (copper > gross) {
      return NextResponse.json(
        { error: 'Copper weight cannot exceed gross weight' },
        { status: 400 }
      );
    }

    // Upsert calibration data
    const { data, error } = await supabase
      .from('wire_calibration')
      .upsert(
        {
          gauge,
          copper_lbs_per_ft: copper,
          gross_lbs_per_ft: gross,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'gauge' }
      )
      .select();

    if (error) {
      console.error('❌ [Calibration API] POST error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ [Calibration API] Saved calibration', {
      gauge,
      copper,
      gross,
      insulation: gross - copper
    });

    return NextResponse.json({ 
      success: true, 
      data: data?.[0] || null 
    });
  } catch (err) {
    console.error('❌ [Calibration API] POST exception:', err);
    return NextResponse.json(
      { error: 'Failed to save calibration data' },
      { status: 500 }
    );
  }
}
