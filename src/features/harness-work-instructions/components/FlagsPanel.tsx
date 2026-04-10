/**
 * Harness Work Instruction Generator — Flags Panel (Right Panel)
 * Phase HWI.3 — Review UI
 *
 * Displays all engineering flags with severity color coding.
 * Clicking a flag triggers tab navigation + scroll to the relevant row.
 */

'use client';

import React from 'react';
import type { EngineeringFlag } from '../types/harnessInstruction.schema';

interface FlagsPanelProps {
  flags: EngineeringFlag[];
  onFlagClick: (flag: EngineeringFlag) => void;
}

const FLAG_STYLE: Record<string, { card: string; badge: string; dot: string }> = {
  error:           { card: 'border-red-200 bg-red-50',    badge: 'bg-red-100 text-red-700',    dot: 'bg-red-500' },
  warning:         { card: 'border-amber-200 bg-amber-50', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  review_required: { card: 'border-orange-200 bg-orange-50', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  info:            { card: 'border-blue-200 bg-blue-50',   badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400' },
};

const FLAG_LABEL: Record<string, string> = {
  error:           'Error',
  warning:         'Warning',
  review_required: 'Review',
  info:            'Info',
};

export default function FlagsPanel({ flags, onFlagClick }: FlagsPanelProps) {
  const unresolved = flags.filter(f => !f.resolved);
  const resolved   = flags.filter(f => f.resolved);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <div className="text-xs text-gray-400 uppercase tracking-wider">Flags</div>
        <div className="flex gap-3 mt-1 text-xs">
          <span className="text-red-600 font-medium">{unresolved.length} unresolved</span>
          <span className="text-gray-400">{resolved.length} resolved</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {flags.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <div className="text-2xl mb-1">✅</div>
            <div className="text-xs">No flags</div>
          </div>
        )}

        {unresolved.length > 0 && (
          <div className="px-2 pt-2 pb-1">
            <div className="text-xs text-gray-400 uppercase tracking-wider px-1 mb-1.5">Unresolved</div>
            <div className="space-y-1.5">
              {unresolved.map(flag => {
                const style = FLAG_STYLE[flag.flag_type] ?? FLAG_STYLE.info;
                return (
                  <button
                    key={flag.flag_id}
                    onClick={() => onFlagClick(flag)}
                    className={`w-full text-left border rounded-md p-2 transition-opacity hover:opacity-80 ${style.card}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${style.badge}`}>
                        {FLAG_LABEL[flag.flag_type] ?? flag.flag_type}
                      </span>
                      {flag.field_ref && (
                        <span className="text-xs font-mono text-gray-400 truncate">{flag.field_ref}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-700 leading-snug">{flag.message}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {resolved.length > 0 && (
          <div className="px-2 pt-2 pb-2">
            <div className="text-xs text-gray-400 uppercase tracking-wider px-1 mb-1.5">Resolved</div>
            <div className="space-y-1.5">
              {resolved.map(flag => (
                <div
                  key={flag.flag_id}
                  className="border border-gray-100 bg-gray-50 rounded-md p-2 opacity-60"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-green-500 text-xs">✓</span>
                    {flag.field_ref && (
                      <span className="text-xs font-mono text-gray-400 truncate">{flag.field_ref}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 leading-snug line-through">{flag.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
