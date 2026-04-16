'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DocumentClassificationStatus } from '@/src/features/harness-work-instructions/services/skuService';

interface VaultCorrectionPanelProps {
  documentId: string;
  classificationStatus: DocumentClassificationStatus;
  inferredPartNumber: string | null;
  drawingNumber: string | null;
  skuPartNumber: string | null;
}

interface ActionMessage {
  type: 'success' | 'error';
  text: string;
}

export function VaultCorrectionPanel({
  documentId,
  classificationStatus,
  inferredPartNumber,
  drawingNumber,
  skuPartNumber,
}: VaultCorrectionPanelProps) {
  const router = useRouter();
  const [partNumberInput, setPartNumberInput] = useState<string>(inferredPartNumber ?? skuPartNumber ?? '');
  const [linkSkuInput, setLinkSkuInput] = useState<string>(skuPartNumber ?? '');
  const [aliasPartNumber, setAliasPartNumber] = useState<string>(inferredPartNumber ?? skuPartNumber ?? '');
  const [feedback, setFeedback] = useState<ActionMessage | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const isBusy = (action: string) => activeAction === action;

  const triggerAction = async (action: string, payload?: Record<string, string>) => {
    setActiveAction(action);
    setFeedback(null);
    try {
      const res = await fetch(`/api/vault/document/${documentId}/correction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? 'Unable to complete correction');
      }
      setFeedback({ type: 'success', text: json.message ?? 'Correction applied successfully.' });
      router.refresh();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Correction failed' });
    } finally {
      setActiveAction(null);
    }
  };

  const disableAliasSave = !drawingNumber || !aliasPartNumber.trim();

  return (
    <div className="space-y-4 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Guided Correction</p>
          <h2 className="text-lg font-bold text-[color:var(--text-primary)]">Self-Healing Workspace</h2>
        </div>
        <div className="text-xs text-gray-500">Status: {classificationStatus}</div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl px-4 py-2 text-sm ${
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Part Number</p>
          <input
            type="text"
            value={partNumberInput}
            onChange={event => setPartNumberInput(event.target.value.toUpperCase())}
            placeholder="Enter confirmed part number"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={() => triggerAction('apply_part_number', { partNumber: partNumberInput })}
            disabled={!partNumberInput.trim() || isBusy('apply_part_number')}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy('apply_part_number') ? 'Applying…' : 'Apply Part Number'}
          </button>
          <p className="text-[11px] text-gray-500">Stores operator-confirmed value and re-runs classification/linking.</p>
        </div>

        <div className="space-y-2 rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Link to SKU</p>
          <input
            type="text"
            value={linkSkuInput}
            onChange={event => setLinkSkuInput(event.target.value.toUpperCase())}
            placeholder="Existing SKU part number"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={() => triggerAction('link_sku', { partNumber: linkSkuInput })}
            disabled={!linkSkuInput.trim() || isBusy('link_sku')}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy('link_sku') ? 'Linking…' : 'Link to SKU'}
          </button>
          <p className="text-[11px] text-gray-500">Resolves existing SKU and attaches this document without creating new SKUs.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Drawing Alias</p>
            {!drawingNumber && <span className="text-[10px] text-red-500">No drawing number on record</span>}
          </div>
          <input
            type="text"
            value={aliasPartNumber}
            onChange={event => setAliasPartNumber(event.target.value.toUpperCase())}
            placeholder="Part number for this drawing"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={() => triggerAction('save_alias', { partNumber: aliasPartNumber, drawingNumber: drawingNumber ?? '' })}
            disabled={disableAliasSave || isBusy('save_alias')}
            className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy('save_alias') ? 'Saving…' : 'Save Drawing Alias'}
          </button>
          <p className="text-[11px] text-gray-500">Confirms alias mapping for future automated linking.</p>
        </div>

        <div className="space-y-3 rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Re-run Pipelines</p>
          <button
            type="button"
            onClick={() => triggerAction('reprocess')}
            disabled={isBusy('reprocess')}
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy('reprocess') ? 'Reprocessing…' : 'Re-run Classification & Linking'}
          </button>
          <p className="text-[11px] text-gray-500">
            Safely replays the existing classification + linking flow using the latest signals.
          </p>
        </div>
      </div>
    </div>
  );
}
