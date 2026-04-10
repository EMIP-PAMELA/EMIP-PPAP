/**
 * OperatorInstructionView
 * Phase HWI.11.1 — Shop Floor Operator Instruction Panel
 *
 * Presents the ProcessInstructionBundle as a clean, station-grouped,
 * operator-readable document. No data is fabricated or transformed
 * beyond deterministic template substitutions.
 *
 * Sections:
 *   1. Readiness Banner (RED / GREEN)
 *   2. Issues Panel (review_required + warning notes)
 *   3. 🔵 Komax Setup    — grouped by gauge / color / applicator
 *   4. 🟠 Manual Press   — per terminal, with tooling
 *   5. 🟢 Assembly       — enriched step text, station badges, source tags
 *   6. ⚙️ Engineering Notes
 *
 * Governance:
 *   - NO changes to underlying data models
 *   - Assembly step enrichment is template-based only — not AI-generated
 *   - Provenance source tags reflect actual source_type values
 */

'use client';

import React, { useEffect } from 'react';
import type { HarnessInstructionJob } from '../types/harnessInstruction.schema';
import type {
  ProcessInstructionBundle,
  KomaxSetupEntry,
  AssemblyInstructionStep,
  TerminationLocation,
} from '../types/processInstructions';

// ---------------------------------------------------------------------------
// Komax group type (display only — not part of the data model)
// ---------------------------------------------------------------------------

