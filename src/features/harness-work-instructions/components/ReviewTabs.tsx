/**
 * Harness Work Instruction Generator — Review UI Tab System
 * Phase HWI.3 — Review UI
 *
 * 7 tabs: Overview · Wire Instances · Komax · Manual Press · Pin Map · Questions · Preview
 */

'use client';

import React from 'react';
import type {
  HarnessInstructionJob,
  EngineeringFlag,
} from '../types/harnessInstruction.schema';
import WireInstancesTab from './WireInstancesTab';
import ReviewQuestionsTab from './ReviewQuestionsTab';

type EditableWireField =
  | 'aci_wire_part_number'
  | 'gauge'
  | 'color'
  | 'cut_length'
  | 'strip_end_a'
  | 'strip_end_b';

interface ReviewTabsProps {
  job: HarnessInstructionJob;
  flags: EngineeringFlag[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onUpdateWire: (index: number, field: EditableWireField, value: string | number | null) => void;
  onUpdateQuestion: (id: string, answer: string | null, resolved: boolean) => void;
  isLocked?: boolean;
}

const TABS = [
  { id: 'overview',   label: 'Overview' },
  { id: 'wires',      label: 'Wire Instances' },
  { id: 'komax',      label: 'Komax' },
  { id: 'press',      label: 'Manual Press' },
  { id: 'pinmap',     label: 'Pin Map' },
  { id: 'questions',  label: 'Questions' },
  { id: 'preview',    label: 'Preview' },
];

function ReadOnlyTable({
  headers,
  rows,
  emptyMsg,
}: {
  headers: string[];
  rows: (string | number | null)[][];
  emptyMsg: string;
}) {
  return (
    <div className="overflow-auto h-full">
      <table className="text-xs border-collapse" style={{ minWidth: '600px' }}>
        <thead className="sticky top-0 bg-gray-50">
          <tr>
            {headers.map(h => (
              <th key={h} className="text-left px-3 py-2 font-medium text-gray-600 border-b-2 border-gray-200 whitespace-nowrap border-r border-gray-100">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-6 text-center text-gray-400">
                {emptyMsg}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-1.5 border-r border-gray-100 font-mono whitespace-nowrap">
                    {cell ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function ReviewTabs({
  job,
  flags,
  activeTab,
  onTabChange,
  onUpdateWire,
  onUpdateQuestion,
  isLocked,
}: ReviewTabsProps) {
  const unresolvedFlags = flags.filter(f => !f.resolved);

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0 overflow-x-auto">
        {TABS.map(tab => {
          let badge: number | null = null;
          if (tab.id === 'wires')     badge = job.wire_instances.length;
          if (tab.id === 'komax')     badge = job.komax_rows.length;
          if (tab.id === 'press')     badge = job.press_rows.length;
          if (tab.id === 'pinmap')    badge = job.pin_map_rows.length;
          if (tab.id === 'questions') badge = job.review_questions.filter(q => !q.resolved).length;

          const flagsForTab = unresolvedFlags.filter(f => f.field_ref?.startsWith(
            tab.id === 'wires' ? 'wire_instances' :
            tab.id === 'komax' ? 'komax_rows' :
            tab.id === 'press' ? 'press_rows' :
            tab.id === 'pinmap' ? 'pin_map_rows' : '__none__'
          )).length;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-700 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              {badge !== null && badge > 0 && (
                <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5 leading-none">
                  {badge}
                </span>
              )}
              {flagsForTab > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="p-5 overflow-auto h-full">
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Part Number', value: job.metadata.part_number },
                { label: 'Revision',    value: job.metadata.revision },
                { label: 'Description', value: job.metadata.description ?? '—' },
                { label: 'Status',      value: job.status },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                  <div className="text-sm font-medium text-gray-800 truncate">{value}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Wire Instances',  value: job.wire_instances.length },
                { label: 'Komax Rows',      value: job.komax_rows.length },
                { label: 'Press Rows',      value: job.press_rows.length },
                { label: 'Pin Map Rows',    value: job.pin_map_rows.length },
                { label: 'Assembly Steps',  value: job.assembly_steps.length },
                { label: 'Review Qs',       value: job.review_questions.length },
              ].map(({ label, value }) => (
                <div key={label} className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-700">{value}</div>
                  <div className="text-xs text-blue-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wire Instances */}
        {activeTab === 'wires' && (
          <WireInstancesTab
            wireInstances={job.wire_instances}
            flags={flags}
            onUpdate={onUpdateWire}
            isLocked={isLocked}
          />
        )}

        {/* Komax */}
        {activeTab === 'komax' && (
          <ReadOnlyTable
            headers={['Komax ID', 'Wire ID', 'Cut Length (in)', 'Strip A', 'Strip B', 'Program #']}
            rows={job.komax_rows.map((r, i) => [
              r.komax_id, r.wire_id, r.cut_length, r.strip_a, r.strip_b, r.program_number,
            ])}
            emptyMsg="No Komax rows extracted"
          />
        )}

        {/* Manual Press */}
        {activeTab === 'press' && (
          <ReadOnlyTable
            headers={['Press ID', 'Wire ID', 'Terminal P/N', 'Applicator', 'Crimp Height']}
            rows={job.press_rows.map(r => [
              r.press_id, r.wire_id, r.terminal_part_number, r.applicator_id, r.crimp_height,
            ])}
            emptyMsg="No press rows extracted"
          />
        )}

        {/* Pin Map */}
        {activeTab === 'pinmap' && (
          <ReadOnlyTable
            headers={['PM ID', 'Connector', 'Cavity', 'Wire ID', 'Gauge', 'Color', 'Terminal P/N', 'Confidence']}
            rows={job.pin_map_rows.map(r => {
              const wire = job.wire_instances.find(w => w.wire_id === r.wire_id);
              return [
                r.pin_map_id,
                r.connector_id,
                r.cavity,
                r.wire_id,
                wire ? String(wire.gauge) : null,
                wire?.color ?? null,
                r.terminal_part_number,
                r.provenance.confidence != null
                  ? `${Math.round(r.provenance.confidence * 100)}%`
                  : null,
              ];
            })}
            emptyMsg="No pin map rows — upload a structured drawing to resolve endpoints"
          />
        )}

        {/* Questions */}
        {activeTab === 'questions' && (
          <ReviewQuestionsTab
            questions={job.review_questions}
            onUpdate={onUpdateQuestion}
            isLocked={isLocked}
          />
        )}

        {/* Preview placeholder */}
        {activeTab === 'preview' && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="text-4xl mb-3">📄</div>
            <div className="text-sm font-medium">PDF Preview</div>
            <div className="text-xs mt-1">Coming in HWI.4 — PDF Generation</div>
          </div>
        )}
      </div>
    </div>
  );
}
