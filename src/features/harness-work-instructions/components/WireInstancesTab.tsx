/**
 * Harness Work Instruction Generator — Wire Instances Grid
 * Phase HWI.3 — Review UI
 *
 * Editable table of wire instances with inline flag highlighting.
 * Flag field_ref format: "wire_instances.{index}.{field}"
 */

'use client';

import React from 'react';
import type { WireInstance, EngineeringFlag } from '../types/harnessInstruction.schema';

type EditableWireField =
  | 'aci_wire_part_number'
  | 'gauge'
  | 'color'
  | 'cut_length'
  | 'strip_end_a'
  | 'strip_end_b';

interface WireInstancesTabProps {
  wireInstances: WireInstance[];
  flags: EngineeringFlag[];
  onUpdate: (index: number, field: EditableWireField, value: string | number | null) => void;
  isLocked?: boolean;
}

function getActiveFlags(flags: EngineeringFlag[], path: string): EngineeringFlag[] {
  return flags.filter(f => f.field_ref === path && !f.resolved);
}

interface CellProps {
  flags: EngineeringFlag[];
  path: string;
  children: React.ReactNode;
}

function Cell({ flags: allFlags, path, children }: CellProps) {
  const hits = getActiveFlags(allFlags, path);
  const hasFlag = hits.length > 0;
  const title = hits.map(f => f.message).join(' | ');

  return (
    <td
      title={hasFlag ? title : undefined}
      className={`px-0 py-0 border-r border-gray-100 ${hasFlag ? 'bg-red-50 ring-1 ring-inset ring-red-300' : ''}`}
    >
      {children}
    </td>
  );
}

interface InputCellProps {
  value: string;
  type?: 'text' | 'number';
  flags: EngineeringFlag[];
  path: string;
  onChange: (val: string) => void;
  placeholder?: string;
  isLocked?: boolean;
}

function InputCell({ value, type = 'text', flags: allFlags, path, onChange, placeholder, isLocked }: InputCellProps) {
  const hits = getActiveFlags(allFlags, path);
  const hasFlag = hits.length > 0;

  return (
    <Cell flags={allFlags} path={path}>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={isLocked}
        onChange={isLocked ? undefined : e => onChange(e.target.value)}
        className={`w-full bg-transparent px-2 py-1.5 text-xs border-0 focus:outline-none min-w-0 ${
          isLocked ? 'cursor-default text-gray-600' : 'focus:bg-blue-50'
        } ${
          hasFlag ? 'text-red-700 placeholder-red-300' : 'text-gray-800'
        }`}
        style={{ minWidth: '60px' }}
      />
    </Cell>
  );
}

