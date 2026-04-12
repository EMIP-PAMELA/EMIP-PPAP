'use client';

import { useEffect, useMemo, useState } from 'react';
import EMIPLayout from '../layout/EMIPLayout';
import VaultUploader from '@/src/features/vault/components/VaultUploader';
import VaultFilters, { type VaultFilterState } from '@/src/features/vault/components/VaultFilters';
import VaultDocumentTable from '@/src/features/vault/components/VaultDocumentTable';
import CorrectiveContextBanner from '@/src/components/CorrectiveContextBanner';
import { deriveIssueKind, parseActionIntentParam } from '@/src/features/revision/utils/correctiveIntent';
import type { ActionIntent } from '@/src/features/revision/hooks/useRecommendedFixActions';

interface VaultPageProps {
  searchParams?: {
    sku?: string;
    part?: string;
    issue?: string;
    filter?: string;
    sources?: string;
    docType?: string;
    source?: string;
    actionIntent?: string;
    expectedRevision?: string;
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

const DOC_TYPE_ALIAS: Record<string, VaultFilterState['documentType']> = {
  BOM: 'BOM',
  'BOM_DRAWING': 'BOM',
  CUSTOMER: 'CUSTOMER_DRAWING',
  CUSTOMER_DRAWING: 'CUSTOMER_DRAWING',
  RHEEM: 'CUSTOMER_DRAWING',
  INTERNAL: 'INTERNAL_DRAWING',
  INTERNAL_DRAWING: 'INTERNAL_DRAWING',
  APOGEE: 'INTERNAL_DRAWING',
  APOGEE_DRAWING: 'INTERNAL_DRAWING',
};

function parseDocTypeParam(value?: string | null, fallback?: VaultFilterState['documentType']): VaultFilterState['documentType'] | undefined {
  if (value && value.trim()) {
    const key = value.trim().toUpperCase();
    if (DOC_TYPE_ALIAS[key]) return DOC_TYPE_ALIAS[key];
  }
  return fallback;
}

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
  const derivedDocTypeFromSources = issueSources?.map(source => ISSUE_SOURCE_TO_DOC_TYPE[source]).find((val): val is VaultFilterState['documentType'] => Boolean(val));
  const expectedRevisionParam = searchParams?.expectedRevision?.trim();
  const expectedRevisionHint = expectedRevisionParam ? expectedRevisionParam.toUpperCase() : null;
  const canonicalSourceParam = searchParams?.source?.trim();
  const canonicalSourceHint = canonicalSourceParam ? canonicalSourceParam.toUpperCase() : null;
  const actionIntent = parseActionIntentParam(searchParams?.actionIntent ?? null);
  const derivedIssueKind = deriveIssueKind(actionIntent);
  const docTypeParam = parseDocTypeParam(searchParams?.docType, derivedDocTypeFromSources);
  const issueContext = issueType
    ? {
        type: issueType as 'missing' | 'conflict',
        sources: issueSources,
        docType: docTypeParam,
        actionIntent,
        expectedRevision: expectedRevisionHint,
      }
    : undefined;

  const [filters, setFilters] = useState<VaultFilterState>(() => ({
    sku: skuParam?.toUpperCase(),
    documentType: docTypeParam,
  }));
  const [showUploader, setShowUploader] = useState<boolean>(() => Boolean(issueType === 'missing' || actionIntent === 'UPLOAD_MISSING_DOC'));
  const autoOpenUploader = actionIntent === 'UPLOAD_MISSING_DOC' || issueType === 'missing';

  const displaySku = useMemo(() => filters.sku ?? skuParam, [filters.sku, skuParam]);
  const hasPrefilledFilters = Boolean(skuParam || docTypeParam);

  useEffect(() => {
    if (!docTypeParam) return;
    setFilters(current => (current.documentType === docTypeParam ? current : { ...current, documentType: docTypeParam }));
  }, [docTypeParam]);

  useEffect(() => {
    if (!autoOpenUploader) return;
    setShowUploader(true);
  }, [autoOpenUploader]);

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

        {actionIntent && (
          <CorrectiveContextBanner
            intent={actionIntent}
            partNumber={displaySku}
            docType={docTypeParam}
            expectedRevision={expectedRevisionHint}
            issueType={derivedIssueKind ?? issueType}
            canonicalSource={canonicalSourceHint}
            location="vault"
          />
        )}

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
            {issueContext.docType && (
              <p className="text-xs mt-1">Document type filtered to {issueContext.docType.replace('_', ' ')}.</p>
            )}
            {expectedRevisionHint && (
              <p className="text-xs mt-1 font-semibold">Expected revision: {expectedRevisionHint}</p>
            )}
            <p className="text-xs mt-1 opacity-80">Opened via corrective action routing.</p>
          </div>
        )}

        {showUploader && (
          <VaultUploader
            preselectedSku={displaySku}
            docTypeHint={docTypeParam}
            expectedRevisionHint={expectedRevisionHint}
            actionIntent={actionIntent}
            canonicalSourceHint={canonicalSourceHint}
          />
        )}

        {hasPrefilledFilters && (
          <p className="text-xs font-semibold text-blue-700">Filters prefilled from corrective workflow — adjust if needed.</p>
        )}
        <VaultFilters value={filters} onChange={setFilters} />
        <VaultDocumentTable
          filters={filters}
          issueContext={issueContext}
          prefillContext={(docTypeParam || expectedRevisionHint || actionIntent) ? {
            docType: docTypeParam,
            expectedRevision: expectedRevisionHint,
            actionIntent,
          } : undefined}
        />
      </div>
    </EMIPLayout>
  );
}
