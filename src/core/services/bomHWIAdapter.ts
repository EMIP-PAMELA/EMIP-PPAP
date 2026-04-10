/**
 * BOM → HWI Normalization Adapter
 * Phase HWI.7 — Process-Aware BOM Ingestion
 *
 * EXTENSION of bomService — does NOT duplicate any parsing logic.
 * All parsing is delegated to the existing core parseBOMText() engine
 * via parseProcessStructure() in bomService.ts.
 *
 * Resolution order (unchanged):  MAP → PATTERN → AI/CANONICAL → UNKNOWN
 *
 * Governance:
 *  - classifyComponent is NOT called here directly
 *  - AI pipeline is untouched
 *  - No schema changes
 *  - bomService remains the single parsing source of truth
 *
 * Log prefixes:
 *   [BOM PROCESS PARSE START]   — from parseProcessStructure (bomService)
 *   [BOM OPERATION DETECTED]    — from parseProcessStructure (bomService)
 *   [BOM COMPONENT DETECTED]    — from parseProcessStructure (bomService)
 *   [BOM NORMALIZED FOR HWI]    — summary after normalization
 */

import { parseBOMText } from '../parser/parserService';
import { classifyComponentWithLookup } from './bomService';
import type { RawBOMData, RawComponent, RawOperation } from '../data/bom/types';
import type {
  HarnessInstructionJob,
  WireInstance,
  PressRow,
  KomaxRow,
  AssemblyStep,
  EngineeringFlag,
  ReviewQuestion,
  Provenance,
  EndTerminal,
} from '@/src/features/harness-work-instructions/types/harnessInstruction.schema';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const WIRE_PART_RE = /^W\d+/i;

const WIRE_COLOR_MAP: Record<string, string> = {
  BK: 'BLACK', BLK: 'BLACK', BLACK: 'BLACK',
  RD: 'RED',   RED: 'RED',
  BL: 'BLUE',  BLU: 'BLUE',  BLUE: 'BLUE',
  YE: 'YELLOW', YL: 'YELLOW', YEL: 'YELLOW', YELLOW: 'YELLOW',
  GN: 'GREEN', GR: 'GREEN', GRN: 'GREEN',   GREEN: 'GREEN',
  WH: 'WHITE', WHT: 'WHITE', WHITE: 'WHITE',
  OR: 'ORANGE', ORG: 'ORANGE', ORANGE: 'ORANGE',
  BR: 'BROWN', BRN: 'BROWN', BROWN: 'BROWN',
  GY: 'GRAY',  GRY: 'GRAY',  GRAY: 'GRAY',
  VT: 'VIOLET', VIO: 'VIOLET', VIOLET: 'VIOLET',
};

/** Extract 2-digit gauge from wire part like W20BK → "20" */
function extractGaugeFromWirePart(partId: string): string {
  const m = partId.match(/^W(\d{1,2})/i);
  return m ? m[1] : 'UNKNOWN';
}

/** Extract color from wire part like W20BK → "BLACK" */
function extractColorFromWirePart(partId: string): string {
  const m = partId.match(/^W\d{1,2}([A-Z]{2,3})/i);
  if (!m) return 'UNKNOWN';
  return WIRE_COLOR_MAP[m[1].toUpperCase()] ?? m[1].toUpperCase();
}

/** Extract trailing float from a BOM raw line — used as cut length for wires */
function extractTrailingFloat(rawLine: string): number | null {
  const m = rawLine.match(/(\d+\.?\d*)\s*$/);
  return m ? parseFloat(m[1]) : null;
}

/** Extract description tokens from rawLine after stripping dashes + partId */
function extractDescription(rawLine: string, partId: string): string {
  const afterDashes = rawLine.replace(/^[-\s]+/, '').trim();
  const escaped = partId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return afterDashes.replace(new RegExp('^' + escaped + '\\s*', 'i'), '').trim();
}

/** Map operation resourceId to a category bucket */
function detectOpType(resourceId: string): 'komax' | 'press' | 'assembly' {
  const id = resourceId.toUpperCase();
  if (/CUT|KOM|STRIP/.test(id))          return 'komax';
  if (/CRIMP|PRESS|TERM|SEALS?/.test(id)) return 'press';
  return 'assembly';
}

function bomProvenance(note?: string): Provenance {
  return { source_type: 'bom', confidence: 0.7, source_ref: 'bom_parse', ...(note ? { note } : {}) };
}

function nullEndTerminal(): EndTerminal {
  return { connector_id: null, cavity: null, terminal_part_number: null, seal_part_number: null };
}

