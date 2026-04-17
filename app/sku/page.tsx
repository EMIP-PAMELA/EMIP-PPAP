'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import EMIPLayout from '../layout/EMIPLayout';
import type { SKURecord } from '@/src/features/harness-work-instructions/services/skuService';

const SOURCE_LABEL: Record<string, string> = {
  CUSTOMER_DRAWING: 'Customer Drawing',
  INTERNAL_DRAWING: 'Internal Drawing',
  BOM: 'BOM',
};

export default function SKUModelsPage() {
  const [skus, setSkus] = useState<SKURecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/sku')
      .then(res => res.json())
      .then(json => {
        if (cancelled) return;
        if (json?.ok === false) {
          throw new Error(json.error ?? 'Failed to load SKUs');
        }
        setSkus(Array.isArray(json?.skus) ? json.skus : []);
        setError(null);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setSkus([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  console.log('[T23.7 SKU VAULT RENDER]', { skuCount: skus.length, loading });

  return (
    <EMIPLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gray-900">SKU Vault</h1>
          <p className="text-gray-600 max-w-3xl">
            Persistent SKU registry built from uploaded documents. Upload a BOM or drawing to automatically
            create or match an SKU — no manual entry required.
          </p>
        </header>

        <div className="flex gap-3">
          <Link
            href="/vault?docType=BOM&actionIntent=UPLOAD_MISSING_DOC"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white font-semibold px-5 py-2.5 hover:bg-blue-700 transition text-sm"
          >
            📄 Upload BOM
          </Link>
          <Link
            href="/vault?docType=CUSTOMER_DRAWING&actionIntent=UPLOAD_MISSING_DOC"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 text-white font-semibold px-5 py-2.5 hover:bg-indigo-700 transition text-sm"
          >
            📐 Upload Drawing
          </Link>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">SKU Index</h2>
            <p className="text-sm text-gray-500">{loading ? 'Loading…' : `${skus.length} SKU(s) in vault`}</p>
          </div>

          <div className="divide-y divide-gray-100">
            {loading && (
              <div className="px-6 py-10 text-center text-gray-400">Loading SKU inventory…</div>
            )}
            {!loading && skus.length === 0 && (
              <div className="px-6 py-10 text-center text-gray-400">
                No SKUs yet. Upload a BOM or drawing to begin.
              </div>
            )}
            {!loading && skus.map((sku) => {
              const normalizedType = sku.created_from ?? 'UNKNOWN';
              const typeLabel = SOURCE_LABEL[normalizedType] ?? 'Unknown Source';
              const statusLabel = sku.created_from
                ? `Document source: ${typeLabel}`
                : 'Awaiting authoritative document';
              const updatedLabel = new Date(sku.updated_at).toLocaleString();

              return (
                <div
                  key={sku.id}
                  className="px-6 py-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-base font-semibold text-gray-900">{sku.part_number}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs rounded-full bg-gray-100 text-gray-600 px-2 py-0.5">
                        {typeLabel}
                      </span>
                      <span className="text-xs text-gray-400">
                        Last updated {updatedLabel}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{statusLabel}</p>
                  </div>
                  <Link
                    href={`/sku/${encodeURIComponent(sku.part_number)}`}
                    className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Open
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </EMIPLayout>
  );
}
