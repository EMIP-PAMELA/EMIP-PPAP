'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import EMIPLayout from '../layout/EMIPLayout';
import type { SKURecord } from '@/src/features/harness-work-instructions/services/skuService';

interface CreateSKUForm {
  partNumber: string;
  description: string;
}

export default function SKUModelsPage() {
  const [skus, setSkus] = useState<SKURecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateSKUForm>({ partNumber: '', description: '' });

  async function fetchSKUs() {
    try {
      setLoading(true);
      const res = await fetch('/api/sku/list');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Failed to load SKUs');
      setSkus(json.skus);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSKUs();
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.partNumber.trim()) {
      setError('Part number is required');
      return;
    }
    try {
      setCreating(true);
      setError(null);
      const res = await fetch('/api/sku/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          part_number: form.partNumber,
          description: form.description,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Failed to create SKU');
      setForm({ partNumber: '', description: '' });
      await fetchSKUs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setCreating(false);
    }
  }

  return (
    <EMIPLayout>
      <div className="space-y-10">
        <header className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-widest text-blue-500">Phase HWI.13</p>
          <h1 className="text-3xl font-bold text-gray-900">SKU Model System</h1>
          <p className="text-gray-600 max-w-3xl">
            Persistent SKU vault for BOM + drawings. Store revisions once, mark the current source of truth, and
            launch the harness workflow without re-uploading documents every session.
          </p>
        </header>

        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Create New SKU</h2>
              <p className="text-sm text-gray-500">Assign a unique part number and optional description.</p>
            </div>
          </div>

          <form className="grid gap-4 md:grid-cols-3" onSubmit={handleCreate}>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-700">Part Number *</span>
              <input
                type="text"
                value={form.partNumber}
                onChange={(e) => setForm(prev => ({ ...prev, partNumber: e.target.value }))}
                className="rounded-xl border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="EG-12345"
              />
            </label>

            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-medium text-gray-700">Description</span>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                className="rounded-xl border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="24AWG engine harness"
              />
            </label>

            <button
              type="submit"
              disabled={creating}
              className="md:col-span-3 inline-flex items-center justify-center rounded-xl bg-blue-600 text-white font-semibold py-3 hover:bg-blue-700 transition disabled:opacity-60"
            >
              {creating ? 'Creating SKU...' : 'Create SKU'}
            </button>
          </form>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">SKU Vault</h2>
              <p className="text-sm text-gray-500">{loading ? 'Loading...' : `${skus.length} SKU(s)`}</p>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {loading && (
              <div className="px-6 py-8 text-center text-gray-500">Loading SKU inventory...</div>
            )}
            {!loading && skus.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500">No SKUs yet. Create the first one to begin.</div>
            )}
            {!loading && skus.map((sku) => (
              <div key={sku.id} className="px-6 py-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{sku.part_number}</p>
                  <p className="text-sm text-gray-600">{sku.description ?? 'No description provided'}</p>
                  <p className="text-xs text-gray-400">Last updated {new Date(sku.updated_at).toLocaleString()}</p>
                </div>
                <Link
                  href={`/sku/${encodeURIComponent(sku.part_number)}`}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
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
