#!/usr/bin/env ts-node
/*
 * Utility: importDrawingDatabase
 * -----------------------------------------
 * Reads a simple JSON export of the drawing database and emits a TypeScript
 * map compatible with src/core/data/drawingLookup.ts. Excel-to-JSON
 * conversion must happen upstream (e.g., export the worksheet to JSON or CSV
 * first). This keeps the runtime deterministic and avoids bundling large
 * binary parsers.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface DrawingRecord {
  drawingNumber: string;
  partNumber: string;
}

function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath) {
    console.error('Usage: ts-node scripts/importDrawingDatabase.ts <input.json> [output.ts]');
    console.error('NOTE: convert the Excel sheet to JSON first (columns: drawingNumber, partNumber).');
    process.exit(1);
  }

  const resolvedInput = resolve(process.cwd(), inputPath);
  const resolvedOutput = resolve(
    process.cwd(),
    outputPath ?? 'src/core/data/drawingLookup.ts',
  );

  const raw = readFileSync(resolvedInput, 'utf8');
  let rows: DrawingRecord[] = [];
  try {
    rows = JSON.parse(raw) as DrawingRecord[];
  } catch (err) {
    console.error('Input file must be valid JSON array. Received error:', err);
    process.exit(1);
  }

  const entries = rows
    .filter(row => row.drawingNumber && row.partNumber)
    .map(row => `  "${row.drawingNumber.trim().toUpperCase()}": "${row.partNumber.trim().toUpperCase()}",`)
    .join('\n');

  const fileContents = `export const DRAWING_LOOKUP: Record<string, string> = {\n${entries}\n};\n`;
  writeFileSync(resolvedOutput, fileContents);

  console.log(`✅ Drawing lookup written to ${resolvedOutput}`);
  console.log(`   Total records: ${rows.length}`);
}

main();