interface KomaxGroup {
  key:                  string;
  gauge:                string;
  color:                string;
  applicator:           string | null;
  termination_location: TerminationLocation;
  entries:              KomaxSetupEntry[];
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

function groupKomaxSetup(entries: KomaxSetupEntry[]): KomaxGroup[] {
  const map = new Map<string, KomaxGroup>();
  for (const e of entries) {
    const key = `${e.gauge}|${e.color}|${e.applicator ?? ''}|${e.termination_location}`;
    if (!map.has(key)) {
      map.set(key, { key, gauge: e.gauge, color: e.color, applicator: e.applicator, termination_location: e.termination_location, entries: [] });
    }
    map.get(key)!.entries.push(e);
  }
  return [...map.values()];
}

function groupHeader(g: KomaxGroup): string {
  const parts: string[] = [`${g.gauge} AWG ${g.color}`];
  if (g.applicator) parts.push(`Applicator ${g.applicator}`);
  parts.push(g.termination_location === 'KOMAX' ? 'Komax Terminated' : g.termination_location === 'PRESS' ? 'Press Terminated' : 'Location Unknown');
  return parts.join(' — ');
}

// ---------------------------------------------------------------------------
// Assembly step enrichment (deterministic template substitution only)
// ---------------------------------------------------------------------------

function enrichStepText(
  step: AssemblyInstructionStep,
  pinMapRows: HarnessInstructionJob['pin_map_rows'],
): string {
  const text   = step.instruction_text.trim();
  if (!text) return '—';
  const wireId = step.related_wire_ids[0] ?? null;
  const connId = step.related_connector_ids[0] ?? null;
  const pm     = wireId ? pinMapRows.find(p => p.wire_id === wireId) : null;
  const cavity = pm?.cavity ?? null;

  if (/\bINSERT\b/i.test(text) && (wireId || connId)) {
    const parts: string[] = ['Insert'];
    if (wireId) parts.push(`wire ${wireId}`);
    if (connId) parts.push(`into connector ${connId}`);
    if (cavity) parts.push(`cavity ${cavity}`);
    return parts.join(' ');
  }
  if (/\bROUTE\b|\bLAY\b/i.test(text) && wireId) {
    return `Route wire ${wireId}${connId ? ` to connector ${connId}` : ''}${cavity ? ` cavity ${cavity}` : ''}`;
  }
  if (/\bCRIMP\b/i.test(text) && wireId) {
    return `Crimp terminal onto wire ${wireId}${connId ? ` — connector ${connId}` : ''}`;
  }
  if (/\b(?:CUT|STRIP)\b/i.test(text) && wireId) {
    return `Cut and strip wire ${wireId}`;
  }
  if (/\bLABEL\b|\bMARK\b/i.test(text) && wireId) {
    return `Apply label to wire ${wireId}`;
  }
  const base = text.charAt(0).toUpperCase() + text.slice(1);
  const ctx: string[] = [];
  if (step.related_wire_ids.length > 0)      ctx.push(step.related_wire_ids.join(', '));
  if (step.related_connector_ids.length > 0) ctx.push(step.related_connector_ids.join(', '));
  return ctx.length > 0 ? `${base} (${ctx.join(' · ')})` : base;
}

// ---------------------------------------------------------------------------
// Source context tag
// ---------------------------------------------------------------------------

function provenanceTag(sourceType: string): string {
  switch (sourceType) {
    case 'bom':     return '📋 BOM';
    case 'drawing': return '📐 Drawing';
    case 'derived': return '🧠 Derived';
    case 'manual':  return '✏️ Manual';
    case 'learned': return '🧠 Learned';
    default:        return '❓';
  }
}

function fmtLen(n: number | null): string {
  return n != null ? `${n.toFixed(3)}"` : '—';
}

// ---------------------------------------------------------------------------
// Station badge
// ---------------------------------------------------------------------------

const STATION_CLS: Record<string, string> = {
  KOMAX:      'bg-blue-100 text-blue-700 border border-blue-200',
  PRESS:      'bg-orange-100 text-orange-700 border border-orange-200',
  ASSEMBLY:   'bg-green-100 text-green-700 border border-green-200',
  LABEL:      'bg-gray-100 text-gray-600 border border-gray-200',
  INSPECTION: 'bg-purple-100 text-purple-700 border border-purple-200',
};

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ icon, title, headerCls, children }: {
  icon:      string;
  title:     string;
  headerCls: string;
  children:  React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm rounded-t-lg ${headerCls}`}>
        <span>{icon}</span>
        <span className="tracking-wide">{title}</span>
      </div>
      <div className="border border-t-0 border-gray-200 rounded-b-lg overflow-hidden bg-white">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Th / Td helpers
// ---------------------------------------------------------------------------

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-1.5 text-left text-gray-500 font-medium text-xs whitespace-nowrap">{children}</th>;
}
function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`px-3 py-2 text-xs border-b border-gray-100 ${mono ? 'font-mono' : ''}`}>{children ?? '—'}</td>;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface Props {
  job:    HarnessInstructionJob;
  bundle: ProcessInstructionBundle;
}

export default function OperatorInstructionView({ job, bundle }: Props) {
  const komaxGroups   = groupKomaxSetup(bundle.komax_setup);
  const reviewIssues  = bundle.engineering_notes.filter(n => n.severity === 'review_required');
  const warningIssues = bundle.engineering_notes.filter(n => n.severity === 'warning');
  const isReady       = reviewIssues.length === 0 && warningIssues.length === 0;

  useEffect(() => {
    console.log('[HWI GROUPED KOMAX SETUPS]', { groups: komaxGroups.length, totalEntries: bundle.komax_setup.length });
    console.log('[HWI READINESS STATUS]', {
      status:          isReady ? 'READY' : 'REVIEW_REQUIRED',
      review_required: reviewIssues.length,
      warnings:        warningIssues.length,
    });
  }, [bundle]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-5xl mx-auto">
      {/* Job identity row */}
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="text-xl font-bold text-gray-900">{job.metadata.part_number}</h2>
        <span className="text-sm text-gray-500">Rev {job.metadata.revision}</span>
        {job.metadata.description && <span className="text-sm text-gray-400">{job.metadata.description}</span>}
        <span className="ml-auto text-xs text-gray-400 font-mono">{job.id.slice(0, 8)}</span>
      </div>

      {/* Readiness banner */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-5 text-sm font-semibold border ${
        isReady ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'
      }`}>
        <span className="text-base">{isReady ? '✅' : '⚠️'}</span>
        <span>
          {isReady
            ? 'READY FOR PRODUCTION'
            : `REVIEW REQUIRED — ${reviewIssues.length + warningIssues.length} unresolved issue(s) must be addressed before release`}
        </span>
      </div>

      {/* Issues requiring attention */}
      {!isReady && (
        <div className="mb-6 border border-red-200 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border-b border-red-200 font-semibold text-sm text-red-800">
            ⚠️ Issues Requiring Attention
          </div>
          <ul className="divide-y divide-red-50">
            {[...reviewIssues, ...warningIssues].map(n => (
              <li key={n.note_id} className="flex items-start gap-3 px-4 py-2.5 text-xs hover:bg-red-50">
                <span className="flex-shrink-0 font-mono text-gray-400 pt-0.5">{n.note_id}</span>
                <span className={`flex-shrink-0 font-bold uppercase ${n.severity === 'review_required' ? 'text-red-600' : 'text-orange-600'}`}>
                  [{n.category}]
                </span>
                <span className="text-gray-700 flex-1">{n.message}</span>
                {n.field_ref && <span className="flex-shrink-0 text-gray-400 font-mono">{n.field_ref}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 🔵 KOMAX SETUP */}
      <Section icon="🔵" title="KOMAX SETUP" headerCls="bg-blue-700 text-white">
        {komaxGroups.length === 0 ? (
          <div className="px-4 py-8 text-xs text-gray-400 text-center">No Komax setup entries — upload BOM with cutting operations</div>
        ) : (
          komaxGroups.map(group => (
            <div key={group.key}>
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100">
                <span className="text-xs font-semibold text-blue-700">{groupHeader(group)}</span>
                <span className="ml-auto text-xs text-blue-400">{group.entries.length} wire{group.entries.length !== 1 ? 's' : ''}</span>
              </div>
              <table className="w-full">
                <thead><tr className="bg-gray-50 border-b border-gray-200">
                  <Th>Wire ID</Th><Th>Cut Length</Th><Th>Strip A</Th><Th>Strip B</Th><Th>Terminal A</Th><Th>Terminal B</Th><Th>Source</Th>
                </tr></thead>
                <tbody>
                  {group.entries.map(e => (
                    <tr key={e.wire_id} className="hover:bg-gray-50">
                      <Td mono>{e.wire_id}</Td>
                      <Td mono>{fmtLen(e.cut_length)}</Td>
                      <Td>{e.strip_end_a ?? '—'}</Td>
                      <Td>{e.strip_end_b ?? '—'}</Td>
                      <Td mono>{e.terminal_a ?? '—'}</Td>
                      <Td mono>{e.terminal_b ?? '—'}</Td>
                      <Td><span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{provenanceTag(e.provenance.source_type)}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </Section>

      {/* 🟠 MANUAL PRESS */}
      <Section icon="🟠" title="MANUAL PRESS SETUP" headerCls="bg-orange-600 text-white">
        {bundle.press_setup.length === 0 ? (
          <div className="px-4 py-8 text-xs text-gray-400 text-center">
            {bundle.all_komax_terminated ? '✓ All terminations handled in Komax — no manual press required' : 'No press setup entries'}
          </div>
        ) : (
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              <Th>Press ID</Th><Th>Wire ID</Th><Th>Gauge</Th><Th>Color</Th><Th>Terminal P/N</Th><Th>Applicator</Th><Th>Hand Tool</Th><Th>Strip</Th><Th>Source</Th>
            </tr></thead>
            <tbody>
              {bundle.press_setup.map(p => (
                <tr key={p.press_id} className={`hover:bg-gray-50 ${p.flags.length > 0 ? 'bg-orange-50' : ''}`}>
                  <Td mono>{p.press_id}</Td>
                  <Td mono>{p.wire_id}</Td>
                  <Td>{p.gauge}</Td>
                  <Td>{p.color}</Td>
                  <Td mono>{p.terminal_part_number}</Td>
                  <Td mono>{p.applicator_id ?? <span className="text-orange-500">⚠ —</span>}</Td>
                  <Td mono>{p.hand_tool_ref ?? '—'}</Td>
                  <Td>{p.strip_length ?? '—'}</Td>
                  <Td><span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{provenanceTag(p.provenance.source_type)}</span></Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* 🟢 ASSEMBLY INSTRUCTIONS */}
      <Section icon="🟢" title="ASSEMBLY INSTRUCTIONS" headerCls="bg-green-700 text-white">
        {bundle.assembly_instructions.length === 0 ? (
          <div className="px-4 py-8 text-xs text-gray-400 text-center">No assembly steps — upload BOM with operation instructions</div>
        ) : (
          <ol className="divide-y divide-gray-100">
            {bundle.assembly_instructions.map(step => {
              const enriched = enrichStepText(step, job.pin_map_rows);
              const badgeCls = STATION_CLS[step.station_type] ?? 'bg-gray-100 text-gray-600 border border-gray-200';
              return (
                <li key={step.step_number} className="flex gap-3 px-4 py-3 hover:bg-gray-50">
                  <span className="w-7 flex-shrink-0 font-bold text-gray-400 text-xs pt-1">{step.step_number}.</span>
                  <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium self-start mt-0.5 ${badgeCls}`}>{step.station_type}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-800 leading-snug">{enriched}</div>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      {step.related_wire_ids.length > 0 && (
                        <span className="text-xs text-gray-400">Wires: <span className="font-mono">{step.related_wire_ids.join(', ')}</span></span>
                      )}
                      {step.related_connector_ids.length > 0 && (
                        <span className="text-xs text-gray-400">Connectors: <span className="font-mono">{step.related_connector_ids.join(', ')}</span></span>
                      )}
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{provenanceTag(step.provenance.source_type)}</span>
                    </div>
                    {step.flags.length > 0 && <div className="text-xs text-orange-600 mt-1">{step.flags.join(' · ')}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      {/* ⚙️ ENGINEERING NOTES */}
      <Section icon="⚙️" title="ENGINEERING NOTES" headerCls="bg-gray-700 text-white">
        {bundle.engineering_notes.length === 0 ? (
          <div className="px-4 py-8 text-xs text-green-600 text-center">✓ No engineering notes — document is clean</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {bundle.engineering_notes.map(n => (
              <li key={n.note_id} className={`flex items-start gap-3 px-4 py-2.5 text-xs ${
                n.severity === 'review_required' ? 'bg-red-50' : n.severity === 'warning' ? 'bg-orange-50' : ''
              }`}>
                <span className="flex-shrink-0 font-mono text-gray-400">{n.note_id}</span>
                <span className={`flex-shrink-0 font-bold uppercase ${
                  n.severity === 'review_required' ? 'text-red-600' : n.severity === 'warning' ? 'text-orange-600' : 'text-blue-600'
                }`}>[{n.severity}]</span>
                <span className="flex-shrink-0 text-gray-500 font-medium">[{n.category}]</span>
                <span className="text-gray-700 flex-1">{n.message}</span>
                {n.field_ref && <span className="flex-shrink-0 text-gray-400 font-mono">{n.field_ref}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
