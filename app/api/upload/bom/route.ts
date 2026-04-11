import { NextRequest, NextResponse } from 'next/server';
import { ingestDocumentFirstFlow, type DocumentMetadata } from '@/src/features/harness-work-instructions/services/skuService';

function derivePartNumberFromBOMText(text: string): string | null {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const pnPatterns = [
    /\b(\d{3}-\d{4,5}-\d{3,4}[A-Z]?)\b/i,
    /\b([A-Z]{2,4}-\d{4,6}(?:-[A-Z0-9]{1,5})?)\b/,
    /part\s*(?:number|no\.?|#)[:\s]+([A-Z0-9][A-Z0-9\-]{4,})/i,
  ];
  for (const line of lines.slice(0, 40)) {
    for (const pattern of pnPatterns) {
      const m = line.match(pattern);
      if (m) return m[1].trim().toUpperCase();
    }
  }
  return null;
}

function deriveRevisionFromBOMText(text: string): string | null {
  const m = text.match(/\bREV(?:ISION)?[:\s.]*([A-Z0-9]{1,4})\b/i);
  return m ? m[1].toUpperCase() : null;
}

function deriveDescriptionFromBOMText(text: string): string | null {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const titleRe = /WIRE\s+HARNESS|HARNESS\s+ASSY|CABLE\s+ASSY|WIRING\s+ASSEMBLY/i;
  for (const line of lines.slice(0, 60)) {
    if (titleRe.test(line) && line.length < 150) {
      return line.replace(/\s+/g, ' ').trim();
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file');
  const extractedTextField = formData.get('extracted_text');
  const manualPartNumber = formData.get('part_number');
  const manualRevision = formData.get('revision');

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 });
  }

  const extractedText = typeof extractedTextField === 'string' ? extractedTextField : undefined;

  let partNumber: string | null =
    typeof manualPartNumber === 'string' && manualPartNumber.trim() ? manualPartNumber.trim().toUpperCase() : null;

  let revision: string | null =
    typeof manualRevision === 'string' && manualRevision.trim() ? manualRevision.trim() : null;

  if (extractedText && !partNumber) {
    partNumber = derivePartNumberFromBOMText(extractedText);
  }
  if (extractedText && !revision) {
    revision = deriveRevisionFromBOMText(extractedText);
  }

  const description = extractedText ? deriveDescriptionFromBOMText(extractedText) : null;

  if (!partNumber) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Could not derive part number from BOM. Please enter it manually.',
        needs_manual_part_number: true,
      },
      { status: 422 },
    );
  }

  const meta: DocumentMetadata = {
    part_number: partNumber,
    revision,
    description,
    sourceType: 'BOM',
  };

  try {
    const result = await ingestDocumentFirstFlow(meta, file, extractedText);
    return NextResponse.json({
      ok: true,
      sku: { id: result.sku.id, part_number: result.sku.part_number },
      sku_created: result.skuCreated,
      header_updated: result.headerUpdated,
      status: result.uploadResult.status,
      phantom_rev: result.uploadResult.phantom_rev,
      message: result.uploadResult.message,
      diff_summary: result.uploadResult.diff_summary ?? null,
      document: result.uploadResult.document,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'BOM ingest failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
