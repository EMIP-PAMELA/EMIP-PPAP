'use client';

/**
 * HarnessTopologyVisualizer — Phase T14
 *
 * Deterministic SVG visualization of the harness topology graph.
 *
 * Governance:
 *   - Read-only / no mutations. Purely derived from effectiveState.
 *   - No layout engine, no AI. Deterministic column + row placement.
 *   - All issue highlights come from topology.warnings — never re-derived here.
 *   - Does NOT modify T13 logic or any upstream service.
 */

import React, { useState, useMemo } from 'react';
import type {
  HarnessConnectivityResult,
} from '@/src/features/harness-work-instructions/services/harnessConnectivityService';
import type {
  HarnessTopologyResult,
  TopologyEdge,
  MissingWireCandidate,
} from '@/src/features/harness-work-instructions/services/harnessTopologyService';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const COL_W    = 110;  // connector column width
const COL_PAD  = 10;   // horizontal padding inside connector box
const COL_GAP  = 200;  // gap between adjacent columns
const PIN_H    = 27;   // height per pin slot
const HEADER_H = 38;   // connector header height
const PAD_X    = 28;   // canvas left/right padding
const PAD_Y    = 22;   // canvas top/bottom padding
const PIN_R    = 5;    // pin circle radius
const STUB_LEN = 68;   // stub line for non-column endpoint
const TERM_W   = 68;   // inline termination label box width
const TERM_H   = 18;   // inline termination label box height

// ---------------------------------------------------------------------------
// Wire color map (3-letter prefix → CSS hex)
// ---------------------------------------------------------------------------

const WIRE_COLORS: Record<string, string> = {
  BRN: '#92400e', BLK: '#1f2937', RED: '#dc2626', WHT: '#9ca3af',
  BLU: '#2563eb', GRN: '#16a34a', YEL: '#d97706', ORG: '#ea580c',
  PNK: '#db2777', PUR: '#7c3aed', GRY: '#6b7280', TAN: '#b45309',
  VIO: '#7c3aed', LIM: '#65a30d', TEL: '#0d9488', SHD: '#94a3b8',
  SHI: '#94a3b8',
};

function wireStroke(color: string | null | undefined): string {
  if (!color) return '#94a3b8';
  return WIRE_COLORS[color.toUpperCase().slice(0, 3)] ?? '#94a3b8';
}

// ---------------------------------------------------------------------------
// Layout types
// ---------------------------------------------------------------------------

interface PinSlot {
  nodeId: string | null;
  cavity: string;
  y: number;
  isMissing: boolean;
  wireIds: string[];
}

interface ConnectorColumn {
  component: string;
  displayName: string;
  x: number;
  pins: PinSlot[];
  boxHeight: number;
}

interface Pos { x: number; y: number }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function numericCavity(s: string): number {
  const n = parseInt(s, 10);
  return isNaN(n) ? Infinity : n;
}

function endpointDesc(ep: HarnessConnectivityResult['wires'][number]['from']): string {
  const parts: string[] = [];
  if (ep.component) parts.push(ep.component);
  if (ep.cavity)    parts.push(`pin ${ep.cavity}`);
  if (ep.terminationType && ep.terminationType !== 'UNKNOWN') parts.push(`[${ep.terminationType}]`);
  return parts.join(' ') || '—';
}

// ---------------------------------------------------------------------------
// Layout builder
// ---------------------------------------------------------------------------

