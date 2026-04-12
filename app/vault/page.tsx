'use client';

import { useEffect, useMemo, useState } from 'react';
import EMIPLayout from '../layout/EMIPLayout';
import VaultUploader from '@/src/features/vault/components/VaultUploader';
import VaultFilters, { type VaultFilterState } from '@/src/features/vault/components/VaultFilters';
import VaultDocumentTable from '@/src/features/vault/components/VaultDocumentTable';

interface VaultPageProps {
  searchParams?: {
    sku?: string;
    part?: string;
    issue?: string;
    filter?: string;
    sources?: string;
  };
}

const SOURCE_LABEL: Record<string, string> = {
  BOM: 'BOM',
  RHEEM: 'Customer Drawing (Rheem)',
  APOGEE: 'Apogee Drawing',
};

const ISSUE_SOURCE_TO_DOC_TYPE: Record<string, VaultFilterState['documentType']> = {
  BOM: 'BOM',
  RHEEM: 'CUSTOMER_DRAWING',
  APOGEE: 'INTERNAL_DRAWING',
};

export default function VaultPage({ searchParams }: VaultPageProps) {
  const skuQuery = searchParams?.part ?? searchParams?.sku;
  const skuParam = typeof skuQuery === 'string' && skuQuery.trim().length > 0
    ? decodeURIComponent(skuQuery)
    : undefined;
  const issueParamRaw = (searchParams?.issue ?? searchParams?.filter ?? '').toLowerCase();
  const issueType = issueParamRaw === 'missing' ? 'missing' : issueParamRaw === 'conflict' ? 'conflict' : undefined;
  const issueSources = typeof searchParams?.sources === 'string'
    ? searchParams.sources.split(',').map(source => source.trim().toUpperCase()).filter(Boolean)
    : undefined;
  const issueContext = issueType ? { type: issueType as 'missing' | 'conflict', sources: issueSources } : undefined;

  const [filters, setFilters] = useState<VaultFilterState>(() => ({
    sku: skuParam?.toUpperCase(),
  }));
  const [showUploader, setShowUploader] = useState(false);

  const displaySku = useMemo(() => filters.sku ?? skuParam, [filters.sku, skuParam]);

  useEffect(() => {
    const sources = issueContext?.sources;
    if (!sources?.length) return;
    setFilters(current => {
      const hasDocType = typeof current.documentType === 'string' && current.documentType.length > 0;
      if (hasDocType) {
        return current;
      }
      const mappedDocType = sources
        .map(source => ISSUE_SOURCE_TO_DOC_TYPE[source])
        .find((value): value is VaultFilterState['documentType'] => Boolean(value));
      if (!mappedDocType) {
        return current;
      }
      if (current.documentType === mappedDocType) {
        return current;
      }
      return { ...current, documentType: mappedDocType };
    });
  }, [issueContext]);

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

        {issueContext && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${issueContext.type === 'missing' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-800'}`}
          >
            <p className="font-semibold text-base mb-1">
              {issueContext.type === 'missing' ? 'Focused on missing revision sources' : 'Focused on conflicting revision sources'}
            </p>
            <p>
              {issueContext.sources?.length
                ? issueContext.sources.map(source => SOURCE_LABEL[source] ?? source).join(', ')
                : 'No specific sources provided.'}
            </p>
            <p className="text-xs mt-1 opacity-80">Opened via corrective action routing.</p>
          </div>
        )}

        {showUploader && <VaultUploader preselectedSku={displaySku} />}
        <VaultFilters value={filters} onChange={setFilters} />
        <VaultDocumentTable filters={filters} issueContext={issueContext} />
      </div>
    </EMIPLayout>
  );
}
