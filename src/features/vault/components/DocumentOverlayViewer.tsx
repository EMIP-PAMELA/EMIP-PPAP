'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { RegionOverlay } from '@/src/features/harness-work-instructions/types/documentRegionOverlay';
import { renderPdfToImage } from '@/src/utils/renderPdfToImage';

interface DocumentOverlayViewerProps {
  file?: File;
  fileUrl?: string | null;
  regions: RegionOverlay[];
  activeRegionId?: string | null;
  onRegionFocus?: (regionId: string | null) => void;
}

const REGION_COLORS: Record<RegionOverlay['label'], string> = {
  REVISION:           'border-red-500 bg-red-500/10 text-red-700',
  PART_NUMBER:        'border-blue-500 bg-blue-500/10 text-blue-700',
  DRAWING_NUMBER:     'border-green-500 bg-green-500/10 text-green-700',
  TITLE_BLOCK:        'border-purple-500 bg-purple-500/10 text-purple-700',
  TABLE:              'border-orange-500 bg-orange-500/10 text-orange-700',
  UNKNOWN:            'border-gray-400 bg-gray-400/10 text-gray-600',
  /** C12: region-aware title block (distinct from generic TITLE_BLOCK) */
  TITLE_BLOCK_REGION: 'border-violet-600 bg-violet-600/10 text-violet-800',
  /** C12: region-aware revision record (distinct from generic REVISION) */
  REVISION_REGION:    'border-rose-600 bg-rose-600/10 text-rose-800',
};

const ORIENTATION_BADGE: Record<string, string> = {
  VERTICAL:   'bg-indigo-100 text-indigo-700',
  HORIZONTAL: 'bg-sky-100 text-sky-700',
  UNKNOWN:    'bg-gray-100 text-gray-500',
};

const FIELD_BADGE_COLOR: Record<string, string> = {
  PART_NUMBER:    'bg-blue-100 text-blue-800',
  REVISION:       'bg-red-100 text-red-800',
  DRAWING_NUMBER: 'bg-green-100 text-green-800',
};

