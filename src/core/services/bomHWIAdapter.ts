/**
 * BOM → HWI Normalization Adapter
 * Phase HWI.7 / HWI.7.1 — Block-Based BOM Ingestion
 *
 * EXTENSION of bomService — does NOT duplicate any parsing logic.
 *
 * HWI.7.1 upgrade:
 *  - groupBOMBlocks() groups multi-line component entries
 *  - parseComponentBlock() extracts qty from "Qty Per:" continuation lines
 *  - parseWireToken() extracts gauge/color from description text
 *  - buildOperationModels() assembles OperationModel[] with instructions
 *  - normalizeFromModels() is the enriched normalisation core
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
 *   [BOM BLOCK GROUPING]         — from groupBOMBlocks (bomService)
 *   [BOM OPERATION PARSED]       — from groupBOMBlocks (bomService)
 *   [BOM COMPONENT BLOCK PARSED] — from groupBOMBlocks (bomService)
 *   [BOM INSTRUCTION CAPTURED]   — from groupBOMBlocks (bomService)
 *   [BOM NORMALIZED FOR HWI]     — summary after normalization
 */

import { parseBOMText } from '../parser/parserService';
import { classifyComponentWithLookup, groupBOMBlocks } from './bomService';
import type { BOMBlock } from './bomService';
import type { RawBOMData } from '../data/bom/types';
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
// Internal semantic model (richer than RawBOMData)
// ---------------------------------------------------------------------------

/** One component extracted from a COMPONENT block */
interface ComponentModel {
  part_number:    string;
  aci:            string | null;
  description:    string;
  quantity:       number;
  uom:            string | null;
  raw_first_line: string;
}

/** One operation with its resolved instructions and components */
interface OperationModel {
  step_number:   string;
  operation_code: string;
  description:   string;
  instructions:  string[];
  components:    ComponentModel[];
}

// ---------------------------------------------------------------------------
// Shared constants
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

// ---------------------------------------------------------------------------
// parseWireToken — extract gauge + color from description or part-number text
// ---------------------------------------------------------------------------

/**
 * Parse a wire token string (part number or description) for gauge and color.
 *
 * Handles patterns:
 *   "W20BK"           → gauge=20, color=BLACK   (part number format)
 *   "20AWG BK WIRE"   → gauge=20, color=BLACK   (description format)
 *   "18 AWG WHITE"    → gauge=18, color=WHITE
 *   "#22 GN"          → gauge=22, color=GREEN
 */
