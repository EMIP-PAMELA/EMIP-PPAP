/**
 * Harness Work Instruction Generator — Review Questions Panel
 * Phase HWI.3 — Review UI
 *
 * Displays open questions for human reviewer with editable answers
 * and a resolved toggle.
 */

'use client';

import React from 'react';
import type { ReviewQuestion } from '../types/harnessInstruction.schema';

interface ReviewQuestionsTabProps {
  questions: ReviewQuestion[];
  onUpdate: (id: string, answer: string | null, resolved: boolean) => void;
}

export default function ReviewQuestionsTab({ questions, onUpdate }: ReviewQuestionsTabProps) {
  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-400">
        <div className="text-2xl mb-1">✅</div>
        <div className="text-sm">No review questions</div>
      </div>
    );
  }

  const unresolved = questions.filter(q => !q.resolved);
  const resolved   = questions.filter(q => q.resolved);

  return (
    <div className="p-4 space-y-3 overflow-auto h-full">
      {unresolved.length > 0 && (
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
            Open Questions ({unresolved.length})
          </div>
          <div className="space-y-3">
            {unresolved.map((q, i) => (
              <div
                key={q.id}
                id={`review_questions-${i}`}
                className="border border-orange-200 bg-orange-50 rounded-lg p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono text-orange-400 mt-0.5 flex-shrink-0">{q.id}</span>
                    <p className="text-sm text-gray-800 leading-snug">{q.prompt}</p>
                  </div>
                </div>
                <div className="flex gap-2 items-end">
                  <textarea
                    value={q.answer ?? ''}
                    placeholder="Enter answer..."
                    rows={2}
                    onChange={e => onUpdate(q.id, e.target.value || null, q.resolved)}
                    className="flex-1 text-sm border border-orange-200 rounded px-2 py-1.5 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <button
                    onClick={() => onUpdate(q.id, q.answer, true)}
                    disabled={!q.answer?.trim()}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex-shrink-0 ${
                      q.answer?.trim()
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Mark Resolved
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
            Resolved ({resolved.length})
          </div>
          <div className="space-y-2">
            {resolved.map(q => (
              <div
                key={q.id}
                className="border border-gray-100 bg-gray-50 rounded-lg p-3 opacity-70"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="text-green-500 text-xs mt-0.5">✓</span>
                    <div>
                      <p className="text-xs text-gray-500 line-through leading-snug">{q.prompt}</p>
                      {q.answer && (
                        <p className="text-xs text-gray-700 mt-1 bg-white border border-gray-100 rounded px-2 py-1">
                          {q.answer}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onUpdate(q.id, q.answer, false)}
                    className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0"
                  >
                    Reopen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