export default function DocumentOverlayViewer({
  file,
  fileUrl,
  regions,
  activeRegionId,
  onRegionFocus,
}: DocumentOverlayViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedRegionId, setResolvedRegionId] = useState<string | null>(activeRegionId ?? null);

  useEffect(() => {
    setResolvedRegionId(activeRegionId ?? null);
  }, [activeRegionId]);

  const pdfSource = useMemo(() => {
    if (file) return URL.createObjectURL(file);
    return fileUrl ?? null;
  }, [file, fileUrl]);

  useEffect(() => {
    if (!pdfSource) {
      setImageUrl(null);
      setError('No PDF source available');
      return;
    }
    let revoked = false;
    let cancelled = false;
    const source = pdfSource;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const img = await renderPdfToImage(source);
        if (!cancelled) {
          setImageUrl(img);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render PDF');
          setImageUrl(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
      if (file && source && !revoked) {
        URL.revokeObjectURL(source);
        revoked = true;
      }
    };
  }, [pdfSource, file]);

  const handleRegionHover = (regionId: string | null, persist = false) => {
    setResolvedRegionId(regionId);
    if (persist) {
      onRegionFocus?.(regionId);
    }
  };

  const focusedRegion = regions.find(r => r.id === resolvedRegionId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      {loading && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          Rendering first page…
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Unable to render PDF overlay: {error}
        </div>
      )}
      <div className="relative rounded-xl border border-gray-200 bg-gray-900 overflow-hidden min-h-[300px]">
        {imageUrl ? (
          <>
            <img src={imageUrl} alt="Document preview" className="block w-full h-auto object-contain" />
            {regions.map(region => {
              const left = region.boundingBox.x * 100;
              const top = region.boundingBox.y * 100;
              const width = region.boundingBox.width * 100;
              const height = region.boundingBox.height * 100;
              const tone = REGION_COLORS[region.label] ?? REGION_COLORS.UNKNOWN;
              const focused = resolvedRegionId === region.id;
              const isUsed = (region.usedForField?.length ?? 0) > 0;
              return (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => handleRegionHover(region.id, true)}
                  onMouseEnter={() => handleRegionHover(region.id)}
                  onMouseLeave={() => handleRegionHover(activeRegionId ?? null)}
                  className={`absolute flex flex-col justify-between rounded-md border-2 text-xs font-semibold px-1.5 py-1 transition-shadow ${tone} ${focused ? 'shadow-lg shadow-black/40 scale-[1.01]' : 'opacity-80 hover:opacity-100'} ${isUsed ? 'ring-2 ring-emerald-400' : ''}`}
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: `${width}%`,
                    height: `${height}%`,
                  }}
                >
                  <span className="truncate">{region.label.replace(/_/g, ' ')}</span>
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    <span className="text-[9px] opacity-70">{Math.round(region.confidence * 100)}%</span>
                    {region.orientation && region.orientation !== 'UNKNOWN' && (
                      <span className={`text-[9px] rounded px-0.5 font-bold ${ORIENTATION_BADGE[region.orientation]}`}>
                        {region.orientation === 'VERTICAL' ? '↕V' : '↔H'}
                      </span>
                    )}
                    {isUsed && (
                      <span className="text-[9px] rounded px-0.5 bg-emerald-200 text-emerald-800 font-bold">★</span>
                    )}
                  </div>
                </button>
              );
            })}
          </>
        ) : (
          <div className="flex h-80 items-center justify-center text-sm text-gray-300">
            {!loading && !error
              ? regions.length === 0
                ? 'No overlay regions available'
                : 'No preview available'
              : null}
          </div>
        )}
      </div>

      {/* Phase 3H.43.Y: Focused region detail panel */}
      {focusedRegion && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 space-y-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${REGION_COLORS[focusedRegion.label]}`}>
              {focusedRegion.label.replace(/_/g, ' ')}
            </span>
            {focusedRegion.orientation && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ORIENTATION_BADGE[focusedRegion.orientation] ?? ORIENTATION_BADGE.UNKNOWN}`}>
                {focusedRegion.orientation}
              </span>
            )}
            <span className="text-gray-500 text-[10px]">
              conf: {Math.round(focusedRegion.confidence * 100)}%
              {focusedRegion.authority !== undefined && (
                <> · auth: {Math.round(focusedRegion.authority * 100)}%</>
              )}
            </span>
            <span className="text-gray-400 text-[10px]">src: {focusedRegion.source}</span>
          </div>

          {/* Used-for-field indicators */}
          {(focusedRegion.usedForField?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] font-semibold text-emerald-700">Used for:</span>
              {focusedRegion.usedForField!.map(f => (
                <span key={f} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${FIELD_BADGE_COLOR[f] ?? 'bg-gray-100 text-gray-700'}`}>
                  {f.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          {/* Raw OCR text */}
          {focusedRegion.extractedText && (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 mb-0.5">Raw OCR text:</div>
              <pre className="text-[10px] text-gray-700 bg-white rounded border border-gray-200 px-2 py-1.5 whitespace-pre-wrap break-words max-h-32 overflow-y-auto font-mono">
                {focusedRegion.extractedText.slice(0, 400)}
              </pre>
            </div>
          )}

          {/* Normalized text (Phase 3H.43.Y) */}
          {focusedRegion.normalizedText && (
            <div>
              <div className="text-[10px] font-semibold text-indigo-600 mb-0.5">Normalized (vertical → horizontal):</div>
              <pre className="text-[10px] text-indigo-800 bg-indigo-50 rounded border border-indigo-200 px-2 py-1.5 whitespace-pre-wrap break-words max-h-24 overflow-y-auto font-mono">
                {focusedRegion.normalizedText.slice(0, 300)}
              </pre>
            </div>
          )}

          <div className="text-[10px] text-gray-400">
            box: ({focusedRegion.boundingBox.x.toFixed(2)}, {focusedRegion.boundingBox.y.toFixed(2)}) · {(focusedRegion.boundingBox.width * 100).toFixed(0)}%w × {(focusedRegion.boundingBox.height * 100).toFixed(0)}%h
          </div>
        </div>
      )}
    </div>
  );
}
