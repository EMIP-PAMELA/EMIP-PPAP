'use client';

import React from 'react';

export type VaultFilterState = {
  sku?: string;
  documentType?: 'BOM' | 'CUSTOMER_DRAWING' | 'INTERNAL_DRAWING' | '';
  status?: 'CURRENT' | 'OBSOLETE' | 'UNKNOWN' | '';
  classificationStatus?: 'PENDING' | 'PROCESSING' | 'PARTIAL' | 'PARTIAL_MISMATCH' | 'NEEDS_REVIEW' | 'RESOLVED' | '';
  search?: string;
};

interface VaultFiltersProps {
  value: VaultFilterState;
  onChange: (next: VaultFilterState) => void;
}

export default function VaultFilters({ value, onChange }: VaultFiltersProps) {
  const handleChange = (field: keyof VaultFilterState, nextValue: string) => {
    onChange({ ...value, [field]: nextValue });
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex-1 min-w-[160px] flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">SKU</span>
          <input
            type="text"
            value={value.sku ?? ''}
            placeholder="e.g. NH45-110858-01"
            onChange={event => handleChange('sku', event.target.value.toUpperCase())}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>

        <label className="flex-1 min-w-[140px] flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Document Type</span>
          <select
            value={value.documentType ?? ''}
            onChange={event => handleChange('documentType', event.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="">All Types</option>
            <option value="BOM">BOM</option>
            <option value="CUSTOMER_DRAWING">Customer Drawing</option>
            <option value="INTERNAL_DRAWING">Internal Drawing</option>
          </select>
        </label>

        <label className="flex-1 min-w-[140px] flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</span>
          <select
            value={value.status ?? ''}
            onChange={event => handleChange('status', event.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="">All Statuses</option>
            <option value="CURRENT">Current</option>
            <option value="OBSOLETE">Obsolete</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </label>

        <label className="flex-1 min-w-[160px] flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Classification Status</span>
          <select
            value={value.classificationStatus ?? ''}
            onChange={event => handleChange('classificationStatus', event.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="">All States</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="PARTIAL">Partial</option>
            <option value="PARTIAL_MISMATCH">Partial (Mismatch)</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </label>

        <label className="flex-1 min-w-[200px] flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Search</span>
          <input
            type="text"
            value={value.search ?? ''}
            placeholder="Filename or revision"
            onChange={event => handleChange('search', event.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
      </div>
    </div>
  );
}