function buildLayout(topology: HarnessTopologyResult): {
  columns: ConnectorColumn[];
  nodePos: Map<string, Pos>;
  missingPos: Map<string, Pos>;
  svgWidth: number;
  svgHeight: number;
} {
  // Group CONNECTOR_PIN (or cavity-bearing) nodes by component
  const byComp = new Map<string, typeof topology.nodes[number][]>();
  for (const node of topology.nodes) {
    if (node.terminationType === 'CONNECTOR_PIN' || node.cavity !== null) {
      const key = node.component.toLowerCase();
      if (!byComp.has(key)) byComp.set(key, []);
      byComp.get(key)!.push(node);
    }
  }

  // Group missing candidates by component
  const missingByComp = new Map<string, MissingWireCandidate[]>();
  for (const c of topology.missingWireCandidates) {
    const key = c.component.toLowerCase();
    if (!missingByComp.has(key)) missingByComp.set(key, []);
    missingByComp.get(key)!.push(c);
  }

  const sortedComps = [...byComp.keys()].sort();
  const columns: ConnectorColumn[] = [];
  const nodePos    = new Map<string, Pos>();
  const missingPos = new Map<string, Pos>();

  let colX = PAD_X;

  for (const compKey of sortedComps) {
    const nodes   = byComp.get(compKey)!;
    const missing = missingByComp.get(compKey) ?? [];

    // Build pin slots, deduplicating by cavity
    const seen = new Set<string>();
    const slots: PinSlot[] = [];

    for (const n of nodes) {
      const cKey = (n.cavity ?? '?').toLowerCase();
      if (!seen.has(cKey)) { seen.add(cKey); slots.push({ nodeId: n.id, cavity: n.cavity ?? '?', y: 0, isMissing: false, wireIds: n.wireIds }); }
    }
    for (const m of missing) {
      const cKey = m.missingCavity.toLowerCase();
      if (!seen.has(cKey)) { seen.add(cKey); slots.push({ nodeId: null, cavity: m.missingCavity, y: 0, isMissing: true, wireIds: [] }); }
    }

    slots.sort((a, b) => numericCavity(a.cavity) - numericCavity(b.cavity));

    let slotY = PAD_Y + HEADER_H;
    const cx = colX + COL_W / 2;
    for (const slot of slots) {
      slot.y = slotY + PIN_H / 2;
      if (slot.nodeId)   nodePos.set(slot.nodeId, { x: cx, y: slot.y });
      else               missingPos.set(`${compKey}:${slot.cavity.toLowerCase()}`, { x: cx, y: slot.y });
      slotY += PIN_H;
    }

    const boxHeight = HEADER_H + slots.length * PIN_H;
    columns.push({ component: compKey, displayName: nodes[0].component, x: colX, pins: slots, boxHeight });
    colX += COL_W + COL_GAP;
  }

  const rightEdge = columns.length > 0 ? columns[columns.length - 1].x + COL_W + STUB_LEN + TERM_W + PAD_X : 400;
  const svgWidth  = Math.max(rightEdge, 400);
  const svgHeight = Math.max(...columns.map(c => c.boxHeight + PAD_Y * 2), 120) + PAD_Y;

  return { columns, nodePos, missingPos, svgWidth, svgHeight };
}

// ---------------------------------------------------------------------------
// Wire auto-labels
// ---------------------------------------------------------------------------

function buildWireLabels(edges: TopologyEdge[]): Map<string, string> {
  const sourceCount = new Map<string, string[]>();
  for (const e of edges) {
    if (e.fromNodeId) {
      if (!sourceCount.has(e.fromNodeId)) sourceCount.set(e.fromNodeId, []);
      sourceCount.get(e.fromNodeId)!.push(e.wireId);
    }
  }

  const labels  = new Map<string, string>();
  const handled = new Set<string>();
  let seq = 1;

  for (const e of edges) {
    if (handled.has(e.wireId)) continue;
    const siblings = e.fromNodeId ? (sourceCount.get(e.fromNodeId) ?? []) : [];
    if (siblings.length > 1) {
      const base = `W${seq++}`;
      siblings.forEach((wid, i) => { labels.set(wid, `${base}${String.fromCharCode(65 + i)}`); handled.add(wid); });
    } else {
      labels.set(e.wireId, `W${seq++}`);
      handled.add(e.wireId);
    }
  }
  return labels;
}

// ---------------------------------------------------------------------------
// Warning index
// ---------------------------------------------------------------------------