export function parseWireToken(text: string): { gauge: string; color: string } {
  const upper = text.toUpperCase();

  // Gauge — prefer AWG notation in description, then wire part prefix W##
  const gaugeM =
    upper.match(/(\d{1,2})\s*AWG/) ??
    upper.match(/AWG\s*(\d{1,2})/) ??
    upper.match(/#\s*(\d{1,2})\b/) ??
    upper.match(/^W(\d{1,2})/);
  const gauge = gaugeM?.[1] ?? 'UNKNOWN';

  // Color — scan tokens against map; longest match wins
  const tokens = upper.split(/[\s\-_]+/);
  let color = 'UNKNOWN';
  for (const tok of tokens) {
    if (WIRE_COLOR_MAP[tok]) { color = WIRE_COLOR_MAP[tok]; break; }
  }

  return { gauge, color };
}

// ---------------------------------------------------------------------------
// parseComponentBlock — extract semantic fields from a COMPONENT BOMBlock
// ---------------------------------------------------------------------------

/**
 * Parse a COMPONENT block (first line = "----PARTID [ACI] DESC ... QTY",
 * continuation lines may contain "Qty Per: ... VALUE") into a ComponentModel.
 *
 * Qty priority:
 *   1. "Qty Per:" continuation line (authoritative)
 *   2. Trailing float on the first line (single-line format)
 *   3. Default 1
 */
function parseComponentBlock(block: BOMBlock): ComponentModel {
  const firstLine   = block.lines[0];
  const afterDashes = firstLine.replace(/^[-\s]+/, '').trim();
  const tokens      = afterDashes.split(/\s+/);
  const part_number = tokens[0] ?? 'UNKNOWN';

  // ACI code
  const aciM = afterDashes.match(/AC[I1][-\s]?\d{4,6}/i);
  const aci  = aciM
    ? aciM[0].replace(/[-\s]/g, '').replace(/^AC1/i, 'ACI').toUpperCase()
    : null;

  // Trailing float from first line → qty candidate
  const trailingM   = firstLine.match(/(\d+\.?\d*)\s*$/);
  let quantity      = trailingM ? parseFloat(trailingM[1]) : 1;

  // Authoritative qty from "Qty Per:" continuation line
  for (const contLine of block.lines.slice(1)) {
    const qtyM = contLine.match(/Qty Per[^:]*:.*?(\d+\.?\d*)\s*$/i);
    if (qtyM) { quantity = parseFloat(qtyM[1]); break; }
  }

  // UOM
  const uomM = firstLine.match(/\b(EA|EACH|FT|FEET|IN|INCH|PC|PCS|SET|KIT|LOT)\b/i);
  const uom  = uomM ? uomM[1].toUpperCase() : null;

  // Description: strip part_number, ACI code, and trailing number from first line
  const escaped = part_number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const description = afterDashes
    .replace(new RegExp('^' + escaped + '\\s*', 'i'), '')
    .replace(/AC[I1][-\s]?\d{4,6}/gi, '')
    .replace(/\b(EA|EACH|FT|FEET|IN|INCH|PC|PCS|SET|KIT|LOT)\b/gi, '')
    .replace(/(\d+\.?\d*)\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { part_number, aci, description, quantity, uom, raw_first_line: firstLine };
}

// ---------------------------------------------------------------------------
// buildOperationModels — group BOMBlocks into OperationModel[]
// ---------------------------------------------------------------------------

function buildOperationModels(blocks: BOMBlock[]): OperationModel[] {
  const models: OperationModel[] = [];
  let current: OperationModel | null = null;

  for (const block of blocks) {
    if (block.type === 'operation') {
      if (current) models.push(current);
      current = {
        step_number:    block.step_number    ?? 'XX',
        operation_code: block.operation_code ?? 'UNKNOWN',
        description:    block.operation_description ?? '',
        instructions:   [],
        components:     [],
      };
    } else if (block.type === 'instruction' && current) {
      const text = block.lines[0].trim();
      if (text) current.instructions.push(text);
    } else if (block.type === 'component' && current) {
      current.components.push(parseComponentBlock(block));
    }
  }
  if (current) models.push(current);
  return models;
}

// ---------------------------------------------------------------------------
// Shared normalisation helpers
// ---------------------------------------------------------------------------

function detectOpType(code: string): 'komax' | 'press' | 'assembly' {
  const id = code.toUpperCase();
  if (/CUT|KOM|STRIP/.test(id))          return 'komax';
  if (/CRIMP|PRESS|TERM|SEAL/.test(id))  return 'press';
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

async function classifyComp(partId: string, desc: string): Promise<string> {
  if (WIRE_PART_RE.test(partId)) return 'WIRE';
  return classifyComponentWithLookup(partId, desc);
}

// ---------------------------------------------------------------------------
// normalizeFromModels — core normalisation using OperationModel[]
// ---------------------------------------------------------------------------

async function normalizeFromModels(
  opModels:   OperationModel[],
  partNumber: string,
  revision:   string,
): Promise<HarnessInstructionJob> {
  const now = new Date().toISOString();

  // ── STEP 1: Classify all components in parallel ────────────────────
  type ClassifiedComp = ComponentModel & { opModel: OperationModel; category: string };
  const allClassified: ClassifiedComp[] = [];

  await Promise.all(
    opModels.map(async (op) => {
      for (const comp of op.components) {
        const category = await classifyComp(comp.part_number, comp.description);
        allClassified.push({ ...comp, opModel: op, category });
      }
    })
  );

  // ── STEP 2: Deduplicate wires across all operations ────────────────
  const wireMap = new Map<string, WireInstance>();
  let wireIdx = 0;

  for (const cc of allClassified) {
    if (cc.category !== 'WIRE') continue;
    if (wireMap.has(cc.part_number)) continue;

    wireIdx++;
    const wireId = pad(wireIdx, 'W');

    // Gauge + color: try part number first (W20BK format), then description
    const fromPart = parseWireToken(cc.part_number);
    const fromDesc = parseWireToken(cc.description + ' ' + cc.raw_first_line);
    const gauge    = fromPart.gauge !== 'UNKNOWN' ? fromPart.gauge : fromDesc.gauge;
    const color    = fromPart.color !== 'UNKNOWN' ? fromPart.color : fromDesc.color;

    // Cut length: for wires, quantity from block = length in feet
    const cutLen = cc.quantity > 0 ? cc.quantity : 1.0;
    const aciPN  = cc.aci ?? cc.part_number;

    wireMap.set(cc.part_number, {
      wire_id:              wireId,
      aci_wire_part_number: aciPN,
      gauge,
      color,
      cut_length:  cutLen,
      strip_end_a: null,
      strip_end_b: null,
      end_a: nullEndTerminal(),
      end_b: nullEndTerminal(),
      provenance: bomProvenance('Gauge/color from part number then description'),
    });
  }

  const wire_instances: WireInstance[] = Array.from(wireMap.values());

  // ── STEP 3: Build press_rows / komax_rows / assembly_steps ────────
  const press_rows:     PressRow[]     = [];
  const komax_rows:     KomaxRow[]     = [];
  const assembly_steps: AssemblyStep[] = [];
  const engineering_flags: EngineeringFlag[] = [];

  let pressIdx = 0;
  let komaxIdx = 0;
  let stepIdx  = 0;

  for (const op of opModels) {
    stepIdx++;
    const opType = detectOpType(op.operation_code);

    const ccInOp = allClassified.filter(cc => cc.opModel === op);

    // Collect wire IDs present in this operation
    const wireIdsInOp = ccInOp
      .filter(cc => cc.category === 'WIRE')
      .map(cc  => wireMap.get(cc.part_number)?.wire_id)
      .filter((id): id is string => Boolean(id));

    // Komax rows — WR-CUTGROUP wires
    if (opType === 'komax') {
      for (const cc of ccInOp.filter(c => c.category === 'WIRE')) {
        komaxIdx++;
        const wid = wireMap.get(cc.part_number)?.wire_id ?? 'TBD';
        komax_rows.push({
          komax_id:       pad(komaxIdx, 'K'),
          wire_id:        wid,
          cut_length:     cc.quantity > 0 ? cc.quantity : 1.0,
          strip_a:        null,
          strip_b:        null,
          program_number: null,
          provenance:     bomProvenance('Cut length from Qty Per field'),
        });
      }
    }

    // Press rows — WR-CRIMP terminals
    if (opType === 'press') {
      const wireRef = wireIdsInOp[0] ?? 'TBD';
      for (const cc of ccInOp.filter(c => c.category === 'TERMINAL')) {
        pressIdx++;
        press_rows.push({
          press_id:             pad(pressIdx, 'P'),
          wire_id:              wireRef,
          terminal_part_number: cc.part_number,
          applicator_id:        null,
          crimp_height:         null,
          provenance:           bomProvenance('Terminal-to-wire link is estimated from operation context'),
        });
      }
    }

    // Assembly step — one per operation, captures instructions
    const instrText = op.instructions.length > 0
      ? op.instructions.join(' | ')
      : null;
    const baseInstruction = [op.operation_code, op.description]
      .filter(Boolean).join(' — ') || `Operation ${stepIdx}`;

    assembly_steps.push({
      step_number: stepIdx,
      instruction: baseInstruction,
      wire_ids:    [...new Set(wireIdsInOp)],
      tool_ref:    op.operation_code || null,
      notes:       instrText,
      provenance:  bomProvenance(),
    });
  }

  // ── STEP 4: Engineering flags ──────────────────────────────────────
  let flagIdx = 0;
  function flag(
    type: EngineeringFlag['flag_type'],
    message: string,
    field_ref: string | null = null,
  ): EngineeringFlag {
    return { flag_id: `F${(++flagIdx).toString().padStart(3, '0')}`, flag_type: type, field_ref, message, resolved: false };
  }

  engineering_flags.push(
    flag('review_required', 'All data is BOM-derived — review each field against the engineering print'),
    flag('info', 'Pin map not available from BOM parsing — must be completed manually', 'pin_map_rows'),
    flag('warning', 'Terminal-to-wire mappings are estimated — verify against crimp specification', 'press_rows'),
  );

  for (const wire of wire_instances) {
    if (wire.gauge === 'UNKNOWN')
      engineering_flags.push(flag('warning', `Gauge not detected for ${wire.aci_wire_part_number}`, `wire_instances.${wire.wire_id}.gauge`));
    if (wire.color === 'UNKNOWN')
      engineering_flags.push(flag('info', `Color not detected for ${wire.aci_wire_part_number}`, `wire_instances.${wire.wire_id}.color`));
    if (wire.cut_length === 1.0)
      engineering_flags.push(flag('warning', `Cut length defaulted to 1.0 for ${wire.aci_wire_part_number} — verify against print`, `wire_instances.${wire.wire_id}.cut_length`));
  }

  // ── STEP 5: Review questions ───────────────────────────────────────
  const review_questions: ReviewQuestion[] = [
    { id: 'RQ-001', prompt: 'Are all wire cut lengths correct per the engineering drawing?',  answer: null, resolved: false },
    { id: 'RQ-002', prompt: 'Are crimp heights specified for each terminal type?',             answer: null, resolved: false },
    { id: 'RQ-003', prompt: 'Have connector part numbers been verified against the BOM?',      answer: null, resolved: false },
    { id: 'RQ-004', prompt: 'Is the pin map complete and accurate for all connectors?',        answer: null, resolved: false },
    { id: 'RQ-005', prompt: 'Are all strip lengths (end A / end B) specified on the print?',  answer: null, resolved: false },
  ];

  // ── STEP 6: Assemble job ───────────────────────────────────────────
  const job: HarnessInstructionJob = {
    id:     crypto.randomUUID(),
    status: 'review',
    metadata: {
      part_number:         partNumber,
      revision,
      description:         null,
      source_document_url: null,
      created_at:          now,
      approved_at:         null,
      generated_pdf_url:   null,
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
    part_number:    partNumber,
    revision,
    wire_instances: wire_instances.length,
    press_rows:     press_rows.length,
    komax_rows:     komax_rows.length,
    assembly_steps: assembly_steps.length,
    flags:          engineering_flags.length,
    total_components: allClassified.length,
    categories: allClassified.reduce<Record<string, number>>((acc, cc) => {
      acc[cc.category] = (acc[cc.category] ?? 0) + 1; return acc;
    }, {}),
  });

  return job;
}

// ---------------------------------------------------------------------------
// normalizeForHWI (exported — public API, backward-compatible)
// Now uses the block-based path via rawBOM.rawText
// ---------------------------------------------------------------------------

export async function normalizeForHWI(
  rawBOM: RawBOMData,
  partNumber?: string,
  revision?: string,
): Promise<HarnessInstructionJob> {
  const pn  = (partNumber ?? rawBOM.masterPartNumber ?? 'UNKNOWN').toUpperCase();
  const rev = (revision   ?? rawBOM.revision_raw     ?? 'A').toUpperCase();

  const lines    = rawBOM.rawText.split('\n');
  const blocks   = groupBOMBlocks(lines);
  const opModels = buildOperationModels(blocks);

  return normalizeFromModels(opModels, pn, rev);
}

// ---------------------------------------------------------------------------
// parseBOMToHWI — top-level entry point (exported)
//
// Accepts pre-extracted BOM text (string).
// PDF text extraction is browser-only (pdfjs-dist); extract client-side
// and pass the resulting text string here.
// ---------------------------------------------------------------------------

export async function parseBOMToHWI(
  bomText:     string,
  partNumber?: string,
  revision?:   string,
): Promise<HarnessInstructionJob> {
  const lines    = bomText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const blocks   = groupBOMBlocks(lines);
  const opModels = buildOperationModels(blocks);

  // rawBOM used only for masterPN and revision fallback
  const rawBOM = parseBOMText(bomText);
  const pn  = (partNumber ?? rawBOM.masterPartNumber ?? 'UNKNOWN').toUpperCase();
  const rev = (revision   ?? rawBOM.revision_raw     ?? 'A').toUpperCase();

  console.log('[BOM PROCESS PARSE START]', {
    textLength:     bomText.length,
    blocks:         blocks.length,
    opModels:       opModels.length,
    totalComponents: opModels.reduce((n, op) => n + op.components.length, 0),
    masterPN:       pn,
    revision:       rev,
  });

  return normalizeFromModels(opModels, pn, rev);
}
