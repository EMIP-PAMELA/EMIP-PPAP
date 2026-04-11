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

  const displaySku = useMemo(() => filters.sku ?? skuParam, [filters.sku, skuParam]);

  return (
    <EMIPLayout>
      <div className="space-y-8 max-w-6xl">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.4em] text-blue-500">Unified Ingestion</p>
          <h1 className="text-4xl font-bold text-gray-900">Document Vault</h1>
          <p className="text-gray-600 max-w-3xl">
            Drop any BOM or drawing. The vault classifies each document, attaches it to the correct SKU, and triggers the
            Harness Work Instruction pipeline using the existing ingestion service. No more separate upload flows.
          </p>
          {displaySku && (
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1 text-sm text-blue-700">
              <span className="font-semibold">SKU context:</span>
              <span>{displaySku}</span>
            </div>
          )}
        </header>

        <VaultUploader preselectedSku={displaySku} />
        <VaultFilters value={filters} onChange={setFilters} />
        <VaultDocumentTable filters={filters} />
      </div>
    </EMIPLayout>
  );
}
