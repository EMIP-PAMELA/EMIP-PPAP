/**
 * Signal Resolution Engine — Phase 3H.18
 *
 * Central authority for determining canonical revision and drawing_number.
 *
 * Governance:
 *   - NO field may degrade: a non-null value is NEVER overwritten by null.
 *   - A stronger signal NEVER loses to a weaker one.
 *   - All resolution paths must pass through resolveSignal / resolveDocumentSignals.
 *
 * Signal priority (descending):
 *   TITLE_BLOCK — structured extractor (Apogee revision box, Rheem title block, EM header)
 *   TEXT        — generic pattern match within document body
 *   FILENAME    — derived from the filename stem
 *   AI          — model inference (not yet active)
 *   NONE        — no signal; value is null
 */

export type SignalSource = 'TITLE_BLOCK' | 'TEXT' | 'FILENAME' | 'AI' | 'NONE';

export interface Signal<T> {
  value: T | null;
  source: SignalSource;
}

export const SIGNAL_PRIORITY: Record<SignalSource, number> = {
  TITLE_BLOCK: 4,
  TEXT: 3,
  FILENAME: 3,
  AI: 2,
  NONE: 0,
};

/**
 * Select the highest-priority non-null signal.
 * When two signals share the same priority, the one appearing earlier in the
 * input array wins (stable: matches TITLE_BLOCK > TEXT > FILENAME > AI intent).
 */
export function resolveSignal<T>(signals: Signal<T>[]): Signal<T> {
  const candidate = signals
    .filter(s => s.value !== null && s.value !== undefined)
    .sort((a, b) => SIGNAL_PRIORITY[b.source] - SIGNAL_PRIORITY[a.source])[0];
  return candidate ?? { value: null, source: 'NONE' };
}

/**
 * Determine whether an incoming value should overwrite an existing one.
 *
 * Rules:
 *   - Always write when existing is null/undefined.
 *   - Never write when incoming is null/undefined.
 *   - Otherwise write only if incoming source priority ≥ existing source priority.
 */
export function shouldOverwrite<T>(params: {
  existing: T | null | undefined;
  incoming: T | null | undefined;
  existingSource: SignalSource;
  incomingSource: SignalSource;
}): boolean {
  const { existing, incoming, existingSource, incomingSource } = params;
  if (existing === null || existing === undefined) return true;
  if (incoming === null || incoming === undefined) return false;
  return SIGNAL_PRIORITY[incomingSource] >= SIGNAL_PRIORITY[existingSource];
}

// ---------------------------------------------------------------------------
// Document-level resolution
// ---------------------------------------------------------------------------

export interface DocumentSignalInput {
  /** Revision from a structured title-block extractor (Apogee box / Rheem block / EM header). */
  titleBlockRevision?: string | null;
  /** Revision from generic regex search within document text. */
  textRevision?: string | null;
  /** Revision parsed from the filename stem. */
  filenameRevision?: string | null;
  /** Revision from an AI/model inference step (not yet active). */
  aiRevision?: string | null;

  /** Drawing number from Engineering Master identifier extraction (BOM header). */
  emDrawingNumber?: string | null;
  /** Drawing number found via regex within document text. */
  textDrawingNumber?: string | null;
  /** Drawing number parsed from the filename stem. */
  filenameDrawingNumber?: string | null;
  /** Drawing number from AI inference (not yet active). */
  aiDrawingNumber?: string | null;
}

export interface ResolvedDocumentSignals {
  revision: Signal<string>;
  drawingNumber: Signal<string>;
}

export function resolveDocumentSignals(input: DocumentSignalInput): ResolvedDocumentSignals {
  const revision = resolveSignal<string>([
    { value: input.titleBlockRevision ?? null, source: 'TITLE_BLOCK' },
    { value: input.textRevision ?? null,        source: 'TEXT' },
    { value: input.filenameRevision ?? null,    source: 'FILENAME' },
    { value: input.aiRevision ?? null,          source: 'AI' },
  ]);

  const drawingNumber = resolveSignal<string>([
    { value: input.emDrawingNumber ?? null,       source: 'TITLE_BLOCK' },
    { value: input.textDrawingNumber ?? null,     source: 'TEXT' },
    { value: input.filenameDrawingNumber ?? null, source: 'FILENAME' },
    { value: input.aiDrawingNumber ?? null,       source: 'AI' },
  ]);

  return { revision, drawingNumber };
}
