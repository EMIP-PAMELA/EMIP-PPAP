#!/usr/bin/env ts-node
/*
 * Drawing Lookup Ingestion Script
 * -----------------------------------------
 * Reads a CSV file containing drawing mappings and upserts them into the
 * drawing_lookup table. Expected columns (case-insensitive):
 *   part_number, drawing_number, source, revision
 *
 * Usage:
 *   ts-node scripts/ingestDrawingLookup.ts ./data/drawing-lookup.csv
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

type CsvRow = Record<string, string>;

interface DrawingLookupPayload {
  part_number: string;
  drawing_number: string;
  source?: string | null;
  revision?: string | null;
}

const BATCH_SIZE = 500;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizePartNumber(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return null;
  if (/^NH\d{2}-\d{5,6}-\d{2,3}$/.test(trimmed)) {
    return trimmed;
  }
  const legacyMatch = trimmed.match(/^(\d{2})-(\d{5,6})-(\d{2,3})$/);
  if (legacyMatch) {
    return `NH${legacyMatch[1]}-${legacyMatch[2]}-${legacyMatch[3]}`;
  }
  return trimmed;
}

function normalizeDrawingNumber(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().toUpperCase();
  if (!cleaned) return null;
  if (/^\d{3}-\d{4}-\d{3}$/.test(cleaned)) {
    return cleaned;
  }
  const digits = cleaned.replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return cleaned;
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]).map(header => header.toLowerCase());
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    const record: CsvRow = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? '';
    });
    return record;
  });
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

async function ingest(filePath: string) {
  const csvPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  const fileContent = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(fileContent);
  if (rows.length === 0) {
    console.warn('No rows detected in CSV. Nothing to ingest.');
    return;
  }

  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) in environment.');
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const payloads: DrawingLookupPayload[] = [];
  for (const row of rows) {
    const partRaw = row.part_number ?? row.partnumber ?? row.part ?? row['part number'];
    const drawingRaw = row.drawing_number ?? row.drawingnumber ?? row.drawing ?? row['drawing number'];
    const partNumber = normalizePartNumber(partRaw);
    const drawingNumber = normalizeDrawingNumber(drawingRaw);
    if (!partNumber || !drawingNumber) {
      continue;
    }
    payloads.push({
      part_number: partNumber,
      drawing_number: drawingNumber,
      source: row.source ?? row.origin ?? 'csv',
      revision: row.revision ?? row.rev ?? null,
    });
  }

  console.log(`Preparing to upsert ${payloads.length} drawing entries…`);
  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const batch = payloads.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('drawing_lookup')
      .upsert(batch, { onConflict: 'part_number,drawing_number' });
    if (error) {
      console.error('Failed to upsert batch', { index: i, error: error.message });
      throw error;
    }
    console.log(`✓ Upserted batch ${i / BATCH_SIZE + 1} (${batch.length} records)`);
  }

  console.log('✅ Drawing lookup ingestion complete.');
}

const [, , inputPath] = process.argv;
if (!inputPath) {
  console.error('Usage: ts-node scripts/ingestDrawingLookup.ts <path-to-csv>');
  process.exit(1);
}

ingest(inputPath).catch(err => {
  console.error('Drawing lookup ingestion failed:', err);
  process.exit(1);
});
