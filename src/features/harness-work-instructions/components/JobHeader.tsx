/**
 * Harness Work Instruction Generator — Job Header (Left Panel)
 * Phase HWI.3 — Review UI
 */

'use client';

import React from 'react';

interface JobHeaderProps {
  partNumber: string;
  revision: string;
  status: string;
  wireCount: number;
  pressCount: number;
  komaxCount: number;
  pinMapCount: number;
  stepCount: number;
  flagCount: number;
  unresolvedCount: number;
}

const STATUS_STYLE: Record<string, string> = {
  draft:      'bg-gray-100 text-gray-600',
  extracting: 'bg-blue-100 text-blue-700',
  review:     'bg-amber-100 text-amber-700',
  approved:   'bg-green-100 text-green-700',
  generated:  'bg-purple-100 text-purple-700',
};

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-1.5 px-3 rounded ${accent ? 'bg-red-50' : 'bg-gray-50'}`}>
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${accent ? 'text-red-600' : 'text-gray-800'}`}>{value}</span>
    </div>
  );
}

export default function JobHeader({
  partNumber,
  revision,
  status,
  wireCount,
  pressCount,
  komaxCount,
  pinMapCount,
  stepCount,
  flagCount,
  unresolvedCount,
}: JobHeaderProps) {
  const statusClass = STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-600';

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-3 py-3 border-b border-gray-100 bg-gray-50">
        <div className="text-xs text-gray-400 mb-0.5 uppercase tracking-wider">Job Info</div>
        <div className="font-mono font-bold text-gray-900 text-sm truncate">{partNumber}</div>
        <div className="text-xs text-gray-500 mt-0.5">Revision: <span className="font-medium text-gray-700">{revision}</span></div>
        <div className="mt-2">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusClass}`}>
            {status}
          </span>
        </div>
      </div>

      <div className="px-3 py-2 space-y-1">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">Counts</div>
        <Stat label="Wires" value={wireCount} />
        <Stat label="Press Rows" value={pressCount} />
        <Stat label="Komax Rows" value={komaxCount} />
        <Stat label="Pin Map" value={pinMapCount} />
        <Stat label="Assembly Steps" value={stepCount} />
      </div>

      <div className="px-3 py-2 border-t border-gray-100 space-y-1">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">Flags</div>
        <Stat label="Total Flags" value={flagCount} />
        <Stat label="Unresolved" value={unresolvedCount} accent={unresolvedCount > 0} />
      </div>
    </div>
  );
}
