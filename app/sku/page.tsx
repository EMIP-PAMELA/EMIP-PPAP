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
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/sku/list');
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? 'Failed to load SKUs');
        setSkus(json.skus);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <EMIPLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-widest text-blue-500">Phase HWI.13</p>
          <h1 className="text-3xl font-bold text-gray-900">SKU Vault</h1>
          <p className="text-gray-600 max-w-3xl">
            Persistent SKU registry built from uploaded documents. Upload a BOM or drawing to automatically
            create or match an SKU — no manual entry required.
          </p>
        </header>

        <div className="flex gap-3">
          <Link
            href="/upload/bom"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white font-semibold px-5 py-2.5 hover:bg-blue-700 transition text-sm"
          >
            📄 Upload BOM
          </Link>
          <Link
            href="/upload/drawing"
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
            {!loading && skus.map((sku) => (
              <div
                key={sku.id}
                className="px-6 py-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-base font-semibold text-gray-900">{sku.part_number}</p>
                  <p className="text-sm text-gray-500">{sku.description ?? 'No description'}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {sku.created_from && (
                      <span className="text-xs rounded-full bg-gray-100 text-gray-600 px-2 py-0.5">
                        {SOURCE_LABEL[sku.created_from] ?? sku.created_from}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      Updated {new Date(sku.updated_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/sku/${encodeURIComponent(sku.part_number)}`}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Open
                </Link>
              </div>
            ))}
          </div>
        </section>
      </div>
    </EMIPLayout>
  );
}