function buildWarningIndex(topology: HarnessTopologyResult) {
  const danglingNodes = new Set(topology.warnings.filter(w => w.code === 'DANGLING_ENDPOINT').flatMap(w => w.affectedNodeIds));
  const branchNodes   = new Set(topology.warnings.filter(w => w.code === 'UNDECLARED_BRANCH').flatMap(w => w.affectedNodeIds));
  const isolatedWires = new Set(topology.warnings.filter(w => w.code === 'ISOLATED_SUBGRAPH').flatMap(w => w.affectedWireIds));
  return { danglingNodes, branchNodes, isolatedWires };
}

// ---------------------------------------------------------------------------
// Edge routing
// ---------------------------------------------------------------------------

function portX(nodeId: string, nodePos: Map<string, Pos>, columns: ConnectorColumn[], otherPos: Pos | null): number {
  const pos = nodePos.get(nodeId);
  if (!pos) return 0;
  const col = columns.find(c => c.pins.some(p => p.nodeId === nodeId));
  if (!col) return pos.x;
  if (!otherPos) return col.x + COL_W + COL_PAD;
  return otherPos.x > pos.x ? col.x + COL_W + COL_PAD : col.x - COL_PAD;
}

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
}

// ---------------------------------------------------------------------------
// Hover state
// ---------------------------------------------------------------------------

