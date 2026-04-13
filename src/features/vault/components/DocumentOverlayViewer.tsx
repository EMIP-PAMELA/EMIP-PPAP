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
  REVISION: 'border-red-500 bg-red-500/10 text-red-700',
  PART_NUMBER: 'border-blue-500 bg-blue-500/10 text-blue-700',
  DRAWING_NUMBER: 'border-green-500 bg-green-500/10 text-green-700',
  TITLE_BLOCK: 'border-purple-500 bg-purple-500/10 text-purple-700',
  TABLE: 'border-orange-500 bg-orange-500/10 text-orange-700',
  UNKNOWN: 'border-gray-400 bg-gray-400/10 text-gray-600',
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
              return (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => handleRegionHover(region.id, true)}
                  onMouseEnter={() => handleRegionHover(region.id)}
                  onMouseLeave={() => handleRegionHover(activeRegionId ?? null)}
                  className={`absolute flex flex-col justify-between rounded-md border-2 text-xs font-semibold px-1.5 py-1 transition-shadow ${tone} ${focused ? 'shadow-lg shadow-black/40 scale-[1.01]' : 'opacity-80 hover:opacity-100'}`}
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: `${width}%`,
                    height: `${height}%`,
                  }}
                >
                  <span>{region.label.replace('_', ' ')}</span>
                  <span className="text-[10px] text-white/80">{Math.round(region.confidence * 100)}%</span>
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
      {resolvedRegionId && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Focused region: {resolvedRegionId}
        </div>
      )}
    </div>
  );
}
