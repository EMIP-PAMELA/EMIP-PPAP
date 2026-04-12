'use client';

import { useMemo, useState } from 'react';
import EMIPLayout from '../layout/EMIPLayout';
import VaultUploader from '@/src/features/vault/components/VaultUploader';
import VaultFilters, { type VaultFilterState } from '@/src/features/vault/components/VaultFilters';
import VaultDocumentTable from '@/src/features/vault/components/VaultDocumentTable';

interface VaultPageProps {
  searchParams?: {
    sku?: string;
  };
}

export default function VaultPage({ searchParams }: VaultPageProps) {
  const skuParam = typeof searchParams?.sku === 'string' && searchParams.sku.trim().length > 0
    ? decodeURIComponent(searchParams.sku)
    : undefined;

  const [filters, setFilters] = useState<VaultFilterState>(() => ({
    sku: skuParam?.toUpperCase(),
  }));
  const [showUploader, setShowUploader] = useState(false);

  const displaySku = useMemo(() => filters.sku ?? skuParam, [filters.sku, skuParam]);

  return (
    <EMIPLayout>
      <div className="space-y-3 max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 whitespace-nowrap">Document Vault</h1>
            <span className="hidden sm:block text-sm text-gray-400">·</span>
            <p className="hidden sm:block text-sm text-gray-500 truncate">Classify, link, and manage BOMs &amp; drawings</p>
            {displaySku && (
              <span className="rounded-full bg-blue-50 px-3 py-0.5 text-xs font-semibold text-blue-700 whitespace-nowrap">
                SKU: {displaySku}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowUploader(v => !v)}
            className="shrink-0 rounded-xl bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            {showUploader ? 'Hide Uploader' : '+ Upload Files'}
          </button>
        </header>

        {showUploader && <VaultUploader preselectedSku={displaySku} />}
        <VaultFilters value={filters} onChange={setFilters} />
        <VaultDocumentTable filters={filters} />
      </div>
    </EMIPLayout>
  );
}