interface TooltipInfo {
  wireId: string; label: string; color: string | null;
  length: number | null; lengthUnit: string | null;
  fromDesc: string; toDesc: string;
  svgX: number; svgY: number;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HarnessTopologyVisualizerProps {
  connectivity: HarnessConnectivityResult;
  topology: HarnessTopologyResult;
  /** T14.5: Click a wire edge — fires with the wireId. */
  onWireClick?: (wireId: string) => void;
  /** T14.5: Click a missing-pin placeholder — pre-fill add-wire editor. */
  onMissingPinClick?: (payload: { component: string; cavity: string }) => void;
  /** T14.5: Click an undeclared-branch pin — open declare-branch editor. */
  onBranchClick?: (payload: { component: string; cavity: string; wireIds: string[] }) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HarnessTopologyVisualizer({
  connectivity,
  topology,
  onWireClick,
  onMissingPinClick,
  onBranchClick,
}: HarnessTopologyVisualizerProps) {
  const [tooltip, setTooltip]         = useState<TooltipInfo | null>(null);
  const [hoveredWireId, setHoveredWireId] = useState<string | null>(null);

  const { columns, nodePos, missingPos, svgWidth, svgHeight } = useMemo(
    () => buildLayout(topology), [topology],
  );

  const wireLabels = useMemo(() => buildWireLabels(topology.edges), [topology.edges]);
  const { danglingNodes, branchNodes, isolatedWires } = useMemo(() => buildWarningIndex(topology), [topology]);

  const wireMap = useMemo(
    () => new Map(connectivity.wires.map(w => [w.wireId, w])),
    [connectivity.wires],
  );

  console.log('[T14 VISUALIZER]', { nodes: topology.nodes.length, edges: topology.edges.length });

  if (columns.length === 0) return null;

  // ── Isolated subgraph bounding boxes ──────────────────────────────────────
  const isolatedRects = topology.isolatedSubgraphs
    .filter(sg => sg.isIsolated)
    .map(sg => {
      const pts = sg.nodeIds.map(id => nodePos.get(id)).filter(Boolean) as Pos[];
      if (pts.length === 0) return null;
      const xs = pts.map(p => p.x); const ys = pts.map(p => p.y);
      const mx = Math.min(...xs); const my = Math.min(...ys);
      const Mx = Math.max(...xs); const My = Math.max(...ys);
      return { x: mx - 22, y: my - 16, w: Mx - mx + 44, h: My - my + 32 };
    })
    .filter(Boolean) as { x: number; y: number; w: number; h: number }[];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-semibold text-slate-600">Harness Graph</span>
        {(onWireClick || onMissingPinClick || onBranchClick) && (
          <span className="text-[9px] text-slate-400 italic">click to edit</span>
        )}
        <span className="text-[10px] text-slate-400">
          {topology.nodes.length} nodes · {topology.edges.length} wires
        </span>
        {topology.missingWireCandidates.length > 0 && (
          <span className="rounded-full bg-rose-100 text-rose-700 px-1.5 py-0.5 text-[9px] font-semibold">
            {topology.missingWireCandidates.length} missing
          </span>
        )}
      </div>

      <div className="overflow-x-auto" style={{ position: 'relative' }}>
        <svg
          width={svgWidth}
          height={svgHeight}
          style={{ display: 'block', minHeight: 80 }}
          onMouseLeave={() => { setTooltip(null); setHoveredWireId(null); }}
        >
          {/* ── Isolated subgraph borders ─────────────────────────── */}
          {isolatedRects.map((r, i) => (
            <g key={`iso-${i}`}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h}
                rx={6} ry={6}
                fill="none" stroke="#a855f7" strokeWidth={1} strokeDasharray="5 3" opacity={0.5} />
              <text x={r.x + 6} y={r.y - 4} fontSize={8} fill="#a855f7" fontWeight="600">ISOLATED</text>
            </g>
          ))}

          {/* ── Connector columns ─────────────────────────────────── */}
          {columns.map(col => (
            <g key={col.component}>
              {/* Box */}
              <rect
                x={col.x - 4} y={PAD_Y}
                width={COL_W + 8} height={col.boxHeight}
                rx={5} ry={5}
                fill="white" stroke="#cbd5e1" strokeWidth={1}
              />
              {/* Header */}
              <rect
                x={col.x - 4} y={PAD_Y}
                width={COL_W + 8} height={HEADER_H}
                rx={5} ry={5}
                fill="#f1f5f9"
              />
              <rect x={col.x - 4} y={PAD_Y + HEADER_H - 5} width={COL_W + 8} height={5} fill="#f1f5f9" />
              <text
                x={col.x + COL_W / 2} y={PAD_Y + HEADER_H / 2 + 4}
                textAnchor="middle" fontSize={10} fontWeight="700" fill="#334155"
              >
                {col.displayName.toUpperCase()}
              </text>

              {/* Pin slots */}
              {col.pins.map(slot => {
                const isDangling = slot.nodeId ? danglingNodes.has(slot.nodeId) : false;
                const isBranch   = slot.nodeId ? branchNodes.has(slot.nodeId)   : false;
                const cx = col.x + COL_W / 2;

                if (slot.isMissing) {
                  return (
                    <g key={`miss-${slot.cavity}`}
                      style={{ cursor: onMissingPinClick ? 'pointer' : 'default' }}
                      onClick={() => onMissingPinClick?.({ component: col.displayName, cavity: slot.cavity })}
                    >
                      {/* Invisible hit area */}
                      <rect x={cx - 30} y={slot.y - PIN_H / 2} width={160} height={PIN_H}
                        fill="transparent" />
                      {/* Dashed placeholder */}
                      <line
                        x1={cx + PIN_R + 2} y1={slot.y}
                        x2={cx + PIN_R + 44} y2={slot.y}
                        stroke="#fca5a5" strokeWidth={1.5} strokeDasharray="4 3"
                      />
                      <circle cx={cx} cy={slot.y} r={PIN_R + 2}
                        fill="none" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 2" />
                      <text x={cx + PIN_R + 46} y={slot.y + 3.5}
                        fontSize={8} fill="#ef4444" fontWeight="600">
                        Pin {slot.cavity} (missing)
                      </text>
                      {onMissingPinClick && (
                        <text x={cx + PIN_R + 46} y={slot.y + 13}
                          fontSize={7} fill="#f97316" fontWeight="500">
                          → click to add
                        </text>
                      )}
                      <text x={cx - PIN_R - 3} y={slot.y + 3.5}
                        textAnchor="end" fontSize={9} fill="#64748b">{slot.cavity}</text>
                    </g>
                  );
                }

                return (
                  <g key={slot.nodeId ?? slot.cavity}
                    style={{ cursor: isBranch && onBranchClick ? 'pointer' : 'default' }}
                    onClick={isBranch ? () => onBranchClick?.({ component: col.displayName, cavity: slot.cavity, wireIds: slot.wireIds }) : undefined}
                  >
                    {/* Branch highlight ring */}
                    {isBranch && (
                      <circle cx={cx} cy={slot.y} r={PIN_R + 5}
                        fill="none" stroke="#f97316" strokeWidth={1.5} />
                    )}
                    {/* Dangling highlight ring */}
                    {isDangling && !isBranch && (
                      <circle cx={cx} cy={slot.y} r={PIN_R + 4}
                        fill="#fee2e2" stroke="#ef4444" strokeWidth={1.5} />
                    )}
                    {/* Pin circle */}
                    <circle
                      cx={cx} cy={slot.y} r={PIN_R}
                      fill={isDangling ? '#ef4444' : isBranch ? '#f97316' : '#3b82f6'}
                      stroke="white" strokeWidth={1.5}
                    />
                    {/* Cavity label */}
                    <text x={cx - PIN_R - 5} y={slot.y + 3.5}
                      textAnchor="end" fontSize={9} fill="#475569">{slot.cavity}</text>
                    {/* Dangling OPEN tag */}
                    {isDangling && (
                      <text x={cx + PIN_R + 4} y={slot.y + 3.5}
                        fontSize={8} fill="#ef4444" fontWeight="600">OPEN</text>
                    )}
                    {/* Undeclared branch tag */}
                    {isBranch && (
                      <text x={cx + PIN_R + 4} y={slot.y + 3.5}
                        fontSize={8} fill="#f97316" fontWeight="600">BRANCH?</text>
                    )}
                  </g>
                );
              })}
            </g>
          ))}

          {/* ── Wire edges ────────────────────────────────────────── */}
          {topology.edges.map(edge => {
            const wire    = wireMap.get(edge.wireId);
            const label   = wireLabels.get(edge.wireId) ?? edge.wireId;
            const stroke  = wireStroke(wire?.color);
            const isIso   = isolatedWires.has(edge.wireId);

            const fromPos = edge.fromNodeId ? nodePos.get(edge.fromNodeId) : null;
            const toPos   = edge.toNodeId   ? nodePos.get(edge.toNodeId)   : null;

            // Both ends untracked — skip
            if (!fromPos && !toPos) return null;

            let x1: number, y1: number, x2: number, y2: number;
            let showFromStub = false;
            let showToStub   = false;
            let fromTermType = wire?.from.terminationType;
            let toTermType   = wire?.to.terminationType;

            if (fromPos && toPos) {
              x1 = portX(edge.fromNodeId!, nodePos, columns, toPos);
              y1 = fromPos.y;
              x2 = portX(edge.toNodeId!, nodePos, columns, fromPos);
              y2 = toPos.y;
            } else if (fromPos) {
              // TO end not in any column — stub to the right
              x1 = portX(edge.fromNodeId!, nodePos, columns, null);
              y1 = fromPos.y;
              x2 = x1 + STUB_LEN;
              y2 = y1;
              showToStub = true;
            } else {
              // FROM end not in any column — stub from the left
              x2 = portX(edge.toNodeId!, nodePos, columns, null);
              y2 = toPos!.y;
              x1 = x2 - STUB_LEN;
              y1 = y2;
              showFromStub = true;
            }

            const mx    = (x1 + x2) / 2;
            const lx    = mx;
            const ly    = (y1 + y2) / 2 - 5;
            const path  = bezierPath(x1, y1, x2, y2);
            const isoDash = isIso ? '6 3' : undefined;

            return (
              <g key={edge.wireId}>
                {/* Clickable invisible fat stroke for hover */}
                <path d={path} fill="none" stroke="transparent" strokeWidth={10}
                  style={{ cursor: onWireClick ? 'pointer' : 'default' }}
                  onClick={() => onWireClick?.(edge.wireId)}
                  onMouseEnter={ev => {
                    setHoveredWireId(edge.wireId);
                    const svgEl = (ev.target as SVGPathElement).ownerSVGElement!;
                    const rect  = svgEl.getBoundingClientRect();
                    setTooltip({
                      wireId: edge.wireId, label,
                      color: wire?.color ?? null,
                      length: wire?.length ?? null,
                      lengthUnit: wire?.lengthUnit ?? null,
                      fromDesc: wire ? endpointDesc(wire.from) : '—',
                      toDesc:   wire ? endpointDesc(wire.to)   : '—',
                      svgX: ev.clientX - rect.left + 10,
                      svgY: ev.clientY - rect.top  - 10,
                    });
                  }}
                  onMouseLeave={() => { setHoveredWireId(null); setTooltip(null); }}
                />
                {/* Visible wire path */}
                <path d={path} fill="none"
                  stroke={stroke}
                  strokeWidth={hoveredWireId === edge.wireId ? 3.5 : 1.8}
                  strokeDasharray={isoDash}
                  opacity={hoveredWireId === edge.wireId ? 1 : 0.85}
                  style={{ pointerEvents: 'none' }}
                />
                {/* Wire label */}
                <text x={lx} y={ly} textAnchor="middle"
                  fontSize={8} fill="#64748b" fontWeight="500"
                  style={{ pointerEvents: 'none' }}>
                  {label}
                </text>
                {/* FROM stub termination box */}
                {showFromStub && (
                  <g>
                    <rect x={x1 - TERM_W} y={y1 - TERM_H / 2}
                      width={TERM_W} height={TERM_H}
                      rx={3} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1} />
                    <text x={x1 - TERM_W / 2} y={y1 + 3.5}
                      textAnchor="middle" fontSize={8} fill="#475569">
                      {fromTermType ?? 'TERM'}
                    </text>
                  </g>
                )}
                {/* TO stub termination box */}
                {showToStub && (
                  <g>
                    <rect x={x2} y={y2 - TERM_H / 2}
                      width={TERM_W} height={TERM_H}
                      rx={3} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1} />
                    <text x={x2 + TERM_W / 2} y={y2 + 3.5}
                      textAnchor="middle" fontSize={8} fill="#475569">
                      {toTermType ?? 'TERM'}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* ── Hover tooltip ─────────────────────────────────────── */}
          {tooltip && (
            <foreignObject
              x={Math.min(tooltip.svgX, svgWidth - 170)}
              y={Math.max(tooltip.svgY - 80, 4)}
              width={160} height={90}
              style={{ pointerEvents: 'none' }}
            >
              <div
                style={{ fontSize: 10, background: 'white', border: '1px solid #e2e8f0',
                  borderRadius: 6, padding: '6px 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  lineHeight: 1.5 }}
              >
                <div style={{ fontWeight: 700, marginBottom: 3 }}>
                  {tooltip.label} <span style={{ color: '#94a3b8', fontWeight: 400 }}>{tooltip.wireId}</span>
                </div>
                {tooltip.color && (
                  <div>Color: <strong>{tooltip.color}</strong></div>
                )}
                {tooltip.length !== null && (
                  <div>Length: <strong>{tooltip.length}{tooltip.lengthUnit ?? ''}</strong></div>
                )}
                <div style={{ color: '#64748b' }}>From: {tooltip.fromDesc}</div>
                <div style={{ color: '#64748b' }}>To: {tooltip.toDesc}</div>
              </div>
            </foreignObject>
          )}
        </svg>
      </div>
    </div>
  );
}
