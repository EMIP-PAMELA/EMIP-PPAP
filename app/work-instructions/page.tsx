/**
 * Work Instructions Page
 * Phase HWI.11.1 — Operator-Facing Instruction View
 */

'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import EMIPLayout from '../layout/EMIPLayout';
import type { HarnessInstructionJob } from '@/src/features/harness-work-instructions/types/harnessInstruction.schema';
import { buildProcessInstructions } from '@/src/features/harness-work-instructions/services/processInstructionService';
import type { ProcessInstructionBundle } from '@/src/features/harness-work-instructions/types/processInstructions';
import OperatorInstructionView from '@/src/features/harness-work-instructions/components/OperatorInstructionView';

function WorkInstructionsContent() {
  const [job, setJob] = useState<HarnessInstructionJob | null>(null);
  const [bundle, setBundle] = useState<ProcessInstructionBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skuContext, setSkuContext] = useState<{ partNumber: string; status: 'READY' | 'PARTIAL' } | null>(null);
  const searchParams = useSearchParams();
  const skuParam = searchParams.get('sku');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      console.log('[HWI OPERATOR VIEW LOADED]', { timestamp: new Date().toISOString(), skuParam });
      setLoading(true);
      setError(null);
      setSkuContext(null);

      try {
        if (skuParam) {
          const res = await fetch(`/api/sku/pipeline?part_number=${encodeURIComponent(skuParam)}`);
          const json = await res.json();
          if (!json.ok) throw new Error(json.error ?? 'Failed to load SKU instructions');
          if (cancelled) return;

          const status = (json.pipeline_status ?? 'PARTIAL') as 'READY' | 'PARTIAL';
          setSkuContext({ partNumber: skuParam.toUpperCase(), status });

          if (status === 'READY' && json.job && json.process_bundle) {
            setJob(json.job as HarnessInstructionJob);
            setBundle(json.process_bundle as ProcessInstructionBundle);
          } else {
            setJob(null);
            setBundle(null);
          }
        } else {
          const res = await fetch('/api/harness-instructions/extract-phase1', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({}),
          });
          const json = await res.json() as { ok: boolean; data?: HarnessInstructionJob };
          if (!cancelled && json.ok && json.data) {
            const loadedJob = json.data;
            const newBundle = buildProcessInstructions(loadedJob);
            setJob(loadedJob);
            setBundle(newBundle);
          } else if (!cancelled) {
            setJob(null);
            setBundle(null);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [skuParam]);

  return (
    <EMIPLayout>
      <div className="flex flex-col min-h-full">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Work Instructions</h1>
            <p className="text-sm text-gray-500 mt-0.5">Operator-ready setup and assembly guide · Read-only view</p>
            {skuContext && (
              <p className="text-xs text-gray-500 mt-2">
                SKU {skuContext.partNumber} · {skuContext.status === 'READY' ? 'Pipeline READY' : 'Awaiting documents'}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <a
              href="/harness-instructions"
              className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded transition-colors"
            >
              ← HWI Review
            </a>
            <a
              href="/sku"
              className="text-xs text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded transition-colors"
            >
              SKU Models
            </a>
          </div>
        </div>

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
            <p className="text-gray-700 font-medium text-lg">
              {skuParam ? 'Pipeline not ready yet.' : 'No harness loaded.'}
            </p>
            <p className="text-gray-400 text-sm text-center max-w-sm">
              {skuParam
                ? 'Upload both a BOM and drawing for this SKU in the SKU Models page, then refresh.'
                : 'Upload a BOM and drawing in the Harness Instructions review, then return here for the operator view.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {skuParam ? (
                <a
                  href={`/sku/${encodeURIComponent(skuParam)}`}
                  className="mt-3 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                >
                  Go to SKU →
                </a>
              ) : (
                <a
                  href="/harness-instructions"
                  className="mt-3 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                >
                  Go to Harness Instructions →
                </a>
              )}
            </div>
          </div>
        )}

        {!loading && !error && job && bundle && (
          <OperatorInstructionView job={job} bundle={bundle} />
        )}
      </div>
    </EMIPLayout>
  );
}

export default function WorkInstructionsPage() {
  return (
    <Suspense
      fallback={(
        <EMIPLayout>
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">
            ⏳ Loading work instructions…
          </div>
        </EMIPLayout>
      )}
    >
      <WorkInstructionsContent />
    </Suspense>
  );
}
