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

import React, { useEffect, useState } from 'react';
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
import type { WireOperatorOverride, WireResolutionMode } from '@/src/features/vault/types/ingestionReview';
import type { HarnessTopologyResult, TopologyWarning } from '@/src/features/harness-work-instructions/services/harnessTopologyService';
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
}: {
  wireId: string;
  onSave: (override: WireOperatorOverride) => void;
  onCancel: () => void;
}) {
  const [mode, setMode]       = useState<WireResolutionMode>('DIRECT_OVERRIDE');
  const [fromComp, setFromComp] = useState('');
  const [fromCav,  setFromCav]  = useState('');
  const [toComp,   setToComp]   = useState('');
  const [toCav,    setToCav]    = useState('');
  const [srcComp,  setSrcComp]  = useState('');
  const [srcCav,   setSrcCav]   = useState('');
  const [secCav,   setSecCav]   = useState('');
  const [ferrPN,   setFerrPN]   = useState('');
  const [termPN,   setTermPN]   = useState('');
  const [notes,    setNotes]    = useState('');
  const [reason,   setReason]   = useState('');
  const [err,      setErr]      = useState<string | null>(null);

  const handleSave = () => {
    if (!reason.trim()) { setErr('Reason is required.'); return; }
    if (mode === 'BRANCH_DOUBLE_CRIMP') {
      if (!srcComp.trim() || !srcCav.trim()) { setErr('Shared source component and cavity are required.'); return; }
      if (!termPN.trim() && !ferrPN.trim())  { setErr('Terminal PN or ferrule PN is required.'); return; }
    }
    setErr(null);
    const override: WireOperatorOverride = {
      wireId,
      mode,
      ...(mode === 'DIRECT_OVERRIDE' ? {
        from: { component: fromComp.trim() || null, cavity: fromCav.trim() || null, treatment: null },
        to:   { component: toComp.trim()   || null, cavity: toCav.trim()   || null, treatment: null },
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
    onSave(override);
  };

  const inp = 'w-full rounded border border-[color:var(--panel-border)] bg-[color:var(--input-bg)] px-1.5 py-0.5 text-[11px] text-[color:var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-blue-400';
  const lab = 'text-[10px] font-semibold text-gray-500 mb-0.5 block';

  return (
    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-2 space-y-2">
      <div className="font-semibold text-blue-800 text-[10px]">⚙️ Operator Resolution — Wire {wireId}</div>

      <div>
        <label className={lab}>Resolution Mode</label>
        <select value={mode} onChange={e => setMode(e.target.value as WireResolutionMode)} className={inp}>
          {(Object.keys(RESOLVE_MODE_LABELS) as WireResolutionMode[]).map(m => (
            <option key={m} value={m}>{RESOLVE_MODE_LABELS[m]}</option>
          ))}
        </select>
      </div>

      {mode === 'DIRECT_OVERRIDE' && (
        <div className="grid grid-cols-2 gap-2">
          <div><label className={lab}>From Component</label><input value={fromComp} onChange={e => setFromComp(e.target.value)} placeholder="e.g. CONN-1" className={inp} /></div>
          <div><label className={lab}>From Cavity / Pin</label><input value={fromCav}  onChange={e => setFromCav(e.target.value)}  placeholder="e.g. 2"      className={inp} /></div>
          <div><label className={lab}>To Component</label><input   value={toComp}   onChange={e => setToComp(e.target.value)}   placeholder="e.g. 61944-1" className={inp} /></div>
          <div><label className={lab}>To Cavity / Pin</label><input   value={toCav}    onChange={e => setToCav(e.target.value)}    placeholder="e.g. 5"      className={inp} /></div>
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
}: HarnessConnectivityPanelProps) {
  const model = connectivity ?? harnessConnectivity ?? null;
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
            {resolvedDecision.blockedWires.length > 0 && (
              <span className="text-red-600">
                Still blocked: {resolvedDecision.blockedWires.map(wid => {
                  const ident = wireIdentities?.byOriginalId.get(wid);
                  if (ident?.internalWireId && ident.internalWireId !== wid) return ident.internalWireId;
                  const w = model?.wires.find(x => x.wireId === wid);
                  if (!w) return wid;
                  const f = `${w.from.component ?? '?'}${w.from.cavity ? ':' + w.from.cavity : ''}`;
                  const t = `${w.to.component ?? '?'}${w.to.cavity ? ':' + w.to.cavity : ''}`;
                  return `${f}\u2009\u2192\u2009${t}`;
                }).join(', ')}
              </span>
            )}
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