function pad(n: number, prefix: string): string {
  return `${prefix}${n.toString().padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Component classifier (wraps existing lookup — no new classification logic)
// ---------------------------------------------------------------------------

async function classifyComp(
  partId: string,
  desc: string,
): Promise<string> {
  if (WIRE_PART_RE.test(partId)) return 'WIRE';
  return classifyComponentWithLookup(partId, desc);
}

// ---------------------------------------------------------------------------
// normalizeForHWI
// ---------------------------------------------------------------------------

export async function normalizeForHWI(
  rawBOM: RawBOMData,
  partNumber?: string,
  revision?: string,
): Promise<HarnessInstructionJob> {
  const pn  = (partNumber ?? rawBOM.masterPartNumber ?? 'UNKNOWN').toUpperCase();
  const rev = (revision ?? rawBOM.revision_raw ?? 'A').toUpperCase();
  const now = new Date().toISOString();

  // ------------------------------------------------------------------
  // STEP 1 — Classify every component up front (parallel per operation)
  // ------------------------------------------------------------------
  type ClassifiedComp = {
    raw: RawComponent;
    op: RawOperation;
    category: string;
    description: string;
  };

  const allClassified: ClassifiedComp[] = [];

  await Promise.all(
    rawBOM.operations.map(async (op) => {
      for (const raw of op.components) {
        const desc     = extractDescription(raw.rawLine, raw.detectedPartId);
        const category = await classifyComp(raw.detectedPartId, desc);
        allClassified.push({ raw, op, category, description: desc });
      }
    })
  );

  // ------------------------------------------------------------------
  // STEP 2 — Deduplicate wires (same part may appear in multiple ops)
  // ------------------------------------------------------------------
  const wireMap = new Map<string, WireInstance>(); // keyed by detectedPartId
  let wireIdx = 0;

  for (const cc of allClassified) {
    if (cc.category !== 'WIRE') continue;
    const pid = cc.raw.detectedPartId;
    if (wireMap.has(pid)) continue;

    wireIdx++;
    const wireId   = pad(wireIdx, 'W');
    const gauge    = extractGaugeFromWirePart(pid);
    const color    = extractColorFromWirePart(pid);
    const rawLen   = extractTrailingFloat(cc.raw.rawLine);
    const cutLen   = rawLen && rawLen > 0 ? rawLen : 1.0;
    const aciPN    = cc.raw.detectedAci ?? pid;

    wireMap.set(pid, {
      wire_id:              wireId,
      aci_wire_part_number: aciPN,
      gauge,
      color,
      cut_length:   cutLen,
      strip_end_a:  null,
      strip_end_b:  null,
      end_a: nullEndTerminal(),
      end_b: nullEndTerminal(),
      provenance: bomProvenance('Gauge and color derived from wire part number'),
    });
  }

  const wire_instances: WireInstance[] = Array.from(wireMap.values());

  // ------------------------------------------------------------------
  // STEP 3 — Build press_rows / komax_rows / assembly_steps
  // ------------------------------------------------------------------
  const press_rows:     PressRow[]     = [];
  const komax_rows:     KomaxRow[]     = [];
  const assembly_steps: AssemblyStep[] = [];
  const engineering_flags: EngineeringFlag[] = [];

  let pressIdx  = 0;
  let komaxIdx  = 0;
  let stepIdx   = 0;

  for (const op of rawBOM.operations) {
    stepIdx++;
    const opType = detectOpType(op.resourceId);

    const ccInOp = allClassified.filter(cc => cc.op === op);
    const wireIdsInOp: string[] = [];

    for (const cc of ccInOp) {
      const pid   = cc.raw.detectedPartId;
      const wireEntry = wireMap.get(pid);
      if (wireEntry) wireIdsInOp.push(wireEntry.wire_id);

      if (opType === 'komax' && cc.category === 'WIRE') {
        komaxIdx++;
        const rawLen = extractTrailingFloat(cc.raw.rawLine);
        const cutLen = rawLen && rawLen > 0 ? rawLen : 1.0;
        komax_rows.push({
          komax_id:       pad(komaxIdx, 'K'),
          wire_id:        wireEntry?.wire_id ?? 'TBD',
          cut_length:     cutLen,
          strip_a:        null,
          strip_b:        null,
          program_number: null,
          provenance:     bomProvenance('Cut length from BOM trailing value'),
        });

      } else if (opType === 'press' && cc.category === 'TERMINAL') {
        pressIdx++;
        const wireRef = wireIdsInOp.find(id => id !== wireEntry?.wire_id) ?? 'TBD';
        press_rows.push({
          press_id:             pad(pressIdx, 'P'),
          wire_id:              wireRef,
          terminal_part_number: pid,
          applicator_id:        null,
          crimp_height:         null,
          provenance:           bomProvenance('Terminal-to-wire mapping is derived from BOM'),
        });
      }
    }

    const instruction = [op.resourceId, op.description].filter(Boolean).join(' — ') ||
      `Operation ${stepIdx}`;

    assembly_steps.push({
      step_number: stepIdx,
      instruction,
      wire_ids:  [...new Set(wireIdsInOp)],
      tool_ref:  op.resourceId || null,
      notes:     op.rawLines.slice(1).join('\n').trim() || null,
      provenance: bomProvenance(),
    });
  }

  // ------------------------------------------------------------------
  // STEP 4 — Engineering flags
  // ------------------------------------------------------------------
  let flagIdx = 0;
  function flag(
    type: EngineeringFlag['flag_type'],
    message: string,
    field_ref: string | null = null,
  ): EngineeringFlag {
    return {
      flag_id:   `F${(++flagIdx).toString().padStart(3, '0')}`,
      flag_type: type,
      field_ref,
      message,
      resolved:  false,
    };
  }

  engineering_flags.push(
    flag('review_required', 'All data is BOM-derived — review each field against the engineering print', null),
    flag('info', 'Pin map not available from BOM parsing — must be completed manually', 'pin_map_rows'),
    flag('warning', 'Terminal-to-wire mappings are estimated from operation context — verify against crimp spec', 'press_rows'),
  );

  for (const wire of wire_instances) {
    if (wire.gauge === 'UNKNOWN') {
      engineering_flags.push(
        flag('warning', `Gauge not detected for ${wire.aci_wire_part_number} — update manually`, `wire_instances.${wire.wire_id}.gauge`)
      );
    }
    if (wire.color === 'UNKNOWN') {
      engineering_flags.push(
        flag('info', `Color not detected for ${wire.aci_wire_part_number}`, `wire_instances.${wire.wire_id}.color`)
      );
    }
    if (wire.cut_length === 1.0) {
      engineering_flags.push(
        flag('warning', `Cut length defaulted to 1.0 for ${wire.aci_wire_part_number} — verify against print`, `wire_instances.${wire.wire_id}.cut_length`)
      );
    }
  }

  // ------------------------------------------------------------------
  // STEP 5 — Review questions
  // ------------------------------------------------------------------
  const review_questions: ReviewQuestion[] = [
    { id: 'RQ-001', prompt: 'Are all wire cut lengths correct per the engineering drawing?',      answer: null, resolved: false },
    { id: 'RQ-002', prompt: 'Are crimp heights specified for each terminal type?',                 answer: null, resolved: false },
    { id: 'RQ-003', prompt: 'Have connector part numbers been verified against the BOM?',          answer: null, resolved: false },
    { id: 'RQ-004', prompt: 'Is the pin map complete and accurate for all connectors?',            answer: null, resolved: false },
    { id: 'RQ-005', prompt: 'Are all strip lengths (end A / end B) specified on the print?',      answer: null, resolved: false },
  ];

  // ------------------------------------------------------------------
  // STEP 6 — Assemble job
  // ------------------------------------------------------------------
  const job: HarnessInstructionJob = {
    id:     crypto.randomUUID(),
    status: 'review',
    metadata: {
      part_number:        pn,
      revision:           rev,
      description:        null,
      source_document_url: null,
      created_at:         now,
      approved_at:        null,
      generated_pdf_url:  null,
    },
    wire_instances,
    press_rows,
    komax_rows,
    pin_map_rows: [],
    assembly_steps,
    engineering_flags,
    review_questions,
  };

  console.log('[BOM NORMALIZED FOR HWI]', {
    part_number:   pn,
    revision:      rev,
    wire_instances: wire_instances.length,
    press_rows:     press_rows.length,
    komax_rows:     komax_rows.length,
    assembly_steps: assembly_steps.length,
    flags:          engineering_flags.length,
  });

  return job;
}

// ---------------------------------------------------------------------------
// parseBOMToHWI — top-level entry point
//
// NOTE: Accepts pre-extracted BOM text (string).
// PDF text extraction is browser-only (pdfjs-dist); the caller is responsible
// for extracting text client-side and passing it here.
// ---------------------------------------------------------------------------

export async function parseBOMToHWI(
  bomText: string,
  partNumber?: string,
  revision?: string,
): Promise<HarnessInstructionJob> {
  console.log('[BOM PROCESS PARSE START]', { textLength: bomText.length });

  const rawBOM = parseBOMText(bomText);

  const componentCount = rawBOM.operations.reduce((n, op) => n + op.components.length, 0);

  console.log('[BOM OPERATION DETECTED]', {
    masterPartNumber: rawBOM.masterPartNumber,
    operationCount:   rawBOM.operations.length,
    operationIds:     rawBOM.operations.map(o => o.resourceId),
  });

  console.log('[BOM COMPONENT DETECTED]', { componentCount });

  return normalizeForHWI(rawBOM, partNumber, revision);
}
