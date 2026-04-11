/**
 * Phase 3H.15.6: Database Backfill Script
 * 
 * Backfills normalizedColor and category for existing BOM records
 * that were created before Phase 3H.14.1/3H.14.2
 * 
 * USAGE:
 * npx ts-node scripts/backfill-normalization.ts
 */

import { normalizeWireColor } from '@/src/core/projections/normalizers';
import { resolveClassification } from '@/src/core/services/classificationLookup';
import { getSupabaseServer } from '@/src/lib/supabaseServer';

interface BOMRecord {
  id: number;
  component_part_number: string;
  description: string | null;
  color: string | null;
  rawColor: string | null;
  normalizedColor: string | null;
  category: string | null;
}

async function backfillNormalization() {
  const supabase = getSupabaseServer();
  console.log('🔄 Phase 3H.16: Starting normalization and classification backfill...\n');

  // Fetch all BOM records
  const { data: records, error } = await supabase
    .from('bom_records')
    .select('id, component_part_number, description, color, rawColor, normalizedColor, category')
    .order('id');

  if (error) {
    console.error('❌ Error fetching records:', error);
    return;
  }

  if (!records || records.length === 0) {
    console.log('ℹ️ No records found.');
    return;
  }

  console.log(`📊 Found ${records.length} records to process.\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const record of records) {
    try {
      // Determine if update is needed
      const needsColorUpdate = record.color && !record.normalizedColor;
      // Phase 3H.16: Re-classify UNKNOWN records with enhanced logic
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
        updates.rawColor = rawColor; // Ensure rawColor is preserved
      }

      // Backfill category
      if (needsCategoryUpdate) {
        const resolution = await resolveClassification(
          record.component_part_number,
          record.description
        );
        updates.category = resolution.category;
      }

      // Apply update
      const { error: updateError } = await supabase
        .from('bom_records')
        .update(updates)
        .eq('id', record.id);

      if (updateError) {
        console.error(`❌ Error updating record ${record.id}:`, updateError);
        errorCount++;
      } else {
        updatedCount++;
        if (updatedCount % 100 === 0) {
          console.log(`✓ Updated ${updatedCount} records...`);
        }
      }
    } catch (err) {
      console.error(`❌ Exception processing record ${record.id}:`, err);
      errorCount++;
    }
  }

  console.log('\n📈 Backfill Summary:');
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total: ${records.length}\n`);

  if (errorCount === 0) {
    console.log('✅ Backfill completed successfully!');
  } else {
    console.log('⚠️ Backfill completed with errors. Review logs above.');
  }
}

// Run backfill
backfillNormalization()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
  });
