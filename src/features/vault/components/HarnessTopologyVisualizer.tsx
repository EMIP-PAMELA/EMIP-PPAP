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

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type {
  HarnessConnectivityResult,
} from '@/src/features/harness-work-instructions/services/harnessConnectivityService';
import type {
  HarnessTopologyResult,
  TopologyEdge,
  TopologyNode,
  MissingWireCandidate,
} from '@/src/features/harness-work-instructions/services/harnessTopologyService';
import type { WireIdentityResult } from '@/src/features/harness-work-instructions/services/wireIdentityService';

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
const TERM_W   = 80;   // inline termination label box width
const TERM_H   = 18;   // inline termination label box height
const FANOUT_SPACING     = 16;  // px between wires sharing a source pin
const PANEL_MIN_HEIGHT   = 420;
const PANEL_MAX_HEIGHT   = 1100;
const DEFAULT_PANEL_HEIGHT = 640;

// ---------------------------------------------------------------------------
// Wire color map (3-letter prefix → CSS hex)
// ---------------------------------------------------------------------------

const WIRE_COLORS: Record<string, string> = {
  BRN: '#92400e', BLK: '#1f2937', RED: '#dc2626', WHT: '#e2e8f0',
  BLU: '#2563eb', GRN: '#16a34a', YEL: '#eab308', ORG: '#f97316',
  PNK: '#ec4899', PUR: '#7c3aed', GRY: '#94a3b8', TAN: '#d6a55b',
  VIO: '#7c3aed', LIM: '#65a30d', TEL: '#0d9488', SHD: '#94a3b8',
  SHI: '#94a3b8',
};

const NAMED_WIRE_COLORS: Record<string, string> = {
  white: '#e2e8f0',
  black: '#1f2937',
  blue: '#2563eb',
  red: '#dc2626',
  green: '#16a34a',
  yellow: '#eab308',
  orange: '#f97316',
  brown: '#8b4513',
  grey: '#94a3b8',
  gray: '#94a3b8',
  purple: '#7c3aed',
  pink: '#ec4899',
  tan: '#d6a55b',
};

interface WireColorStyle {
  stroke: string;
  dash?: string;
}

function canonicalColorHex(token: string | null | undefined): string {
  if (!token) return '#999';
  const normalized = token.trim().toLowerCase();
  if (!normalized) return '#999';
  if (NAMED_WIRE_COLORS[normalized]) return NAMED_WIRE_COLORS[normalized];
  const prefix = normalized.slice(0, 3).toUpperCase();
  return WIRE_COLORS[prefix] ?? '#94a3b8';
}

