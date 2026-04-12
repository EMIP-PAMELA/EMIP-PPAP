'use client';

import React from 'react';
import type { DocumentType } from '@/src/features/harness-work-instructions/services/skuService';
import type { RevisionValidationSource } from '@/src/types/revisionValidation';
import type { RevisionComparisonResult } from '@/src/utils/revisionComparator';

type ValidationState = 'unavailable' | 'matching' | 'warning' | 'conflict' | 'unknown';

export interface UploadRevisionValidation {
  state: ValidationState;
  comparison: RevisionComparisonResult | 'NO_EXPECTED';
  extractedRevision?: string | null;
  expectedRevision?: string | null;
  message: string;
  requiresOverride: boolean;
  docType?: DocumentType;
  canonicalSource?: string | null;
  validationSource?: RevisionValidationSource;
  validatedAt?: string | null;
}

interface UploadValidationBannerProps {
  validation: UploadRevisionValidation;
  overrideAccepted?: boolean;
  onOverrideToggle?: (accepted: boolean) => void;
  onOverrideConfirm?: () => void;
  disabled?: boolean;
}

const TONE: Record<ValidationState, { container: string; accent: string; icon: string }> = {
  matching: {
    container: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    accent: 'text-emerald-800',
    icon: '✅',
  },
  warning: {
    container: 'border-amber-200 bg-amber-50 text-amber-900',
    accent: 'text-amber-800',
    icon: '⚠️',
  },
  conflict: {
    container: 'border-red-200 bg-red-50 text-red-900',
    accent: 'text-red-800',
    icon: '🛑',
  },
  unknown: {
    container: 'border-gray-200 bg-gray-50 text-gray-800',
    accent: 'text-gray-700',
    icon: 'ℹ️',
  },
  unavailable: {
    container: 'border-gray-200 bg-gray-50 text-gray-800',
    accent: 'text-gray-700',
    icon: 'ℹ️',
  },
};

const SOURCE_LABEL: Record<string, string> = {
  BOM: 'BOM (Engineering Master)',
  APOGEE: 'Apogee Drawing',
  RHEEM: 'Rheem Drawing',
  GENERIC: 'Generic Text/Metadata',
};

function formatDocType(docType?: DocumentType): string | null {
  if (!docType || docType === 'UNKNOWN') return null;
  return docType.replace('_', ' ');
}

function formatCanonicalSource(source?: string | null): string | null {
  if (!source) return null;
  return SOURCE_LABEL[source.toUpperCase()] ?? source;
}

function formatValidationSource(source?: RevisionValidationSource): string | null {
  if (!source) return null;
  return SOURCE_LABEL[source] ?? source;
}

export default function UploadValidationBanner({
  validation,
  overrideAccepted = false,
  onOverrideToggle,
  onOverrideConfirm,
  disabled = false,
}: UploadValidationBannerProps) {
  const tone = TONE[validation.state];
  const docTypeLabel = formatDocType(validation.docType);
  const canonicalSourceLabel = formatCanonicalSource(validation.canonicalSource);
  const validationSourceLabel = formatValidationSource(validation.validationSource);

  return (
    <div className={`rounded-xl border px-3 py-3 text-xs shadow-sm ${tone.container}`}>
      <div className="flex items-start gap-2">
        <span aria-hidden className="text-lg">
          {tone.icon}
        </span>
        <div className="space-y-1">
          <p className={`text-sm font-semibold ${tone.accent}`}>{validation.message}</p>
          <div className="flex flex-wrap gap-4 text-[11px] text-gray-700">
            <span>
              <span className="font-semibold">Extracted:</span> {validation.extractedRevision ?? '—'}
            </span>
            <span>
              <span className="font-semibold">Expected:</span> {validation.expectedRevision ?? '—'}
            </span>
            {docTypeLabel && (
              <span>
                <span className="font-semibold">Document:</span> {docTypeLabel}
              </span>
            )}
            {canonicalSourceLabel && (
              <span>
                <span className="font-semibold">Canonical:</span> {canonicalSourceLabel}
              </span>
            )}
            {validationSourceLabel && (
              <span>
                <span className="font-semibold">Validation:</span> {validationSourceLabel}
              </span>
            )}
            {validation.validatedAt && (
              <span>
                <span className="font-semibold">Captured:</span> {new Date(validation.validatedAt).toLocaleString()}
              </span>
            )}
          </div>

          {validation.requiresOverride && (
            <div className="mt-2 space-y-2">
              <label className="flex items-start gap-2 text-[11px] text-gray-700">
                <input
                  type="checkbox"
                  className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  checked={overrideAccepted}
                  onChange={event => onOverrideToggle?.(event.target.checked)}
                />
                <span>I understand this mismatch and want to continue with this upload.</span>
              </label>
              <button
                type="button"
                disabled={!overrideAccepted || disabled}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onOverrideConfirm}
              >
                Continue anyway
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
