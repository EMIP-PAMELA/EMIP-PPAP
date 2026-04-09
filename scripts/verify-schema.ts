/**
 * Phase 3H.16.8: Database Schema Verification Utility
 * 
 * This script connects to Supabase and verifies that the database schema
 * matches the expected schema defined in bomSchema.ts
 * 
 * Run with: npx ts-node scripts/verify-schema.ts
 */

// Phase 3H.16.9: Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local from project root
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

// Environment variables should be set before running this script
// For local development: source .env.local first
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables!');
  console.error('Required:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  console.error('\nMake sure .env.local is configured correctly.');
  process.exit(1);
}

// Expected schema based on bomSchema.ts
const EXPECTED_COLUMNS = [
  'id',
  'parent_part_number',
  'component_part_number',
  'description',
  'quantity',
  'unit',
  'length',
  'gauge',
  'color',
  'rawcolor',              // May or may not exist
  'normalizedcolor',       // CRITICAL - must exist (lowercase)
  'category',              // CRITICAL - must exist
  'operation_step',
  'revision',
  'revision_order',
  'is_active',
  'ingestion_batch_id',
  'version_number',
  'source_reference',
  'created_at',
  'updated_at',
  'artifact_url',
  'artifact_path',
];

const CRITICAL_COLUMNS = [
  'normalizedcolor',  // Phase 3H.16.5: Must be lowercase
  'category',         // Phase 3H.16: Must exist
];

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

async function verifyDatabaseSchema() {
  console.log('🔍 Phase 3H.16.8: Database Schema Verification\n');
  console.log('=' .repeat(80));
  
  try {
    const supabase = createClient(supabaseUrl!, supabaseKey!);
    
    // Step 1: Query actual database schema
    console.log('\n📊 STEP 1: Querying live database schema...\n');
    
    const { data: columns, error } = await supabase
      .rpc('get_table_columns', { table_name: 'bom_records' })
      .select('*');
    
    // If RPC doesn't exist, try direct query
    if (error) {
      console.log('⚠️  RPC function not available, attempting direct query...\n');
      
      // Query a sample record to see what fields exist
      const { data: sampleRecords, error: sampleError } = await supabase
        .from('bom_records')
        .select('*')
        .limit(1);
      
      if (sampleError) {
        console.error('❌ Error fetching sample record:', sampleError);
        throw sampleError;
      }
      
      if (!sampleRecords || sampleRecords.length === 0) {
        console.log('⚠️  No records found in bom_records table');
        console.log('ℹ️  Cannot verify schema without existing records\n');
        return;
      }
      
      const sampleRecord = sampleRecords[0];
      const actualColumns = Object.keys(sampleRecord).sort();
      
      console.log('📋 Detected columns from sample record:\n');
      actualColumns.forEach((col, idx) => {
        const value = sampleRecord[col];
        const type = value === null ? 'null' : typeof value;
        console.log(`  ${(idx + 1).toString().padStart(2)}. ${col.padEnd(25)} (type: ${type})`);
      });
      
      // Step 2: Compare against expected schema
      console.log('\n' + '='.repeat(80));
      console.log('📊 STEP 2: Schema Comparison\n');
      
      const missingCritical: string[] = [];
      const missingOptional: string[] = [];
      const extraColumns: string[] = [];
      
      // Check for missing columns
      EXPECTED_COLUMNS.forEach(expected => {
        if (!actualColumns.includes(expected)) {
          if (CRITICAL_COLUMNS.includes(expected)) {
            missingCritical.push(expected);
          } else {
            missingOptional.push(expected);
          }
        }
      });
      
      // Check for extra columns
      actualColumns.forEach(actual => {
        if (!EXPECTED_COLUMNS.includes(actual)) {
          extraColumns.push(actual);
        }
      });
      
      // Report findings
      if (missingCritical.length > 0) {
        console.log('❌ CRITICAL COLUMNS MISSING:\n');
        missingCritical.forEach(col => {
          console.log(`  ⚠️  ${col}`);
        });
        console.log('');
      }
      
      if (missingOptional.length > 0) {
        console.log('⚠️  Optional columns missing:\n');
        missingOptional.forEach(col => {
          console.log(`  ℹ️  ${col}`);
        });
        console.log('');
      }
      
      if (extraColumns.length > 0) {
        console.log('ℹ️  Extra columns (not in schema):\n');
        extraColumns.forEach(col => {
          console.log(`  ➕ ${col}`);
        });
        console.log('');
      }
      
      // Step 3: Critical field verification
      console.log('='.repeat(80));
      console.log('📊 STEP 3: Critical Field Verification\n');
      
      const hasNormalizedcolor = actualColumns.includes('normalizedcolor');
      const hasCategory = actualColumns.includes('category');
      
      console.log(`  normalizedcolor: ${hasNormalizedcolor ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log(`  category:        ${hasCategory ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log('');
      
      // Sample data inspection
      console.log('='.repeat(80));
      console.log('📊 STEP 4: Sample Data Inspection\n');
      console.log('Sample record fields and values:\n');
      console.log(JSON.stringify(sampleRecord, null, 2));
      console.log('');
      
      // Step 5: Generate migration SQL if needed
      if (missingCritical.length > 0) {
        console.log('='.repeat(80));
        console.log('🔧 STEP 5: Required Migrations\n');
        console.log('Execute the following SQL in Supabase SQL Editor:\n');
        console.log('-- Phase 3H.16.8: Add missing critical columns\n');
        
        missingCritical.forEach(col => {
          console.log(`ALTER TABLE bom_records ADD COLUMN IF NOT EXISTS ${col} TEXT;`);
        });
        console.log('');
      }
      
      // Final summary
      console.log('='.repeat(80));
      console.log('📊 SUMMARY\n');
      
      if (missingCritical.length === 0 && hasNormalizedcolor && hasCategory) {
        console.log('✅ Schema verification PASSED');
        console.log('✅ All critical columns exist');
        console.log('✅ Ready for backfill execution\n');
      } else {
        console.log('❌ Schema verification FAILED');
        console.log(`❌ Missing ${missingCritical.length} critical column(s)`);
        console.log('⚠️  Please run migration SQL above before executing backfill\n');
      }
      
    } else {
      console.log('✅ Retrieved schema via RPC\n');
      console.log(JSON.stringify(columns, null, 2));
    }
    
  } catch (err) {
    console.error('❌ Schema verification error:', err);
    throw err;
  }
}

// Run verification
verifyDatabaseSchema()
  .then(() => {
    console.log('🏁 Schema verification complete\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Schema verification failed:', err);
    process.exit(1);
  });
