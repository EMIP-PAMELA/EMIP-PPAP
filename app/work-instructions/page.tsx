/**
 * Work Instructions Page
 * Phase HWI.11.1 — Operator-Facing Instruction View
 *
 * Loads the current harness job from the API, computes the
 * ProcessInstructionBundle, and renders the OperatorInstructionView.
 *
 * This is a read-only, shop-floor-usable page. Editing is done
 * in /harness-instructions.
 *
 * Log prefixes:
 *   [HWI OPERATOR VIEW LOADED]
 *   [HWI READINESS STATUS]
 */

'use client';

import React, { useEffect, useState } from 'react';
import EMIPLayout from '../layout/EMIPLayout';
import type { HarnessInstructionJob } from '@/src/features/harness-work-instructions/types/harnessInstruction.schema';
import { buildProcessInstructions } from '@/src/features/harness-work-instructions/services/processInstructionService';
import type { ProcessInstructionBundle } from '@/src/features/harness-work-instructions/types/processInstructions';
import OperatorInstructionView from '@/src/features/harness-work-instructions/components/OperatorInstructionView';

export default function WorkInstructionsPage() {
  const [job,     setJob]     = useState<HarnessInstructionJob    | null>(null);
  const [bundle,  setBundle]  = useState<ProcessInstructionBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    console.log('[HWI OPERATOR VIEW LOADED]', { timestamp: new Date().toISOString() });

    fetch('/api/harness-instructions/extract-phase1', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({}),
    })
      .then(r => r.json())
      .then((json: { ok: boolean; data?: HarnessInstructionJob }) => {
        if (json.ok && json.data) {
          const loadedJob  = json.data;
          const newBundle  = buildProcessInstructions(loadedJob);
          const isReady    = newBundle.engineering_notes.every(n => n.severity === 'info');
          setJob(loadedJob);
          setBundle(newBundle);
          console.log('[HWI READINESS STATUS]', {
            status:          isReady ? 'READY' : 'REVIEW_REQUIRED',
            part_number:     loadedJob.metadata.part_number,
            revision:        loadedJob.metadata.revision,
            review_required: newBundle.engineering_notes.filter(n => n.severity === 'review_required').length,
            warnings:        newBundle.engineering_notes.filter(n => n.severity === 'warning').length,
          });
        }
        // If json.ok === false or no data, leave job null → show "no harness" message
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <EMIPLayout>
      <div className="flex flex-col min-h-full">

        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Work Instructions</h1>
            <p className="text-sm text-gray-500 mt-0.5">Operator-ready setup and assembly guide · Read-only view</p>
          </div>
          <a
            href="/harness-instructions"
            className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded transition-colors"
          >
            ← HWI Review
          </a>
        </div>

        {/* States */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">
            ⏳ Loading instruction set…
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center py-20 text-sm text-red-500">
            Error: {error}
          </div>
        )}

        {!loading && !error && (!job || !bundle) && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <span className="text-5xl">🧾</span>
            <p className="text-gray-700 font-medium text-lg">No harness loaded.</p>
            <p className="text-gray-400 text-sm text-center max-w-sm">
              Upload a BOM and drawing in the Harness Instructions review, then return here for the operator view.
            </p>
            <a
              href="/harness-instructions"
              className="mt-3 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
            >
              Go to Harness Instructions →
            </a>
          </div>
        )}

        {!loading && !error && job && bundle && (
          <OperatorInstructionView job={job} bundle={bundle} />
        )}

      </div>
    </EMIPLayout>
  );
}
