'use client';

/**
 * HarnessConnectivityPanel — Phase T3
 *
 * Renders the HC-BOM (Harness Connectivity BOM) as a compact, operator-reviewable
 * panel within the Upload Workbench. Shows per-wire from/to connectivity, confidence,
 * unresolved status, and expandable raw row evidence.
 *
 * Governance:
 *   - Read-only / informational only. No writeback, no side effects.
 *   - Does NOT modify HC-BOM data, authority resolver, or ingestion pipeline.
 *   - Ambiguity is exposed, never hidden. Uncertainty is visible, not masked.
 *   - Additive only. Self-contained — no changes to T1/T2 logic required.
 *   - Uses existing UI conventions from UploadWorkbench (details/summary, badges, pills).
 */

import React, { useEffect, useMemo, useState } from 'react';
import type {
  HarnessConnectivityResult,
  WireConnectivity,
  WireEndpoint,
} from '@/src/features/harness-work-instructions/services/harnessConnectivityService';
import { endpointHasAuthoritativeTermination } from '@/src/features/harness-work-instructions/services/harnessConnectivityService';
import type {
  HarnessReconciliationResult,
  ReconciledWire,
} from '@/src/features/harness-work-instructions/services/harnessReconciliationService';
import type { HarnessDecisionResult } from '@/src/features/harness-work-instructions/services/harnessDecisionService';
import type { OperatorResolutionMode, WireOperatorOverride, WireResolutionMode } from '@/src/features/vault/types/ingestionReview';
import type { HarnessTopologyResult, TopologyWarning } from '@/src/features/harness-work-instructions/services/harnessTopologyService';
import { canonicalComponentKey } from '@/src/features/harness-work-instructions/services/harnessTopologyService';
import { buildComponentAuthorityOptions, type ComponentAuthorityOption } from '@/src/features/harness-work-instructions/services/componentAuthorityService';
import type { WireIdentityResult } from '@/src/features/harness-work-instructions/services/wireIdentityService';
import HarnessTopologyVisualizer from './HarnessTopologyVisualizer';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AMBIGUOUS_WIRE_IDS = new Set(['COM', 'GND', 'SHLD', 'SHIELD', 'SHD']);

const TERMINAL_RE = /\b(\d{1,4}-\d{4,9}(?:-\d{1,4})?|\d{4,9}-\d{1,4})\b/g;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type WireStatus = 'RESOLVED' | 'PARTIAL' | 'UNRESOLVED';

function classifyWire(w: WireConnectivity): WireStatus {
  if (w.unresolved) return 'UNRESOLVED';
  if (endpointHasAuthoritativeTermination(w.from) && endpointHasAuthoritativeTermination(w.to)) return 'RESOLVED';
  return 'PARTIAL';
}

function getBlockingReasons(decision: HarnessDecisionResult | null | undefined): string[] | null {
  if (!decision) return null;
  const maybe = (decision as HarnessDecisionResult & { blockingReasons?: unknown }).blockingReasons;
  return Array.isArray(maybe) ? maybe as string[] : null;
}

