/**
 * Phase 3H.16.1: In-App Classification Backfill Service
 * 
 * Provides controlled mechanism to reclassify existing BOM records
 * without requiring terminal access.
 * 
 * SAFETY: Should only be executed by admins in controlled environment
 */

import { createClient } from '@supabase/supabase-js';
import { classifyComponent, normalizeWireColor } from '@/src/core/projections/normalizers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface BackfillResult {
  success: boolean;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
  duration: number;
}

interface BOMRecord {
  id: number;
  component_part_number: string;
  description: string | null;
  color: string | null;
  rawColor: string | null;
  normalizedColor: string | null;
  category: string | null;
}

/**
 * Run classification backfill on existing BOM records
 * 
 * Phase 3H.16.1: Updates records with missing or UNKNOWN categories
 * and missing normalizedColor values.
 * 
 * @returns BackfillResult with statistics
 */
export async function runClassificationBackfill(): Promise<BackfillResult> {
  console.log('🔄 BACKFILL STARTED');
  const startTime = Date.now();
  const errors: string[] = [];
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    // Create Supabase client
    console.log('📡 Creating Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all BOM records
    console.log('📊 Fetching BOM records...');
    const { data: records, error: fetchError } = await supabase
      .from('bom_records')
      .select('id, component_part_number, description, color, rawColor, normalizedColor, category')
      .order('id');

    if (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      errors.push(`Fetch error: ${fetchError.message}`);
      return {
        success: false,
        updatedCount: 0,
        skippedCount: 0,
        errorCount: 1,
        errors,
        duration: Date.now() - startTime
      };
    }

    if (!records || records.length === 0) {
      console.log('ℹ️ No records found');
      return {
        success: true,
        updatedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
        duration: Date.now() - startTime
      };
    }

    // Process each record
    console.log(`📝 Processing ${records.length} records...`);
    for (const record of records) {
      try {
        // Determine if update is needed
        const needsColorUpdate = record.color && !record.normalizedColor;
        const needsCategoryUpdate = !record.category || record.category === 'UNKNOWN';

        if (!needsColorUpdate && !needsCategoryUpdate) {
          skippedCount++;
          continue;
        }

        const updates: Partial<BOMRecord> = {};

        // Backfill normalizedColor
        if (needsColorUpdate) {
          const rawColor = record.rawColor || record.color;
          const normalizedColor = normalizeWireColor(rawColor);
          updates.normalizedColor = normalizedColor;
          if (!record.rawColor) {
            updates.rawColor = rawColor; // Preserve raw color
          }
        }

        // Backfill category
        if (needsCategoryUpdate) {
          const category = classifyComponent(
            record.component_part_number,
            record.description
          );
          updates.category = category;
          console.log(`  ↳ Record ${record.id} (${record.component_part_number}): ${record.category || 'NULL'} → ${category}`);
        }

        // Apply update
        const { error: updateError } = await supabase
          .from('bom_records')
          .update(updates)
          .eq('id', record.id);

        if (updateError) {
          console.error(`❌ Update failed for record ${record.id}:`, updateError);
          errors.push(`Record ${record.id}: ${updateError.message}`);
          errorCount++;
        } else {
          updatedCount++;
          if (updatedCount % 50 === 0) {
            console.log(`  ✓ Updated ${updatedCount} records so far...`);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push(`Record ${record.id}: ${errorMsg}`);
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;
    
    console.log('✅ BACKFILL COMPLETE:', {
      updated: updatedCount,
      skipped: skippedCount,
      errors: errorCount,
      duration: `${duration}ms`
    });

    return {
      success: errorCount === 0,
      updatedCount,
      skippedCount,
      errorCount,
      errors: errors.slice(0, 10), // Limit to first 10 errors
      duration
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(`Fatal error: ${errorMsg}`);
    
    return {
      success: false,
      updatedCount,
      skippedCount,
      errorCount: errorCount + 1,
      errors,
      duration: Date.now() - startTime
    };
  }
}
