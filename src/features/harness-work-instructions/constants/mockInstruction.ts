/**
 * Harness Work Instruction Generator — Mock Valid Job Data
 * Phase HWI.1 — Validation Testing + Future UI Development
 *
 * This mock passes HarnessInstructionJobSchema validation.
 * Use for:
 *   - Validation smoke tests
 *   - Future review UI scaffolding
 *   - extract-phase1 placeholder output
 */

import type { HarnessInstructionJob } from '../types/harnessInstruction.schema';

export const MOCK_VALID_INSTRUCTION: HarnessInstructionJob = {
  id: 'mock-job-001',
  status: 'review',
  metadata: {
    part_number: 'HA-12345-A',
    revision: 'A',
    description: 'Mock Main Wire Harness Assembly',
    source_document_url: null,
    created_at: '2026-04-10T00:00:00.000Z',
    approved_at: null,
    generated_pdf_url: null,
  },
  wire_instances: [
    {
      wire_id: 'W001',
      aci_wire_part_number: 'WIRE-18AWG-RED',
      gauge: '18',
      color: 'RED',
      cut_length: 12.5,
      strip_end_a: 0.25,
      strip_end_b: 0.25,
      end_a: {
        connector_id: 'C001',
        cavity: '1',
        terminal_part_number: 'TERM-001',
        seal_part_number: null,
      },
      end_b: {
        connector_id: 'C002',
        cavity: '3',
        terminal_part_number: 'TERM-001',
        seal_part_number: null,
      },
      provenance: {
        source_type: 'drawing',
        source_ref: 'DRW-001-REV-A',
        confidence: 0.92,
      },
    },
    {
      wire_id: 'W002',
      aci_wire_part_number: 'WIRE-18AWG-BLK',
      gauge: '18',
      color: 'BLACK',
      cut_length: 8.0,
      strip_end_a: 0.25,
      strip_end_b: null,
      end_a: {
        connector_id: 'C001',
        cavity: '2',
        terminal_part_number: 'TERM-001',
        seal_part_number: 'SEAL-001',
      },
      end_b: {
        connector_id: null,
        cavity: null,
        terminal_part_number: null,
        seal_part_number: null,
      },
      provenance: {
        source_type: 'bom',
        source_ref: 'BOM-REV-A',
        confidence: 0.85,
        note: 'End B is open — confirm with engineering',
      },
    },
  ],
  press_rows: [
    {
      press_id: 'PR001',
      wire_id: 'W001',
      terminal_part_number: 'TERM-001',
      applicator_id: 'APP-001',
      crimp_height: 1.2,
      provenance: {
        source_type: 'drawing',
        source_ref: 'DRW-001-REV-A',
        confidence: 0.9,
      },
    },
    {
      press_id: 'PR002',
      wire_id: 'W002',
      terminal_part_number: 'TERM-001',
      applicator_id: 'APP-001',
      crimp_height: 1.2,
      provenance: {
        source_type: 'drawing',
        source_ref: 'DRW-001-REV-A',
        confidence: 0.9,
      },
    },
  ],
  komax_rows: [
    {
      komax_id: 'KX001',
      wire_id: 'W001',
      cut_length: 12.5,
      strip_a: 0.25,
      strip_b: 0.25,
      program_number: 'PGM-100',
      provenance: {
        source_type: 'derived',
        confidence: 0.95,
      },
    },
    {
      komax_id: 'KX002',
      wire_id: 'W002',
      cut_length: 8.0,
      strip_a: 0.25,
      strip_b: null,
      program_number: 'PGM-100',
      provenance: {
        source_type: 'derived',
        confidence: 0.95,
      },
    },
  ],
  pin_map_rows: [
    {
      pin_map_id: 'PM001',
      connector_id: 'C001',
      cavity: '1',
      wire_id: 'W001',
      terminal_part_number: 'TERM-001',
      provenance: {
        source_type: 'drawing',
        source_ref: 'DRW-001-REV-A',
        confidence: 0.95,
      },
    },
    {
      pin_map_id: 'PM002',
      connector_id: 'C001',
      cavity: '2',
      wire_id: 'W002',
      terminal_part_number: 'TERM-001',
      provenance: {
        source_type: 'drawing',
        source_ref: 'DRW-001-REV-A',
        confidence: 0.95,
      },
    },
    {
      pin_map_id: 'PM003',
      connector_id: 'C002',
      cavity: '3',
      wire_id: 'W001',
      terminal_part_number: 'TERM-001',
      provenance: {
        source_type: 'drawing',
        source_ref: 'DRW-001-REV-A',
        confidence: 0.95,
      },
    },
  ],
  assembly_steps: [
    {
      step_number: 1,
      instruction:
        'Cut 18AWG RED wire (W001) to 12.5 inches. Strip 0.25 inches at both ends.',
      wire_ids: ['W001'],
      tool_ref: 'TOOL-WIRE-STRIPPER',
      notes: null,
      provenance: {
        source_type: 'drawing',
        source_ref: 'DRW-001-REV-A',
        confidence: 0.9,
      },
    },
    {
      step_number: 2,
      instruction:
        'Cut 18AWG BLACK wire (W002) to 8.0 inches. Strip 0.25 inches at end A only.',
      wire_ids: ['W002'],
      tool_ref: 'TOOL-WIRE-STRIPPER',
      notes: 'End B is open — verify routing destination before assembly',
      provenance: {
        source_type: 'drawing',
        source_ref: 'DRW-001-REV-A',
        confidence: 0.88,
      },
    },
    {
      step_number: 3,
      instruction:
        'Crimp terminal TERM-001 on W001 end A and route into connector C001 cavity 1.',
      wire_ids: ['W001'],
      tool_ref: 'TOOL-CRIMP-APP-001',
      notes: null,
      provenance: {
        source_type: 'drawing',
        source_ref: 'DRW-001-REV-A',
        confidence: 0.92,
      },
    },
  ],
  engineering_flags: [
    {
      flag_id: 'FL001',
      flag_type: 'review_required',
      field_ref: 'wire_instances[1].end_b',
      message: 'W002 end B is open — confirm with engineering before finalizing.',
      resolved: false,
    },
  ],
  review_questions: [
    {
      id: 'RQ001',
      prompt: 'Confirm cut length 12.5 inches for W001 matches drawing DRW-001-REV-A.',
      answer: null,
      resolved: false,
    },
    {
      id: 'RQ002',
      prompt: 'Is W002 end B intentionally open or does it require a connector?',
      answer: null,
      resolved: false,
    },
  ],
};