const STATUS_STYLES: Record<WireStatus, { label: string; className: string }> = {
  RESOLVED:   { label: 'Resolved',   className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  PARTIAL:    { label: 'Partial',    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  UNRESOLVED: { label: 'Unresolved', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
};

function confidencePill(conf: number): { label: string; className: string } {
  const pct = `${Math.round(conf * 100)}%`;
  if (conf >= 0.9) return { label: pct, className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' };
  if (conf >= 0.5) return { label: pct, className: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300' };
  return { label: pct, className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400' };
}

/** Infer the reason a wire is unresolved from its existing data. */
function inferUnresolvedReason(w: WireConnectivity): string | null {
  if (!w.unresolved) return null;
  const reasons: string[] = [];
  if (AMBIGUOUS_WIRE_IDS.has(w.wireId.toUpperCase())) {
    reasons.push('Bus/ground/shield wire — endpoint mapping unclear');
  }
  if (w.from.treatment === 'SPLICE') {
    reasons.push('SPLICE treatment — connection semantics ambiguous');
  }
  if (w.from.treatment === 'HEAT_SHRINK') {
    reasons.push('HEAT_SHRINK treatment — connection semantics ambiguous');
  }
  TERMINAL_RE.lastIndex = 0;
  const terminals = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = TERMINAL_RE.exec(w.rawText)) !== null) terminals.add(m[1]);
  if (terminals.size > 1) {
    reasons.push(`Multiple terminals detected (${terminals.size})`);
  }
  return reasons.length > 0 ? reasons.join('; ') : 'Ambiguous mapping';
}

const dash = '—';

function describeTermination(endpoint: WireEndpoint): string | null {
  const type = endpoint.terminationType;
  if (type && type !== 'UNKNOWN') {
    const label = type.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
    return endpoint.treatment ? `${label} (${endpoint.treatment})` : label;
  }
  if (endpoint.treatment && endpoint.treatment.trim()) return endpoint.treatment.trim();
  return null;
}

function endpointLabel(endpoint: WireEndpoint): string {
  if (endpoint.component && endpoint.component.trim()) return endpoint.component.trim();
  return describeTermination(endpoint) ?? dash;
}

function formatInchesValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

function formatLengthSummary(wire: WireConnectivity): string {
  if (wire.lengthInches != null) {
    return `${formatInchesValue(wire.lengthInches)} in`;
  }
  if (wire.length != null && wire.lengthUnit) {
    return `${wire.length} ${wire.lengthUnit}`;
  }
  if (wire.length != null) {
    return `${wire.length}`;
  }
  return dash;
}

function formatLengthDetail(wire: WireConnectivity): string {
  if (wire.lengthInches != null) {
    const base = `${formatInchesValue(wire.lengthInches)} in`;
    if (wire.lengthUnit && wire.lengthUnit !== 'in' && wire.length != null) {
      return `${base} (raw ${wire.length} ${wire.lengthUnit})`;
    }
    return base;
  }
  if (wire.length != null && wire.lengthUnit) {
    return `${wire.length} ${wire.lengthUnit}`;
  }
  if (wire.length != null) {
    return `${wire.length}`;
  }
  return dash;
}

// ---------------------------------------------------------------------------
// Reconciliation match indicator
// ---------------------------------------------------------------------------

const STRONG_MATCH = new Set(['EXACT', 'PN_MATCH']);

function matchIndicator(
  rw: ReconciledWire | undefined,
): { symbol: string; label: string; className: string } | null {
  if (!rw) return null;
  if (rw.from.matchType === 'AMBIGUOUS' || rw.to.matchType === 'AMBIGUOUS') {
    return { symbol: '?', label: 'Ambiguous', className: 'bg-purple-100 text-purple-700' };
  }
  const fromOk = STRONG_MATCH.has(rw.from.matchType);
  const toOk   = STRONG_MATCH.has(rw.to.matchType);
  if (fromOk && toOk)   return { symbol: '\u2714', label: 'Matched', className: 'bg-emerald-100 text-emerald-700' };
  if (fromOk || toOk)   return { symbol: '\u26a0', label: 'Partial',   className: 'bg-amber-100 text-amber-800' };
  return { symbol: '\u2717', label: 'Unmatched', className: 'bg-red-100 text-red-700' };
}

type ComponentOptionLookups = {
  byCanonical: Map<string, ComponentAuthorityOption>;
  byDisplay: Map<string, ComponentAuthorityOption>;
  byCollapsed: Map<string, ComponentAuthorityOption>;
};

type WireConnectivityWithProjectionHints = WireConnectivity & {
  connectorPartNumber?: string | null;
  terminalPartNumber?: string | null;
};

function buildComponentOptionLookups(options: ComponentAuthorityOption[]): ComponentOptionLookups {
  const byCanonical = new Map<string, ComponentAuthorityOption>();
  const byDisplay = new Map<string, ComponentAuthorityOption>();
  const byCollapsed = new Map<string, ComponentAuthorityOption>();
  for (const option of options) {
    if (option.canonicalId) {
      byCanonical.set(option.canonicalId, option);
    }
    const normalized = option.displayName.trim().toLowerCase();
    if (normalized.length > 0 && !byDisplay.has(normalized)) {
      byDisplay.set(normalized, option);
    }
    const collapsed = normalized.replace(/[\s\-_:]/g, '');
    if (collapsed.length > 0 && !byCollapsed.has(collapsed)) {
      byCollapsed.set(collapsed, option);
    }
  }
  return { byCanonical, byDisplay, byCollapsed };
}

function findComponentOption(
  raw: string | null | undefined,
  lookups: ComponentOptionLookups,
): ComponentAuthorityOption | null {
  if (!raw) return null;
  const canonical = canonicalComponentKey(raw);
  if (canonical) {
    const canonicalMatch = lookups.byCanonical.get(canonical);
    if (canonicalMatch) return canonicalMatch;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized.length > 0) {
    const displayMatch = lookups.byDisplay.get(normalized);
    if (displayMatch) return displayMatch;
    const collapsed = normalized.replace(/[\s\-_:]/g, '');
    if (collapsed.length > 0) {
      const collapsedMatch = lookups.byCollapsed.get(collapsed);
      if (collapsedMatch) return collapsedMatch;
    }
  }
  return null;
}

function resolveSuggestedOption(
  candidates: (string | null | undefined)[],
  lookups: ComponentOptionLookups,
): ComponentAuthorityOption | null {
  for (const candidate of candidates) {
    const match = findComponentOption(candidate, lookups);
    if (match) return match;
  }
  return null;
}

// ---------------------------------------------------------------------------
// T11: Sub-component: wire resolve form
// ---------------------------------------------------------------------------

const RESOLVE_MODE_LABELS: Record<WireResolutionMode, string> = {
  DIRECT_OVERRIDE:     'Direct Override',
  BRANCH_DOUBLE_CRIMP: 'Branch / Double-Crimp',
  GROUND:              'Ground',
  SPLICE:              'Splice',
  FLOATING:            'Floating',
};

function WireResolveForm({
  wireId,
  onSave,
  onCancel,
  componentOptions,
  suggestedFromComponentId,
  suggestedToComponentId,
  initialFromComponentName,
  initialToComponentName,
  isDegradedMode,
  componentOptionsSource,
}: {
  wireId: string;
  onSave: (override: WireOperatorOverride) => void;
  onCancel: () => void;
  componentOptions: ComponentAuthorityOption[];
  suggestedFromComponentId?: string | null;
  suggestedToComponentId?: string | null;
  initialFromComponentName?: string | null;
  initialToComponentName?: string | null;
  isDegradedMode: boolean;
  componentOptionsSource?: string | null;
}) {
  const [mode, setMode]       = useState<WireResolutionMode>('DIRECT_OVERRIDE');
  const [fromComponentId, setFromComponentId] = useState(suggestedFromComponentId ?? '');
  const [fromCav,  setFromCav]  = useState('');
  const [toComponentId, setToComponentId]   = useState(suggestedToComponentId ?? '');
  const [toCav,    setToCav]    = useState('');
  const [srcComp,  setSrcComp]  = useState('');
  const [srcCav,   setSrcCav]   = useState('');
  const [secCav,   setSecCav]   = useState('');
  const [ferrPN,   setFerrPN]   = useState('');
  const [termPN,   setTermPN]   = useState('');
  const [notes,    setNotes]    = useState('');
  const [reason,   setReason]   = useState('');
  const [err,      setErr]      = useState<string | null>(null);
  const [componentSourceMode, setComponentSourceMode] = useState<OperatorResolutionMode>('CANONICAL_SELECTION');
  const [fromManualComponent, setFromManualComponent] = useState(initialFromComponentName ?? '');
  const [toManualComponent,   setToManualComponent]   = useState(initialToComponentName ?? '');
  const [acknowledgedDegradedMode, setAcknowledgedDegradedMode] = useState(() => !isDegradedMode);

  const hasOptions = componentOptions.length > 0;

  useEffect(() => {
    setFromComponentId(suggestedFromComponentId ?? '');
    setToComponentId(suggestedToComponentId ?? '');
    setFromManualComponent(initialFromComponentName ?? '');
    setToManualComponent(initialToComponentName ?? '');
    setComponentSourceMode(componentOptions.length === 0 ? 'MANUAL_OVERRIDE' : 'CANONICAL_SELECTION');
    setAcknowledgedDegradedMode(!isDegradedMode);
  }, [wireId, suggestedFromComponentId, suggestedToComponentId, componentOptions.length, initialFromComponentName, initialToComponentName, isDegradedMode]);

  useEffect(() => {
    if (suggestedFromComponentId === undefined) return;
    setFromComponentId(suggestedFromComponentId ?? '');
  }, [suggestedFromComponentId]);

  useEffect(() => {
    if (suggestedToComponentId === undefined) return;
    setToComponentId(suggestedToComponentId ?? '');
  }, [suggestedToComponentId]);

  useEffect(() => {
    if (componentOptions.length === 0 && componentSourceMode !== 'MANUAL_OVERRIDE') {
      setComponentSourceMode('MANUAL_OVERRIDE');
    }
  }, [componentOptions.length, componentSourceMode]);

  const sortOptions = useMemo(() => {
    return (priority: (kind: ComponentAuthorityOption['kind']) => number) =>
      [...componentOptions].sort((a, b) => {
        const pa = priority(a.kind);
        const pb = priority(b.kind);
        if (pa !== pb) return pa - pb;
        return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
      });
  }, [componentOptions]);

  const rankedFromOptions = useMemo(() => sortOptions(kind => (
    kind === 'CONNECTOR' ? 0 : kind === 'TERMINAL' ? 1 : 2
  )), [sortOptions]);

  const rankedToOptions = useMemo(() => sortOptions(kind => (
    kind === 'TERMINAL' ? 0 : kind === 'CONNECTOR' ? 1 : 2
  )), [sortOptions]);

  const handleSave = () => {
    if (isDegradedMode && !acknowledgedDegradedMode) {
      setErr('Please acknowledge degraded mode before saving.');
      if (typeof window !== 'undefined') {
        window.alert('Please acknowledge degraded mode before proceeding.');
      }
      return;
    }
    if (!reason.trim()) { setErr('Reason is required.'); return; }
    if (mode === 'BRANCH_DOUBLE_CRIMP') {
      if (!srcComp.trim() || !srcCav.trim()) { setErr('Shared source component and cavity are required.'); return; }
      if (!termPN.trim() && !ferrPN.trim())  { setErr('Terminal PN or ferrule PN is required.'); return; }
    }
    if (mode === 'DIRECT_OVERRIDE' && componentSourceMode === 'CANONICAL_SELECTION') {
      if (!fromComponentId || !toComponentId) {
        window.alert('Please select valid FROM and TO components before saving.');
        return;
      }
    }
    if (mode === 'DIRECT_OVERRIDE' && componentSourceMode === 'MANUAL_OVERRIDE') {
      if (!fromManualComponent.trim() || !toManualComponent.trim()) {
        setErr('Manual override requires FROM and TO component names.');
        return;
      }
    }
    setErr(null);
    const fromOption = componentOptions.find(opt => opt.canonicalId === fromComponentId) ?? null;
    const toOption = componentOptions.find(opt => opt.canonicalId === toComponentId) ?? null;
    const resolvedFromComponent = componentSourceMode === 'MANUAL_OVERRIDE'
      ? (fromManualComponent.trim() || null)
      : ((fromOption?.displayName ?? fromComponentId) || null);
    const resolvedToComponent = componentSourceMode === 'MANUAL_OVERRIDE'
      ? (toManualComponent.trim() || null)
      : ((toOption?.displayName ?? toComponentId) || null);
    const override: WireOperatorOverride = {
      wireId,
      mode,
      resolutionMode: componentSourceMode,
      ...(mode === 'DIRECT_OVERRIDE' ? {
        from: { component: resolvedFromComponent, cavity: fromCav.trim() || null, treatment: null },
        to:   { component: resolvedToComponent,   cavity: toCav.trim()   || null, treatment: null },
      } : {}),
      ...(mode === 'BRANCH_DOUBLE_CRIMP' ? {
        branch: {
          sharedSourceComponent: srcComp.trim() || null,
          sharedSourceCavity:    srcCav.trim()  || null,
          secondaryCavity:       secCav.trim()  || null,
          ferrulePartNumber:     ferrPN.trim()  || null,
          terminalPartNumber:    termPN.trim()  || null,
          notes:                 notes.trim()  || null,
        },
      } : {}),
      reason:            reason.trim(),
      operatorConfirmed: true,
      appliedAt:         new Date().toISOString(),
    };
    console.log('[T23.6.70 OPERATOR OVERRIDE]', {
      wireId,
      resolutionMode: componentSourceMode,
      mode,
      fromComponent: override.from?.component ?? null,
      toComponent:   override.to?.component   ?? null,
      reason:        override.reason,
    });
    console.log('[T23.6.71 RESOLUTION CONTEXT]', {
      wireId,
      resolutionMode: componentSourceMode,
      degraded: isDegradedMode,
      source: componentOptionsSource ?? 'UNKNOWN',
    });
    if (isDegradedMode && componentSourceMode === 'MANUAL_OVERRIDE') {
      console.warn('[T23.6.71 DEGRADED OVERRIDE]', {
        wireId,
        fromComponent: override.from?.component ?? null,
        toComponent:   override.to?.component   ?? null,
        reason:        override.reason,
        source:        componentOptionsSource ?? 'UNKNOWN',
      });
    }
    onSave(override);
  };

  const inp = 'w-full rounded border border-[color:var(--panel-border)] bg-[color:var(--input-bg)] px-1.5 py-0.5 text-[11px] text-[color:var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-blue-400';
  const suggestedCls = 'border-emerald-400 ring-1 ring-emerald-300 bg-emerald-50/40';
  const fromSuggestedActive = Boolean(suggestedFromComponentId && fromComponentId === suggestedFromComponentId);
  const toSuggestedActive = Boolean(suggestedToComponentId && toComponentId === suggestedToComponentId);
  const lab = 'text-[10px] font-semibold text-gray-500 mb-0.5 block';

  const handleComponentSourceChange = (nextMode: OperatorResolutionMode) => {
    if (nextMode === 'CANONICAL_SELECTION' && componentOptions.length === 0) return;
    setComponentSourceMode(nextMode);
  };

  const manualHelper = componentSourceMode === 'MANUAL_OVERRIDE'
    ? 'Manual override bypasses canonical validation — describe exact components in the notes/reason field.'
    : null;

  const optionLabel = (opt: ComponentAuthorityOption) => (
    `${opt.displayName} (${opt.kind}${isDegradedMode ? ' · fallback' : ''})`
  );

  return (
    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-2 space-y-2">
      <div className="font-semibold text-blue-800 text-[10px]">⚙️ Operator Resolution — Wire {wireId}</div>

      {isDegradedMode && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[10px] text-amber-800 space-y-1">
          <div className="font-semibold flex items-center gap-1">
            <span>⚠️ Canonical component options unavailable</span>
          </div>
          <div>System is operating in degraded mode — selections may be incomplete or less reliable.</div>
          <div className="text-[9px] text-amber-700">Source: {componentOptionsSource ?? 'UNKNOWN'}</div>
          <label className="mt-1 flex items-center gap-1 text-[10px] font-semibold">
            <input
              type="checkbox"
              checked={acknowledgedDegradedMode}
              onChange={e => setAcknowledgedDegradedMode(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
            />
            I understand the system is in degraded mode
          </label>
        </div>
      )}

      <div>
        <label className={lab}>Resolution Mode</label>
        <select value={mode} onChange={e => setMode(e.target.value as WireResolutionMode)} className={inp}>
          {(Object.keys(RESOLVE_MODE_LABELS) as WireResolutionMode[]).map(m => (
            <option key={m} value={m}>{RESOLVE_MODE_LABELS[m]}</option>
          ))}
        </select>
      </div>

      {mode === 'DIRECT_OVERRIDE' && (
        <div className="space-y-1.5">
          <div>
            <label className={lab}>Component Source</label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => handleComponentSourceChange('CANONICAL_SELECTION')}
                className={`flex-1 rounded px-2 py-1 text-[10px] font-semibold border transition ${componentSourceMode === 'CANONICAL_SELECTION' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-300'}`}
                disabled={!hasOptions}
              >
                Canonical Dropdown
              </button>
              <button
                type="button"
                onClick={() => handleComponentSourceChange('MANUAL_OVERRIDE')}
                className={`flex-1 rounded px-2 py-1 text-[10px] font-semibold border transition ${componentSourceMode === 'MANUAL_OVERRIDE' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-700 border-amber-300'}`}
              >
                Manual Override
              </button>
            </div>
            {manualHelper && (
              <p className="mt-0.5 text-[10px] text-amber-700">{manualHelper}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {componentSourceMode === 'CANONICAL_SELECTION' ? (
              <>
                <div>
                  <label className={lab}>From Component</label>
                  <select
                    value={fromComponentId}
                    onChange={e => setFromComponentId(e.target.value)}
                    className={`${inp} ${fromSuggestedActive ? suggestedCls : ''}`}
                    disabled={!hasOptions}
                  >
                    <option value="">{hasOptions ? 'Select component' : 'No options available'}</option>
                    {rankedFromOptions.map(opt => (
                      <option key={opt.canonicalId} value={opt.canonicalId}>
                        {optionLabel(opt)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={lab}>To Component</label>
                  <select
                    value={toComponentId}
                    onChange={e => setToComponentId(e.target.value)}
                    className={`${inp} ${toSuggestedActive ? suggestedCls : ''}`}
                    disabled={!hasOptions}
                  >
                    <option value="">{hasOptions ? 'Select component' : 'No options available'}</option>
                    {rankedToOptions.map(opt => (
                      <option key={opt.canonicalId} value={opt.canonicalId}>
                        {optionLabel(opt)}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={lab}>From Component (Manual)</label>
                  <input
                    value={fromManualComponent}
                    onChange={e => setFromManualComponent(e.target.value)}
                    placeholder="e.g. K1"
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lab}>To Component (Manual)</label>
                  <input
                    value={toManualComponent}
                    onChange={e => setToManualComponent(e.target.value)}
                    placeholder="e.g. TB3"
                    className={inp}
                  />
                </div>
              </>
            )}
            <div><label className={lab}>From Cavity / Pin</label><input value={fromCav} onChange={e => setFromCav(e.target.value)} placeholder="e.g. 2" className={inp} /></div>
            <div><label className={lab}>To Cavity / Pin</label><input value={toCav} onChange={e => setToCav(e.target.value)} placeholder="e.g. 5" className={inp} /></div>
          </div>
        </div>
      )}

      {mode === 'BRANCH_DOUBLE_CRIMP' && (
        <div className="grid grid-cols-2 gap-2">
          <div><label className={lab}>Shared Source Component <span className="text-red-500">*</span></label><input value={srcComp} onChange={e => setSrcComp(e.target.value)} placeholder="e.g. PHEONIX 1700443" className={inp} /></div>
          <div><label className={lab}>Shared Source Cavity <span className="text-red-500">*</span></label><input   value={srcCav}  onChange={e => setSrcCav(e.target.value)}  placeholder="e.g. 2"               className={inp} /></div>
          <div><label className={lab}>Secondary Cavity</label><input                                               value={secCav}  onChange={e => setSecCav(e.target.value)}  placeholder="e.g. 5"               className={inp} /></div>
          <div><label className={lab}>Ferrule PN</label><input                                                     value={ferrPN}  onChange={e => setFerrPN(e.target.value)}  placeholder="e.g. 1381010"         className={inp} /></div>
          <div><label className={lab}>Terminal PN <span className="text-red-500">*</span></label><input           value={termPN}  onChange={e => setTermPN(e.target.value)}  placeholder="e.g. 61944-1"         className={inp} /></div>
          <div><label className={lab}>Notes</label><input                                                          value={notes}   onChange={e => setNotes(e.target.value)}   placeholder="Optional"             className={inp} /></div>
        </div>
      )}

      <div>
        <label className={lab}>Reason <span className="text-red-500">*</span></label>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe why this override is correct" className={inp} />
      </div>

      {err && <div className="text-red-600 text-[10px]">{err}</div>}

      <div className="flex gap-2">
        <button onClick={handleSave} className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-blue-700 transition">Save</button>
        <button onClick={onCancel}   className="rounded bg-gray-200 px-2 py-0.5 text-[10px] text-gray-700 hover:bg-gray-300 transition">Cancel</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: expandable wire row evidence
// ---------------------------------------------------------------------------

function WireEvidenceRow({
  wire,
  reconciledWire,
  hasReconciliation,
  operatorOverride,
  onResolveSubmit,
  activeResolveWireId,
  onActivateResolve,
  onResolveFormClose,
  wireIdentity,
  componentOptions,
  componentOptionLookups,
  isDegradedMode,
  componentOptionsSource,
}: {
  wire: WireConnectivity;
  reconciledWire?: ReconciledWire;
  hasReconciliation: boolean;
  operatorOverride?: WireOperatorOverride;
  onResolveSubmit?: (override: WireOperatorOverride) => void;
  activeResolveWireId?: string | null;
  onActivateResolve?: (wireId: string) => void;
  onResolveFormClose?: () => void;
  wireIdentity?: WireIdentityResult['wires'][number];
  componentOptions: ComponentAuthorityOption[];
  componentOptionLookups: ComponentOptionLookups;
  isDegradedMode: boolean;
  componentOptionsSource?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isOperatorResolved = Boolean(operatorOverride);
  const originalStatus = classifyWire(wire);
  const statusStyle = isOperatorResolved
    ? { label: 'Resolved by Operator', className: 'bg-blue-100 text-blue-800' }
    : STATUS_STYLES[originalStatus];
  const confStyle = confidencePill(wire.confidence);
  const rowBg = !isOperatorResolved && originalStatus === 'UNRESOLVED'
    ? 'bg-red-50/40'
    : !isOperatorResolved && originalStatus === 'PARTIAL'
      ? 'bg-amber-50/30'
      : '';
  const indicator = matchIndicator(reconciledWire);
  const debugMode = process.env.NODE_ENV !== 'production';
  const isFormOpen = activeResolveWireId === wire.wireId;
  const canResolve = !isOperatorResolved && wire.unresolved && Boolean(onResolveSubmit);
  const projectionHints = wire as WireConnectivityWithProjectionHints;

  const suggestedFromOption = useMemo(() => {
    if (componentOptions.length === 0) return null;
    return resolveSuggestedOption([
      projectionHints.connectorPartNumber ?? null,
      wire.from.component,
      reconciledWire?.from.matchedLabel,
    ], componentOptionLookups);
  }, [componentOptions.length, componentOptionLookups, projectionHints.connectorPartNumber, reconciledWire?.from.matchedLabel, wire.from.component]);

  const suggestedToOption = useMemo(() => {
    if (componentOptions.length === 0) return null;
    return resolveSuggestedOption([
      projectionHints.terminalPartNumber ?? null,
      wire.to.component,
      reconciledWire?.to.matchedLabel,
    ], componentOptionLookups);
  }, [componentOptions.length, componentOptionLookups, projectionHints.terminalPartNumber, reconciledWire?.to.matchedLabel, wire.to.component]);

  useEffect(() => {
    if (componentOptions.length === 0) return;
    console.log('[T23.6.66 AUTO SUGGEST]', {
      wireId: wire.wireId,
      suggestedFrom: suggestedFromOption?.displayName ?? null,
      suggestedTo: suggestedToOption?.displayName ?? null,
    });
  }, [componentOptions.length, suggestedFromOption?.canonicalId, suggestedToOption?.canonicalId, wire.wireId]);

  useEffect(() => {
    if (isFormOpen) {
      setExpanded(true);
    }
  }, [isFormOpen]);

  useEffect(() => {
    if (operatorOverride && isFormOpen) {
      onResolveFormClose?.();
    }
  }, [operatorOverride, isFormOpen, onResolveFormClose]);

  const handleResolveClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onActivateResolve?.(wire.wireId);
    setExpanded(true);
  };

  return (
    <>
      <tr
        id={`wire-row-${wire.wireId}`}
        className={`border-t border-[color:var(--panel-border)] cursor-pointer hover:bg-teal-50/40 ${rowBg}`}
        onClick={() => setExpanded(prev => !prev)}
        title="Click to expand evidence"
      >
        <td className="px-2 py-1 font-mono font-semibold text-gray-900 whitespace-nowrap">
          <span>{wireIdentity?.internalWireId ?? wire.wireId}</span>
          {wireIdentity?.customerWireId && wireIdentity.customerWireId !== wireIdentity.internalWireId && (
            <span className="ml-1 text-[9px] text-slate-400 font-normal">({wireIdentity.customerWireId})</span>
          )}
          <span className="ml-1 text-[9px] text-gray-400">{expanded ? '▲' : '▾'}</span>
        </td>
        <td className="px-2 py-1 text-right font-mono">{formatLengthSummary(wire)}</td>
        <td className="px-2 py-1">{wire.gauge ?? dash}</td>
        <td className="px-2 py-1">{wire.color ?? dash}</td>
        <td className="px-2 py-1 font-mono">{wire.from.component ?? dash}</td>
        <td className="px-2 py-1 text-right">{wire.from.cavity ?? dash}</td>
        <td className="px-2 py-1 font-mono">{wire.to.component ?? dash}</td>
        <td className="px-2 py-1 text-center">
          <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${confStyle.className}`}>
            {confStyle.label}
          </span>
        </td>
        <td className="px-2 py-1 text-center">
          <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${statusStyle.className}`}>
            {statusStyle.label}
          </span>
          {debugMode && wire.unresolved && (
            <div className="mt-0.5 text-[9px] text-gray-400 text-left">
              overridePresent: {operatorOverride ? 'yes' : 'no'} · canResolve: {canResolve ? 'yes' : 'no'}
            </div>
          )}
        </td>
        {hasReconciliation && (
          <td className="px-2 py-1 text-center">
            {indicator ? (
              <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${indicator.className}`}
                title={indicator.label}>
                {indicator.symbol}
              </span>
            ) : (
              <span className="text-gray-300">—</span>
            )}
          </td>
        )}
        <td
          className={`px-2 py-1 text-center text-[11px] font-semibold sticky right-0 border-l border-[color:var(--panel-border)] shadow-[inset_1px_0_0_rgba(15,23,42,0.08)] ${
            canResolve ? 'bg-[color:var(--surface-elevated)]' : 'bg-[color:var(--panel-bg)]'
          }`}
        >
          {canResolve ? (
            <button
              onClick={handleResolveClick}
              className="rounded-md bg-blue-600 px-2 py-1 text-[10px] text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              Resolve
            </button>
          ) : (
            <span className="text-gray-400">{isOperatorResolved ? 'Resolved' : '—'}</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-[color:var(--surface-elevated)]">
          <td colSpan={hasReconciliation ? 10 : 9} className="px-3 py-2">
            <div className="rounded-lg border border-[color:var(--panel-border)] bg-white/80 dark:bg-slate-800/80 p-2 space-y-1.5 text-[10px] text-gray-700">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div><span className="font-semibold text-gray-500">Source row:</span> #{wire.sourceRowIndex}</div>
                <div><span className="font-semibold text-gray-500">Confidence:</span> {(wire.confidence * 100).toFixed(0)}%</div>
                <div><span className="font-semibold text-gray-500">Length:</span> {formatLengthDetail(wire)}</div>
                <div><span className="font-semibold text-gray-500">From component:</span> {wire.from.component ?? dash}</div>
                <div><span className="font-semibold text-gray-500">From cavity:</span> {wire.from.cavity ?? dash}</div>
                <div><span className="font-semibold text-gray-500">From treatment:</span> {wire.from.treatment ?? dash}</div>
                <div><span className="font-semibold text-gray-500">To component:</span> {wire.to.component ?? dash}</div>
                <div><span className="font-semibold text-gray-500">To cavity:</span> {wire.to.cavity ?? dash}</div>
                <div><span className="font-semibold text-gray-500">To treatment:</span> {wire.to.treatment ?? dash}</div>
                <div><span className="font-semibold text-gray-500">Unresolved:</span> {wire.unresolved ? 'Yes' : 'No'}</div>
                {wire.unresolved && (
                  <div className="col-span-2">
                    <span className="font-semibold text-red-600">Reason:</span>{' '}
                    <span className="text-red-700">{inferUnresolvedReason(wire)}</span>
                  </div>
                )}
              {isOperatorResolved && operatorOverride && (
                <div className="col-span-2 rounded bg-blue-50 border border-blue-200 px-1.5 py-1 text-[10px] text-blue-800">
                  <span className="font-semibold">Operator Override:</span>{' '}
                  <span className="font-mono">{operatorOverride.mode}</span>{' — '}
                  <span className="italic">{operatorOverride.reason}</span>
                  <div className="mt-0.5 text-blue-600">Applied: {operatorOverride.appliedAt.slice(0, 19).replace('T', ' ')}</div>
                </div>
              )}
              </div>
              {reconciledWire && (
                <div className="border-t border-[color:var(--panel-border)] pt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
                  <div className="col-span-2 font-semibold text-gray-500">Diagram Match (T5)</div>
                  <div><span className="font-semibold text-gray-500">From match:</span>{' '}
                    <span className="font-mono">{reconciledWire.from.matchType}</span>
                    {reconciledWire.from.matchedLabel ? ` → ${reconciledWire.from.matchedLabel}` : ''}
                  </div>
                  <div><span className="font-semibold text-gray-500">From conf:</span>{' '}
                    {(reconciledWire.from.confidence * 100).toFixed(0)}%
                  </div>
                  <div><span className="font-semibold text-gray-500">To match:</span>{' '}
                    <span className="font-mono">{reconciledWire.to.matchType}</span>
                    {reconciledWire.to.matchedLabel ? ` → ${reconciledWire.to.matchedLabel}` : ''}
                  </div>
                  <div><span className="font-semibold text-gray-500">To conf:</span>{' '}
                    {(reconciledWire.to.confidence * 100).toFixed(0)}%
                  </div>
                  {reconciledWire.from.candidateComponentIds && (
                    <div className="col-span-2 text-purple-700">
                      <span className="font-semibold">Ambiguous from candidates:</span>{' '}
                      {reconciledWire.from.candidateComponentIds.join(', ')}
                    </div>
                  )}
                  {reconciledWire.to.candidateComponentIds && (
                    <div className="col-span-2 text-purple-700">
                      <span className="font-semibold">Ambiguous to candidates:</span>{' '}
                      {reconciledWire.to.candidateComponentIds.join(', ')}
                    </div>
                  )}
                </div>
              )}
              <div className="border-t border-[color:var(--panel-border)] pt-1.5">
                <span className="font-semibold text-gray-500">Raw OCR text:</span>
                <pre className="mt-0.5 whitespace-pre-wrap break-all font-mono text-[10px] text-gray-600 bg-[color:var(--surface-elevated)] rounded px-1.5 py-1 border border-[color:var(--panel-border)]">
                  {wire.rawText}
                </pre>
              </div>

              {isFormOpen && onResolveSubmit && (
                <WireResolveForm
                  wireId={wire.wireId}
                  onSave={override => {
                    onResolveSubmit(override);
                    onResolveFormClose?.();
                  }}
                  onCancel={() => onResolveFormClose?.()}
                  componentOptions={componentOptions}
                  suggestedFromComponentId={suggestedFromOption?.canonicalId}
                  suggestedToComponentId={suggestedToOption?.canonicalId}
                  initialFromComponentName={wire.from.component ?? reconciledWire?.from.matchedLabel ?? null}
                  initialToComponentName={wire.to.component ?? reconciledWire?.to.matchedLabel ?? null}
                  isDegradedMode={isDegradedMode}
                  componentOptionsSource={componentOptionsSource}
                />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// T13: Topology issues sub-component
// ---------------------------------------------------------------------------

const WARNING_CODE_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  MISSING_WIRE:      { label: 'Missing Wire',       bg: 'bg-rose-100',   text: 'text-rose-800' },
  DANGLING_ENDPOINT: { label: 'Dangling Endpoint',  bg: 'bg-orange-100', text: 'text-orange-800' },
  UNDECLARED_BRANCH: { label: 'Undeclared Branch',  bg: 'bg-amber-100',  text: 'text-amber-800' },
  ISOLATED_SUBGRAPH: { label: 'Isolated Subgraph',  bg: 'bg-purple-100', text: 'text-purple-800' },
};

function TopologyIssuesSection({ topology }: { topology: HarnessTopologyResult }) {
  const blocking = topology.warnings.filter(w => w.blocksCommit && w.confidence === 'HIGH');
  const advisory = topology.warnings.filter(w => !w.blocksCommit || w.confidence !== 'HIGH');
  const missingCount  = topology.missingWireCandidates.length;
  const danglingCount = topology.danglingEndpoints.length;

  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50/60 px-2.5 py-2 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold text-rose-800">Topology Issues</span>
        {blocking.length > 0 && (
          <span className="rounded-full bg-rose-600 text-white px-2 py-0.5 text-[10px] font-semibold">
            {blocking.length} blocking
          </span>
        )}
        {missingCount > 0 && (
          <span className="rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 text-[10px] font-semibold">
            {missingCount} missing wire{missingCount > 1 ? 's' : ''}
          </span>
        )}
        {danglingCount > 0 && (
          <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-semibold">
            {danglingCount} dangling
          </span>
        )}
      </div>

      {/* Missing wire candidates */}
      {topology.missingWireCandidates.length > 0 && (
        <div className="space-y-1">
          {topology.missingWireCandidates.map((c, i) => (
            <div key={i}
              className="flex items-start gap-1.5 rounded bg-[color:var(--surface-elevated)] border border-rose-200 px-2 py-1 text-[10px]">
              <span className="rounded-full bg-rose-100 text-rose-700 px-1.5 py-0.5 font-semibold shrink-0">
                MISSING PIN
              </span>
              <span className="text-gray-700 leading-snug">
                <strong>{c.component}</strong> pin <strong>{c.missingCavity}</strong>
                {' '}<span className="text-gray-400">— known: {c.knownCavities.join(', ')}</span>
              </span>
              <span className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 font-semibold ${
                c.confidence === 'HIGH' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {c.confidence}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* All other warnings */}
      {topology.warnings
        .filter(w => w.code !== 'MISSING_WIRE')
        .map((w, i) => {
          const style = WARNING_CODE_LABELS[w.code] ?? { label: w.code, bg: 'bg-gray-100', text: 'text-gray-700' };
          return (
            <div key={i}
              className="flex items-start gap-1.5 rounded bg-[color:var(--surface-elevated)] border border-[color:var(--panel-border)] px-2 py-1 text-[10px]">
              <span className={`rounded-full px-1.5 py-0.5 font-semibold shrink-0 ${style.bg} ${style.text}`}>
                {style.label}
              </span>
              <span className="text-gray-700 leading-snug flex-1">{w.message}</span>
              {w.blocksCommit && w.confidence === 'HIGH' && (
                <span className="ml-auto shrink-0 rounded-full bg-rose-100 text-rose-700 px-1.5 py-0.5 font-semibold">
                  BLOCKS
                </span>
              )}
            </div>
          );
        })}

      {advisory.length === 0 && blocking.length === 0 && (
        <p className="text-[10px] text-rose-700 italic">No topology details available.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface HarnessConnectivityPanelProps {
  connectivity?: HarnessConnectivityResult | null | undefined;
  harnessConnectivity?: HarnessConnectivityResult | null | undefined;
  reconciliation?: HarnessReconciliationResult | null;
  /** T11: Operator overrides applied so far. */
  operatorOverrides?: WireOperatorOverride[];
  /** T11: Called when the operator saves a new wire override. */
  onOverrideSubmit?: (override: WireOperatorOverride) => void;
  /** T11: Recomputed decision after overrides — for resolved banner. */
  resolvedDecision?: HarnessDecisionResult | null;
  /** T13: Topology analysis result — missing wires, branches, isolated groups. */
  topology?: HarnessTopologyResult | null;
  /** T15: Deterministic wire identity assignments — forwarded to visualizer and wire table. */
  wireIdentities?: WireIdentityResult | null;
  /** T14.5: Graph interaction callbacks — forwarded to HarnessTopologyVisualizer. */
  onGraphWireClick?: (wireId: string) => void;
  onGraphMissingPinClick?: (payload: { component: string; cavity: string }) => void;
  onGraphBranchClick?: (payload: { component: string; cavity: string; wireIds: string[] }) => void;
  /** T23.6.65: Canonical component options derived from BOM connectors/terminals. */
  componentOptions?: ComponentAuthorityOption[];
  componentOptionsSource?: string;
}

export default function HarnessConnectivityPanel({
  connectivity,
  harnessConnectivity,
  reconciliation,
  operatorOverrides,
  onOverrideSubmit,
  resolvedDecision,
  topology,
  wireIdentities,
  onGraphWireClick,
  onGraphMissingPinClick,
  onGraphBranchClick,
  componentOptions,
  componentOptionsSource,
}: HarnessConnectivityPanelProps) {
  const model = useMemo(() => connectivity ?? harnessConnectivity ?? null, [connectivity, harnessConnectivity]);

  const incomingOptions = useMemo<ComponentAuthorityOption[]>(
    () => (Array.isArray(componentOptions) ? componentOptions : []),
    [componentOptions],
  );

  const canonicalOptions = componentOptionsSource === 'SIMPLIFIED_BOM' ? incomingOptions : [];
  const providedFallbackOptions = componentOptionsSource && componentOptionsSource !== 'SIMPLIFIED_BOM'
    ? incomingOptions
    : [];

  const fallbackOptions = useMemo<ComponentAuthorityOption[]>(() => {
    if (canonicalOptions.length > 0) return [];
    if (providedFallbackOptions.length > 0) return providedFallbackOptions;
    if (!model) return [];
    return buildComponentAuthorityOptions(model);
  }, [canonicalOptions.length, providedFallbackOptions, model]);

  const hasCanonicalOptions = canonicalOptions.length > 0;
  const hasFallbackOptions = fallbackOptions.length > 0;

  const finalComponentOptions = hasCanonicalOptions ? canonicalOptions : fallbackOptions;
  const fallbackSource = !hasCanonicalOptions
    ? (componentOptionsSource && componentOptionsSource !== 'SIMPLIFIED_BOM'
        ? componentOptionsSource
        : hasFallbackOptions
          ? 'ANALYSIS_CONNECTIVITY_FALLBACK'
          : 'UNAVAILABLE')
    : null;
  const finalComponentOptionsSource = hasCanonicalOptions
    ? (componentOptionsSource ?? 'SIMPLIFIED_BOM')
    : (fallbackSource ?? 'UNAVAILABLE');

  useEffect(() => {
    console.log('[T23.6.71B SOURCE LOCK]', {
      hasCanonicalOptions,
      canonicalCount: canonicalOptions.length,
      fallbackCount: fallbackOptions.length,
      finalCount: finalComponentOptions.length,
      incomingSource: componentOptionsSource ?? 'UNKNOWN',
      finalSource: finalComponentOptionsSource,
    });
    if (hasCanonicalOptions && finalComponentOptionsSource !== 'SIMPLIFIED_BOM') {
      console.error('[T23.6.71B SOURCE LOCK VIOLATION]', {
        canonicalCount: canonicalOptions.length,
        finalSource: finalComponentOptionsSource,
      });
    }
  }, [hasCanonicalOptions, canonicalOptions.length, fallbackOptions.length, finalComponentOptions.length, componentOptionsSource, finalComponentOptionsSource]);

  useEffect(() => {
    if (!Array.isArray(componentOptions)) {
      console.warn('[T23.6.70 UI SOURCE ENFORCEMENT ERROR] componentOptions prop missing.', {
        source: componentOptionsSource ?? 'UNKNOWN',
      });
    } else if (componentOptions.length === 0 && componentOptionsSource === 'SIMPLIFIED_BOM') {
      console.warn('[T23.6.70 UI SOURCE ENFORCEMENT ERROR] canonical source declared but options empty.', {
        source: componentOptionsSource ?? 'UNKNOWN',
      });
    }
  }, [componentOptions, componentOptionsSource]);

  const componentOptionLookups = useMemo(
    () => buildComponentOptionLookups(finalComponentOptions),
    [finalComponentOptions],
  );

  const isCanonicalAvailable = finalComponentOptionsSource === 'SIMPLIFIED_BOM' && finalComponentOptions.length > 0;
  const isDegradedMode = !isCanonicalAvailable;

  useEffect(() => {
    if (!isDegradedMode) return;
    console.warn('[T23.6.71 DEGRADED MODE ACTIVE]', {
      source: finalComponentOptionsSource ?? 'UNKNOWN',
      optionCount: finalComponentOptions.length,
    });
  }, [isDegradedMode, finalComponentOptionsSource, finalComponentOptions.length]);

  useEffect(() => {
    console.log('[T23.6.70 UI SOURCE ENFORCED]', {
      source: finalComponentOptionsSource ?? 'UNKNOWN',
      canonicalCount: finalComponentOptions.length,
    });
    if (finalComponentOptions.length === 0) {
      console.warn('[T23.6.70 MISSING CANONICAL OPTIONS]', {
        source: finalComponentOptionsSource ?? 'UNKNOWN',
      });
    } else {
      const connectorCount = finalComponentOptions.filter(opt => opt.kind === 'CONNECTOR').length;
      const terminalCount = finalComponentOptions.filter(opt => opt.kind === 'TERMINAL').length;
      console.log('[T23.6.65 RESOLUTION OPTIONS]', {
        total: finalComponentOptions.length,
        connectors: connectorCount,
        terminals: terminalCount,
      });
    }
  }, [finalComponentOptionsSource, finalComponentOptions.length]);

  const overrideMap = new Map((operatorOverrides ?? []).map(o => [o.wireId, o]));
  const [activeResolveWireId, setActiveResolveWireId] = useState<string | null>(null);
  const openResolve = (wireId: string) => {
    setActiveResolveWireId(wireId);
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        document.getElementById(`wire-row-${wireId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  };
  const closeResolve = () => setActiveResolveWireId(null);

  // ── Null / empty state ──────────────────────────────────────────────
  if (!model) {
    return null;
  }

  useEffect(() => {
    if (!resolvedDecision) return;
    console.log('[T23.6.25 UI SOURCE]', {
      decision: resolvedDecision.overallDecision,
      readiness: resolvedDecision.readinessScore,
      blocking: getBlockingReasons(resolvedDecision) ?? resolvedDecision.blockedWires ?? [],
    });
  }, [resolvedDecision]);

  const { wires, unresolvedWires, confidenceSummary } = model;

  if (wires.length === 0) {
    return (
      <div className="rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] px-3 py-2 text-xs text-gray-500">
        Connectivity rows were not confidently extracted.
      </div>
    );
  }

  // ── Sort: resolved first, then partial, then unresolved ────────────
  const sortedWires = [...wires].sort((a, b) => {
    const order: Record<WireStatus, number> = { RESOLVED: 0, PARTIAL: 1, UNRESOLVED: 2 };
    return order[classifyWire(a)] - order[classifyWire(b)];
  });
  const unresolvedActionCandidates = sortedWires.filter(w => w.unresolved && !overrideMap.has(w.wireId));

  const { total, resolved, partial, unresolved } = confidenceSummary;

  const reconciledByWireId = new Map<string, ReconciledWire>(
    reconciliation?.wires.map(rw => [rw.wireId, rw]) ?? [],
  );
  const hasReconciliation = reconciledByWireId.size > 0;

  console.log('[T3 HC-BOM PANEL]', { total, resolved, partial, unresolved: unresolvedWires.length });

  return (
    <details
      open
      className="rounded-xl border border-teal-200 bg-teal-50/50 text-xs"
    >
      <summary className="cursor-pointer px-3 py-2 font-semibold text-teal-700 select-none flex items-center gap-2">
        <span>Harness Connectivity (HC-BOM)</span>
        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] text-teal-800">
          {total}W
        </span>
        {unresolved > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700 font-semibold">
            {unresolved} unresolved
          </span>
        )}
        <span className="ml-auto text-[10px] text-teal-400">▼</span>
      </summary>

      <div className="px-3 pb-3 space-y-3 text-gray-700">

        {/* ── Info banner ─────────────────────────────────────────── */}
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-[10px] text-teal-800">
          Intermediate connectivity model — click any wire row to see evidence. Unresolved rows require manual verification.
        </div>

        {/* ── T11: Resolved decision banner ───────────────────────── */}
        {resolvedDecision && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] text-blue-800 flex flex-wrap gap-2 items-center">
            <span className="font-semibold">Resolved State:</span>
            <span className={`rounded-full px-2 py-0.5 font-semibold text-[10px] ${
              resolvedDecision.overallDecision === 'SAFE' ? 'bg-emerald-100 text-emerald-800'
              : resolvedDecision.overallDecision === 'REVIEW_REQUIRED' ? 'bg-amber-100 text-amber-800'
              : 'bg-red-100 text-red-700'
            }`}>{resolvedDecision.overallDecision}</span>
            <span>Readiness: {resolvedDecision.readinessScore.toFixed(0)}%</span>
            {(() => {
              const blockingReasons = getBlockingReasons(resolvedDecision);
              const fallbackIds = resolvedDecision.blockedWires ?? [];
              const blockedList = (blockingReasons && blockingReasons.length > 0)
                ? blockingReasons
                : fallbackIds.map(wid => {
                    const ident = wireIdentities?.byOriginalId.get(wid);
                    if (ident?.internalWireId && ident.internalWireId !== wid) return ident.internalWireId;
                    const w = model?.wires.find(x => x.wireId === wid);
                    if (!w) return wid;
                    const from = `${w.from.component ?? '?'}${w.from.cavity ? ':' + w.from.cavity : ''}`;
                    const to   = `${w.to.component   ?? '?'}${w.to.cavity   ? ':' + w.to.cavity : ''}`;
                    return `${from}\u2009\u2192\u2009${to}`;
                  }).filter(Boolean);
              const isBlocked = resolvedDecision.overallDecision === 'BLOCKED';
              if (!isBlocked || blockedList.length === 0) return null;
              return (
                <span className="text-red-600">
                  Still blocked: {blockedList.join(', ')}
                </span>
              );
            })()}
          </div>
        )}

        {/* ── Unresolved summary CTA ──────────────────────────────── */}
        {unresolvedActionCandidates.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] text-red-800 flex flex-wrap gap-2 items-center">
            <span>
              {unresolvedActionCandidates.length} unresolved wire{unresolvedActionCandidates.length === 1 ? '' : 's'}:
              {' '}
              {unresolvedActionCandidates.slice(0, 3).map(w => w.wireId).join(', ')}
            </span>
            <button
              type="button"
              onClick={() => openResolve(unresolvedActionCandidates[0].wireId)}
              className="rounded-full bg-red-600 px-3 py-1 text-[10px] font-semibold text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Resolve now
            </button>
          </div>
        )}

        {/* ── Summary stats ───────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="rounded-full bg-teal-100 px-2 py-0.5 font-semibold text-teal-800">
            {total} total
          </span>
          {reconciliation && (
            <>
              <span className={`rounded-full px-2 py-0.5 font-semibold ${
                reconciliation.summary.fullyMatched > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
              }`}>
                {reconciliation.summary.fullyMatched} matched
              </span>
              {reconciliation.summary.ambiguous > 0 && (
                <span className="rounded-full px-2 py-0.5 font-semibold bg-purple-100 text-purple-700">
                  {reconciliation.summary.ambiguous} ambiguous
                </span>
              )}
            </>
          )}
          <span className={`rounded-full px-2 py-0.5 font-semibold ${
            resolved > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
          }`}>
            {resolved} resolved
          </span>
          <span className={`rounded-full px-2 py-0.5 font-semibold ${
            partial > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'
          }`}>
            {partial} partial
          </span>
          <span className={`rounded-full px-2 py-0.5 font-semibold ${
            unresolved > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {unresolved} unresolved
          </span>
        </div>

        {/* ── T13: Topology Issues ─────────────────────────────────── */}
        {topology && topology.warnings.length > 0 && (
          <TopologyIssuesSection topology={topology} />
        )}

        {/* ── Unresolved wire IDs callout ─────────────────────────── */}
        {unresolvedWires.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] text-red-800">
            <span className="font-semibold">Unresolved wire IDs:</span>{' '}
            {unresolvedWires.join(', ')}
          </div>
        )}

        {/* ── T14: Topology visualizer ────────────────────────────── */}
        {topology && model && (
          <HarnessTopologyVisualizer
            connectivity={model}
            topology={topology}
            wireIdentities={wireIdentities}
            onWireClick={onGraphWireClick}
            onMissingPinClick={onGraphMissingPinClick}
            onBranchClick={onGraphBranchClick}
          />
        )}

        {/* ── Primary wire table ──────────────────────────────────── */}
        <div className="overflow-x-auto rounded-lg border border-[color:var(--panel-border)] relative">
          <table className="w-full text-[11px]">
            <thead className="bg-[color:var(--panel-bg)] text-[color:var(--text-secondary)] uppercase text-[10px]">
              <tr>
                <th className="px-2 py-1 text-left">Wire</th>
                <th className="px-2 py-1 text-right">Length</th>
                <th className="px-2 py-1 text-left">Gauge</th>
                <th className="px-2 py-1 text-left">Color</th>
                <th className="px-2 py-1 text-left">From</th>
                <th className="px-2 py-1 text-right">Pin</th>
                <th className="px-2 py-1 text-left">To</th>
                <th className="px-2 py-1 text-center">Confidence</th>
                <th className="px-2 py-1 text-center">Status</th>
                {hasReconciliation && <th className="px-2 py-1 text-center">Match</th>}
                <th className="px-2 py-1 text-center sticky right-0 bg-[color:var(--panel-bg)]">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedWires.slice(0, 100).map(wire => (
                <WireEvidenceRow
                  key={`${wire.wireId}-${wire.sourceRowIndex}`}
                  wire={wire}
                  reconciledWire={reconciledByWireId.get(wire.wireId)}
                  hasReconciliation={hasReconciliation}
                  operatorOverride={overrideMap.get(wire.wireId)}
                  onResolveSubmit={onOverrideSubmit}
                  activeResolveWireId={activeResolveWireId}
                  onActivateResolve={openResolve}
                  onResolveFormClose={closeResolve}
                  wireIdentity={wireIdentities?.bySourceRowIndex.get(wire.sourceRowIndex) ?? wireIdentities?.byOriginalId.get(wire.wireId)}
                  componentOptions={finalComponentOptions}
                  componentOptionLookups={componentOptionLookups}
                  isDegradedMode={isDegradedMode}
                  componentOptionsSource={finalComponentOptionsSource}
                />
              ))}
            </tbody>
          </table>
          {wires.length > 100 && (
            <div className="px-2 py-1 text-[10px] text-gray-400">
              Showing first 100 of {wires.length} wires
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