function mapWireColor(rawColor: string | null | undefined): WireColorStyle {
  if (!rawColor) return { stroke: '#999' };
  const normalized = rawColor.replace(/\s+stripe/gi, '').trim().toLowerCase();
  const parts = normalized.split(/[/,\\+]/).map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const primary = parts.find(p => !p.includes('white')) ?? parts[0];
    return { stroke: canonicalColorHex(primary), dash: '4 2' };
  }
  return { stroke: canonicalColorHex(parts[0]) };
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
  // T23.6.22: Group only true CONNECTOR_PIN nodes (no shared-ferrule aliases) by canonical component.
  // This eliminates duplicate internal nodes and ferrule entries from the visual layout.
  const byComp = new Map<string, typeof topology.nodes[number][]>();
  for (const node of topology.nodes) {
    if (
      node.terminationType === 'CONNECTOR_PIN' &&
      node.cavity !== null &&
      !node.isSharedFerrule
    ) {
      const key = node.canonicalComponent || node.component.toLowerCase();
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
    columns.push({ component: compKey, displayName: nodes[0].displayName || nodes[0].component, x: colX, pins: slots, boxHeight });
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

/**
 * T23.6.31: Resolve the visual node ID for an edge endpoint.
 * Ferrule nodes store a mountedAtNodeId pointing to the cavity node that
 * actually has a position in nodePos. Without this resolution, edges whose
 * endpoints are ferrule nodes are skipped because nodePos has no entry for
 * the ferrule node ID.
 */
function resolveVisualId(
  nodeId: string | null,
  nodeIndex: Map<string, TopologyNode>,
): string | null {
  if (!nodeId) return null;
  const node = nodeIndex.get(nodeId);
  return node?.mountedAtNodeId ?? nodeId;
}

function buildWireLabels(
  edges: TopologyEdge[],
  nodeIndex: Map<string, TopologyNode>,
): Map<string, string> {
  const sourceCount = new Map<string, string[]>();
  for (const e of edges) {
    const resolvedFrom = resolveVisualId(e.fromNodeId, nodeIndex);
    if (resolvedFrom) {
      if (!sourceCount.has(resolvedFrom)) sourceCount.set(resolvedFrom, []);
      sourceCount.get(resolvedFrom)!.push(e.wireId);
    }
  }

  const labels  = new Map<string, string>();
  const handled = new Set<string>();
  let seq = 1;

  for (const e of edges) {
    if (handled.has(e.wireId)) continue;
    const resolvedFrom = resolveVisualId(e.fromNodeId, nodeIndex);
    const siblings = resolvedFrom ? (sourceCount.get(resolvedFrom) ?? []) : [];
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

type FanoutIndex = Map<string, { total: number; order: Map<string, number> }>;

function buildFanoutIndex(
  edges: TopologyEdge[],
  nodeIndex: Map<string, TopologyNode>,
): FanoutIndex {
  const buckets = new Map<string, string[]>();
  for (const edge of edges) {
    const key = resolveVisualId(edge.fromNodeId, nodeIndex) ?? edge.fromNodeId ?? `__null:${edge.wireId}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(edge.wireId);
  }

  const result: FanoutIndex = new Map();
  buckets.forEach((wireIds, key) => {
    const order = new Map<string, number>();
    wireIds.forEach((wid, idx) => order.set(wid, idx));
    result.set(key, { total: wireIds.length, order });
  });

  return result;
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
  /** T15: Wire identity assignments (internalWireId / customerWireId). When absent, falls back to local label generation. */
  wireIdentities?: WireIdentityResult | null;
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
  wireIdentities,
  onWireClick,
  onMissingPinClick,
  onBranchClick,
}: HarnessTopologyVisualizerProps) {
  const [tooltip, setTooltip]         = useState<TooltipInfo | null>(null);
  const [hoveredWireId, setHoveredWireId] = useState<string | null>(null);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_HEIGHT);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dragState = useRef<{ startY: number; startHeight: number } | null>(null);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!dragState.current) return;
    const delta = event.clientY - dragState.current.startY;
    const next = Math.min(
      PANEL_MAX_HEIGHT,
      Math.max(PANEL_MIN_HEIGHT, dragState.current.startHeight + delta),
    );
    setPanelHeight(next);
  }, []);

  const stopDragging = useCallback(() => {
    if (!dragState.current) return;
    dragState.current = null;
    document.body.style.removeProperty('user-select');
    document.body.style.removeProperty('cursor');
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', stopDragging);
  }, [handleMouseMove]);

  const handleResizeStart = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    dragState.current = { startY: event.clientY, startHeight: panelHeight };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDragging);
  }, [panelHeight, handleMouseMove, stopDragging]);

  useEffect(() => () => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', stopDragging);
  }, [handleMouseMove, stopDragging]);

  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  const { columns, nodePos, missingPos, svgWidth, svgHeight } = useMemo(
    () => buildLayout(topology), [topology],
  );

  const nodeIndex = useMemo<Map<string, TopologyNode>>(
    () => new Map(topology.nodes.map(n => [n.id, n])),
    [topology.nodes],
  );

  const wireLabels = useMemo(
    () => buildWireLabels(topology.edges, nodeIndex),
    [topology.edges, nodeIndex],
  );
  const { danglingNodes, branchNodes, isolatedWires } = useMemo(() => buildWarningIndex(topology), [topology]);

  const wireMap = useMemo(
    () => new Map(connectivity.wires.map(w => [w.wireId, w])),
    [connectivity.wires],
  );

  const fanoutIndex = useMemo(
    () => buildFanoutIndex(topology.edges, nodeIndex),
    [topology.edges, nodeIndex],
  );

  console.log('[T14 VISUALIZER]', { nodes: topology.nodes.length, edges: topology.edges.length });
  {
    const edgesByFrom = new Map<string, string[]>();
    for (const e of topology.edges) {
      const resolvedFrom = resolveVisualId(e.fromNodeId, nodeIndex);
      if (resolvedFrom) {
        if (!edgesByFrom.has(resolvedFrom)) edgesByFrom.set(resolvedFrom, []);
        edgesByFrom.get(resolvedFrom)!.push(e.wireId);
      }
    }
    edgesByFrom.forEach((targets, nodeId) => {
      console.log('[T23.6.31 VISUALIZER INPUT]', { nodeId, edgeCount: targets.length, targets });
    });
  }

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
  const renderSvg = () => (
    <svg
      width={svgWidth}
      height={svgHeight}
      style={{ display: 'block', minHeight: 120 }}
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

          {/* ── Wire edges ──────────────────────────────────────────── */}
          {topology.edges.map(edge => {
            const wire         = wireMap.get(edge.wireId);
            const idEntry      = wireIdentities?.byOriginalId.get(edge.wireId);
            const label        = idEntry?.internalWireId ?? wireLabels.get(edge.wireId) ?? edge.wireId;
            const customerLabel = idEntry?.customerWireId && idEntry.customerWireId !== label ? idEntry.customerWireId : undefined;
            const colorStyle = mapWireColor(wire?.color ?? null);
            const stroke  = colorStyle.stroke;
            const isIso   = isolatedWires.has(edge.wireId);

            const resolvedFromId  = resolveVisualId(edge.fromNodeId, nodeIndex);
            const candidateToId   = resolveVisualId(edge.toNodeId,   nodeIndex);
            // T23.6.32: Guard against self-loop collapse — if TO resolves to the same
            // visual node as FROM (ferrule over-resolution), fall back to the raw toNodeId
            // so the edge renders as a stub to the terminal instead of an invisible hairpin.
            const effectiveToId   = candidateToId === resolvedFromId
              ? edge.toNodeId
              : candidateToId;
            if (candidateToId === resolvedFromId) {
              console.log('[T23.6.32 SELF-LOOP PREVENTED]', {
                wireId: edge.wireId,
                from: edge.fromNodeId,
                to: edge.toNodeId,
                resolvedFromId,
                candidateToId,
              });
            }
            const effectiveFromId = resolvedFromId;
            const fromPos = effectiveFromId ? nodePos.get(effectiveFromId) : null;
            const toPos   = effectiveToId   ? nodePos.get(effectiveToId)   : null;

            const fanoutKey = resolvedFromId ?? edge.fromNodeId ?? `__null:${edge.wireId}`;
            const fanoutData = fanoutIndex.get(fanoutKey);
            const fanIndex = fanoutData?.order.get(edge.wireId) ?? 0;
            const fanTotal = fanoutData?.total ?? 1;
            const fanOffset = fromPos && fanTotal > 1
              ? (fanIndex - (fanTotal - 1) / 2) * FANOUT_SPACING
              : 0;
            const fanStartY = fromPos ? fromPos.y + fanOffset : null;

            // Both ends untracked — skip
            if (!fromPos && !toPos) return null;

            let x1: number, y1: number, x2: number, y2: number;
            let showFromStub = false;
            let showToStub   = false;
            let fromTermType = wire?.from.terminationType;
            let toTermType   = wire?.to.terminationType;

            const fromCol = effectiveFromId ? columns.find(c => c.pins.some(p => p.nodeId === effectiveFromId)) : null;
            const toCol   = effectiveToId   ? columns.find(c => c.pins.some(p => p.nodeId === effectiveToId))   : null;
            const isSameColumn = Boolean(fromCol && toCol && fromCol.component === toCol.component);

            if (fromPos && toPos && isSameColumn) {
              // T23.6.22: same-component wire — draw looping arc on right side of connector box
              const rx = fromCol!.x + COL_W + COL_PAD;
              const yStart = fanStartY ?? fromPos.y;
              const bulge = Math.max(Math.abs(yStart - toPos.y) * 0.6, 30);
              x1 = rx; y1 = yStart;
              x2 = rx; y2 = toPos.y;
              const path = `M ${x1} ${y1} C ${x1 + bulge} ${y1} ${x2 + bulge} ${y2} ${x2} ${y2}`;
              const lx = x1 + bulge + 4;
              const ly = (y1 + y2) / 2;
              const loopDash = isIso ? '6 3' : colorStyle.dash;
              return (
                <g key={edge.wireId}>
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
                  <path d={path} fill="none"
                    stroke={stroke}
                    strokeWidth={hoveredWireId === edge.wireId ? 4.0 : 2.5}
                    strokeDasharray={loopDash}
                    opacity={hoveredWireId === edge.wireId ? 1 : 0.9}
                    style={{ pointerEvents: 'none' }}
                  />
                  <text x={lx} y={ly} textAnchor="start"
                    fontSize={8} fill="#059669" fontWeight="600"
                    style={{ pointerEvents: 'none' }}>
                    Double Crimp
                  </text>
                  <text x={lx} y={ly + 10} textAnchor="start"
                    fontSize={7} fill="#64748b" fontWeight="400"
                    style={{ pointerEvents: 'none' }}>
                    {label}
                  </text>
                </g>
              );
            } else if (fromPos && toPos) {
              x1 = portX(effectiveFromId!, nodePos, columns, toPos);
              y1 = fanStartY ?? fromPos.y;
              x2 = portX(effectiveToId!, nodePos, columns, fromPos);
              y2 = toPos.y + fanOffset;
            } else if (fromPos) {
              // TO end not in any column — stub to the right
              x1 = portX(effectiveFromId!, nodePos, columns, null);
              y1 = fanStartY ?? fromPos.y;
              x2 = x1 + STUB_LEN;
              y2 = y1 + fanOffset * 0.35;
              showToStub = true;
            } else {
              // FROM end not in any column — stub from the left
              x2 = portX(effectiveToId!, nodePos, columns, null);
              y2 = toPos!.y;
              x1 = x2 - STUB_LEN;
              y1 = y2;
              showFromStub = true;
            }

            const mx    = (x1 + x2) / 2;
            const lx    = mx;
            const ly    = (y1 + y2) / 2 - 5;
            const path  = bezierPath(x1, y1, x2, y2);
            const strokeDasharray = isIso ? '6 3' : colorStyle.dash;
            console.log('[T23.6.33 FINAL EDGE]', { wireId: edge.wireId, y1, y2, offset: fanOffset, color: stroke });

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
                  strokeWidth={hoveredWireId === edge.wireId ? 4.0 : 2.5}
                  strokeDasharray={strokeDasharray}
                  opacity={hoveredWireId === edge.wireId ? 1 : 0.85}
                  style={{ pointerEvents: 'none' }}
                />
                {/* Wire label */}
                <text x={lx} y={ly} textAnchor="middle"
                  fontSize={8} fill="#64748b" fontWeight="500"
                  style={{ pointerEvents: 'none' }}>
                  {label}
                </text>
                {customerLabel && (
                  <text x={lx} y={ly + 9} textAnchor="middle"
                    fontSize={7} fill="#94a3b8" fontWeight="400"
                    style={{ pointerEvents: 'none' }}>
                    {customerLabel}
                  </text>
                )}
                {/* FROM stub termination box */}
                {showFromStub && (
                  <g>
                    <rect x={x1 - TERM_W} y={y1 - TERM_H / 2}
                      width={TERM_W} height={TERM_H}
                      rx={3} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1} />
                    <text x={x1 - TERM_W / 2} y={y1 + 3.5}
                      textAnchor="middle" fontSize={8} fill="#475569">
                      {wire?.from.component ?? fromTermType ?? 'TERM'}
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
                      {wire?.to.component ?? toTermType ?? 'TERM'}
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
  );

  const renderPanel = (fullscreen: boolean) => (
    <div
      className="relative rounded-xl border border-slate-200 bg-white shadow-inner"
      style={{
        height: fullscreen ? '100%' : panelHeight,
        minHeight: fullscreen ? '100%' : PANEL_MIN_HEIGHT,
        maxHeight: fullscreen ? undefined : PANEL_MAX_HEIGHT,
      }}
    >
      <div className="overflow-x-auto overflow-y-auto h-full" style={{ position: 'relative' }}>
        {renderSvg()}
      </div>
      {!fullscreen && (
        <button
          type="button"
          onMouseDown={handleResizeStart}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-slate-200 bg-white/90 px-3 py-0.5 text-[10px] font-medium text-slate-500 shadow-sm"
        >
          drag to resize
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 mb-3">
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
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={isFullscreen}
            >
              Expand View
            </button>
          </div>
        </div>

        {renderPanel(false)}
      </div>

      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
            <span className="text-sm font-semibold text-slate-700">Harness Graph — Fullscreen</span>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Close
            </button>
          </div>
          <div className="p-4" style={{ height: 'calc(100vh - 56px)' }}>
            {renderPanel(true)}
          </div>
        </div>
      )}
    </>
  );
}