export default function WireInstancesTab({ wireInstances, flags, onUpdate, isLocked }: WireInstancesTabProps) {
  if (wireInstances.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        No wire instances extracted
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <table className="text-xs border-collapse" style={{ minWidth: '900px' }}>
        <thead className="sticky top-0 z-10 bg-gray-50">
          <tr>
            {[
              'Wire ID', 'ACI Part #', 'Gauge', 'Color',
              'Cut Length (in)', 'Strip A', 'Strip B',
              'End A', 'End B', 'Source / Confidence',
            ].map(h => (
              <th
                key={h}
                className="text-left px-2 py-2 font-medium text-gray-600 border-b-2 border-gray-200 whitespace-nowrap border-r border-gray-100"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {wireInstances.map((wire, index) => {
            const p = (field: string) => `wire_instances.${index}.${field}`;

            return (
              <tr
                key={wire.wire_id}
                id={`wire_instances-${index}`}
                className="border-b border-gray-100 hover:bg-gray-50 group"
              >
                {/* Wire ID — read-only identifier */}
                <td className="px-2 py-1.5 font-mono text-gray-500 border-r border-gray-100 whitespace-nowrap">
                  {wire.wire_id}
                </td>

                <InputCell
                  value={wire.aci_wire_part_number}
                  flags={flags}
                  path={p('aci_wire_part_number')}
                  onChange={v => onUpdate(index, 'aci_wire_part_number', v)}
                  placeholder="ACI Part #"
                  isLocked={isLocked}
                />

                <InputCell
                  value={String(wire.gauge)}
                  flags={flags}
                  path={p('gauge')}
                  onChange={v => onUpdate(index, 'gauge', v)}
                  placeholder="AWG"
                  isLocked={isLocked}
                />

                <InputCell
                  value={wire.color}
                  flags={flags}
                  path={p('color')}
                  onChange={v => onUpdate(index, 'color', v)}
                  placeholder="Color"
                  isLocked={isLocked}
                />

                <Cell flags={flags} path={p('cut_length')}>
                  <div className="relative">
                    <input
                      type="number"
                      value={wire.cut_length == null ? '' : String(wire.cut_length)}
                      readOnly={isLocked}
                      onChange={isLocked ? undefined : e => {
                        const val = e.target.value;
                        if (val === '') {
                          onUpdate(index, 'cut_length', null);
                          return;
                        }
                        const next = parseFloat(val);
                        onUpdate(index, 'cut_length', Number.isFinite(next) ? next : null);
                      }}
                      className={`w-full bg-transparent px-2 py-1.5 text-xs border-0 focus:outline-none min-w-0 ${
                        isLocked ? 'cursor-default text-gray-600' : 'focus:bg-blue-50'
                      } ${
                        wire.cut_length == null ? 'text-gray-600' : 'text-gray-800'
                      }`}
                      style={{ minWidth: '60px' }}
                    />
                    {wire.cut_length == null && (
                      <span className="absolute inset-y-0 left-2 flex items-center text-[11px] text-gray-400 pointer-events-none">
                        — (from drawing)
                      </span>
                    )}
                  </div>
                </Cell>

                <InputCell
                  value={wire.strip_end_a != null ? String(wire.strip_end_a) : ''}
                  type="number"
                  flags={flags}
                  path={p('strip_end_a')}
                  onChange={v => onUpdate(index, 'strip_end_a', v === '' ? null : parseFloat(v) || 0)}
                  placeholder="—"
                  isLocked={isLocked}
                />

                <InputCell
                  value={wire.strip_end_b != null ? String(wire.strip_end_b) : ''}
                  type="number"
                  flags={flags}
                  path={p('strip_end_b')}
                  onChange={v => onUpdate(index, 'strip_end_b', v === '' ? null : parseFloat(v) || 0)}
                  placeholder="—"
                  isLocked={isLocked}
                />

                {/* End A — read-only display (complex object) */}
                <Cell flags={flags} path={p('end_a')}>
                  <div className="px-2 py-1.5 font-mono text-gray-600 whitespace-nowrap">
                    {wire.end_a.connector_id ?? '—'}/{wire.end_a.cavity ?? '—'}
                  </div>
                </Cell>

                {/* End B — read-only display (complex object) */}
                <Cell flags={flags} path={p('end_b')}>
                  <div className="px-2 py-1.5 font-mono text-gray-600 whitespace-nowrap">
                    {wire.end_b.connector_id ?? '—'}/{wire.end_b.cavity ?? '—'}
                  </div>
                </Cell>

                {/* Source + match_confidence */}
                <td className="px-2 py-1.5 border-r border-gray-100 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs ${
                      wire.provenance.source_type === 'drawing' ? 'text-indigo-600 font-medium' : 'text-gray-400'
                    }`}>
                      {wire.provenance.source_type === 'drawing' ? '📐' : '📋'}{' '}
                      {wire.cut_length_source ?? wire.provenance.source_type}
                    </span>
                    {wire.match_confidence && (
                      <span
                        title={wire.match_confidence === 'LOW' ? 'Requires manual validation before approval' : undefined}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          wire.match_confidence === 'HIGH'
                            ? 'bg-green-100 text-green-700'
                            : wire.match_confidence === 'MEDIUM'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {wire.match_confidence}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
