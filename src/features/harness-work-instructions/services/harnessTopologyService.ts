/**
 * Harness Topology Service — Phase T13
 *
 * Graph-based, deterministic topology analysis of harness connectivity.
 *
 * Detections:
 *   A. Missing wire candidates  — gap in connector pin numeric sequence
 *   B. Undeclared branch        — same CONNECTOR_PIN node on >1 wire without declared topology
 *   C. Isolated subgraphs       — disconnected groups of wires (union-find)
 *   D. Dangling endpoints       — wire with one connected end and one bare/unidentified end
 *
 * Governance:
 *   - Pure function. No I/O, no DB, no side effects. Never throws.
 *   - Does NOT modify original connectivity data.
 *   - Does NOT use AI or probabilistic inference.
 *   - STRIP_ONLY, FERRULE, RING, SPADE, RECEPTACLE, TERMINAL, GROUND are valid open ends.
 *   - Only HIGH confidence issues may block commit.
 *   - ISOLATED_SUBGRAPH is always WARNING only (may be intentional split harness).
 */

import type {
  HarnessConnectivityResult,
  WireConnectivity,
  WireEndpoint,
  EndpointTerminationType,
} from './harnessConnectivityService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TopologyConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type TopologyWarningCode =
  | 'MISSING_WIRE'
  | 'DANGLING_ENDPOINT'
  | 'UNDECLARED_BRANCH'
  | 'ISOLATED_SUBGRAPH';

export interface TopologyNode {
  /** Stable node identity: "component:cavity" or "component" (normalized lowercase). */
  id: string;
  /** Original/raw component label preserved for operator display. */
  component: string;
  /** Canonical human-friendly label used in UI (trimmed raw string). */
  displayName: string;
  /** Canonicalized identifier (manufacturer:part) used for graph identity. */
  canonicalComponent: string;
  /** Explicit canonical ID alias for downstream consumers. */
  canonicalId: string;
  cavity: string | null;
  terminationType: EndpointTerminationType | null;
  /** IDs of all wires whose FROM or TO endpoint maps to this node. */
  wireIds: string[];
  // T23.6.4: explicit shared-ferrule node metadata
  isSharedFerrule?: boolean;
  ferrulePartNumber?: string | null;
  mountedAtNodeId?: string | null;
}

export interface TopologyEdge {
  wireId: string;
  fromNodeId: string | null;
  toNodeId: string | null;
  /** True when the wire carries a declared BRANCH_DOUBLE_CRIMP or SPLICE topology. */
  isDeclaredBranch: boolean;
}

export interface TopologySubgraph {
  id: number;
  nodeIds: string[];
  wireIds: string[];
  /** True when this subgraph is disconnected from the rest of the harness. */
  isIsolated: boolean;
}

export interface MissingWireCandidate {
  component: string;
  canonicalComponent: string;
  missingCavity: string;
  /** Numeric cavities observed on the same connector. */
  knownCavities: string[];
  confidence: TopologyConfidence;
  reason: string;
}

export interface TopologyWarning {
  code: TopologyWarningCode;
  confidence: TopologyConfidence;
  /**
   * When true and confidence is HIGH, this warning contributes to blocking commit.
   * ISOLATED_SUBGRAPH is never blocking.
   */
  blocksCommit: boolean;
  affectedNodeIds: string[];
  affectedWireIds: string[];
  message: string;
  reason: string;
}

export interface HarnessTopologyResult {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  danglingEndpoints: TopologyNode[];
  multiWireEndpoints: TopologyNode[];
  isolatedSubgraphs: TopologySubgraph[];
  missingWireCandidates: MissingWireCandidate[];
  warnings: TopologyWarning[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * terminationType values that represent intentional open ends.
 * These are never flagged as dangling endpoints.
 */
const VALID_OPEN_END_TYPES = new Set<EndpointTerminationType>([
  'STRIP_ONLY',
  'FERRULE',
  'RING',
  'SPADE',
  'RECEPTACLE',
  'TERMINAL',
  'GROUND',
  'OTHER_TREATMENT',
]);

/**
 * Pattern in rawText that indicates declared branch/splice topology
 * from skuModelEditService (OperatorWireModel.topology field).
 */
const DECLARED_BRANCH_RE = /\[OPERATOR_MODEL:(BRANCH_DOUBLE_CRIMP|SPLICE)\]/;

/** Pattern in rawText for explicitly declared floating wire. */
const DECLARED_FLOATING_RE = /\[OPERATOR_MODEL:FLOATING\]/;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build manufacturer:part canonical key eliminating duplicates from OCR variance. */
function canonicalComponentKey(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/#/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^phoenix\s+/, 'phoenix:')
    .replace(/\s+/g, '');
}

function componentDisplayName(raw: string | null | undefined, canonical: string): string {
  const trimmed = raw?.trim();
  if (trimmed && trimmed.length > 0) return trimmed;
  return canonical.toUpperCase();
}

interface NodeIdentity {
  nodeKey: string | null;
  canonicalComponent: string | null;
}

/**
 * Build a stable node ID for an endpoint.
 * Returns null when the endpoint has no trackable component (bare wire, no PN).
 */
function resolveNodeIdentity(endpoint: WireEndpoint): NodeIdentity {
  const comp = endpoint.component?.trim();
  if (!comp) return { nodeKey: null, canonicalComponent: null };
  const canonicalComponent = canonicalComponentKey(comp);
  if (!canonicalComponent) return { nodeKey: null, canonicalComponent: null };
  console.log('[T23.6.5 CANONICAL]', { raw: comp, canonical: canonicalComponent });
  const cavity = endpoint.cavity?.trim()?.toLowerCase() ?? null;
  const nodeKey = cavity ? `${canonicalComponent}:${cavity}` : canonicalComponent;
  console.log('[T23.6.5 NODE KEY]', { nodeKey });
  return { nodeKey, canonicalComponent };
}

/**
 * T23.6.4: Build the deterministic node key for an explicit shared ferrule node.
 * Returns null for non-FERRULE endpoints or FERRULE endpoints without component+cavity.
 */
function resolveFerruleNodeId(endpoint: WireEndpoint, canonicalComponent: string): string | null {
  if (endpoint.terminationType !== 'FERRULE') return null;
  const cavity = endpoint.cavity?.trim()?.toLowerCase();
  if (!cavity) return null;
  const pn = endpoint.partNumber?.trim().replace(/[\s/-]/g, '') ?? null;
  return `${canonicalComponent}:${cavity}:ferrule${pn ? `:${pn}` : ''}`;
}

/**
 * Resolve effective terminationType for an endpoint.
 * Infers CONNECTOR_PIN when component + cavity are both present but type is unset.
 */
function resolveTerminationType(endpoint: WireEndpoint): EndpointTerminationType | null {
  const t = endpoint.terminationType;
  if (t && t !== 'UNKNOWN') return t;
  if (endpoint.component?.trim() && endpoint.cavity?.trim()) return 'CONNECTOR_PIN';
  return t ?? null;
}

/** True when this endpoint type is a known valid termination (not a dangling bare wire). */
function isValidOpenEnd(endpoint: WireEndpoint): boolean {
  const t = resolveTerminationType(endpoint);
  if (!t || t === 'UNKNOWN') return false;
  return VALID_OPEN_END_TYPES.has(t);
}

/** True when the wire declares branch or splice topology. */
function isDeclaredBranch(wire: WireConnectivity): boolean {
  if (DECLARED_BRANCH_RE.test(wire.rawText)) return true;
  if (wire.from.treatment?.toUpperCase() === 'SPLICE') return true;
  if (wire.to.treatment?.toUpperCase()   === 'SPLICE') return true;
  // T23.5: FERRULE or TERMINAL on the FROM endpoint is a physical branch
  // indicator. Extracted wires at ferrule/terminal junction points share a
  // physical crimp and do not require an explicit [OPERATOR_MODEL:] tag.
  const ft = wire.from.terminationType;
  if (ft === 'FERRULE' || ft === 'TERMINAL') return true;
  return false;
}

/** True when the wire is declared FLOATING (intentional open-ended wire). */
function isDeclaredFloating(wire: WireConnectivity): boolean {
  return DECLARED_FLOATING_RE.test(wire.rawText);
}

// ---------------------------------------------------------------------------
// T23.6.1: Shared-node anchor resolution
// ---------------------------------------------------------------------------

/** Resolution result for the shared-node anchor on a declared branch wire. */
interface SharedAnchorResolution {
  anchorNodeKey: string | null;
  remoteNodeKey: string | null;
  reason:        string | null;
  fromIsAnchor:  boolean;
}

/**
 * T23.6.1: Resolve the shared-node anchor for a declared branch wire.
 *
 * For FERRULE/TERMINAL endpoints the FROM side is always the anchor —
 * the operator wizard enforces this by locking FROM to the shared-crimp point.
 * Returns null keys for non-branch wires.
 */
function resolveSharedAnchor(wire: WireConnectivity): SharedAnchorResolution {
  if (!isDeclaredBranch(wire)) {
    return { anchorNodeKey: null, remoteNodeKey: null, reason: null, fromIsAnchor: false };
  }
  const ft = wire.from.terminationType;
  if (ft === 'FERRULE' || ft === 'TERMINAL') {
    return {
      anchorNodeKey: resolveNodeIdentity(wire.from).nodeKey,
      remoteNodeKey: resolveNodeIdentity(wire.to).nodeKey,
      reason:        `FROM endpoint is ${ft} shared-node anchor`,
      fromIsAnchor:  true,
    };
  }
  return {
    anchorNodeKey: resolveNodeIdentity(wire.from).nodeKey,
    remoteNodeKey: resolveNodeIdentity(wire.to).nodeKey,
    reason:        'declared branch topology',
    fromIsAnchor:  true,
  };
}

// ---------------------------------------------------------------------------
// Union-Find (path-compressed) for connected component detection
// ---------------------------------------------------------------------------

class UnionFind {
  private readonly parent = new Map<string, string>();

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p !== x) {
      const root = this.find(p);
      this.parent.set(x, root);
      return root;
    }
    return x;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

// ---------------------------------------------------------------------------
// Detection A: missing wire candidates
// ---------------------------------------------------------------------------

/**
 * Detect gaps in connector pin numeric sequences.
 *
 * Groups CONNECTOR_PIN nodes by component, scans for integer gaps in
 * the [min..max] cavity range.
 *
 * Only runs when:
 *   - ≥ 2 distinct numeric cavities exist on the same connector
 *   - The span does not exceed 20 (excludes very sparse connectors)
 *
 * Confidence:
 *   HIGH   when ≤ 2 total gaps exist in the sequence
 *   MEDIUM when > 2 gaps (unusual but still reported)
 */
function detectMissingWires(
  componentGroups: Map<string, Map<string, TopologyNode[]>>,
): MissingWireCandidate[] {
  const candidates: MissingWireCandidate[] = [];

  for (const [canonicalComponent, groupMap] of componentGroups) {
    const nodes = [...groupMap.values()].flat();

    // T23.6 fallback: After T23.6.1, declared branch anchors are already promoted
    // to CONNECTOR_PIN during graph construction. The FERRULE/TERMINAL clauses here
    // cover residual edge cases: non-declared branch wires whose FROM endpoint
    // carries FERRULE/TERMINAL type and was not normalized by the post-processing step.
    const displayComponent = nodes[0]?.component ?? canonicalComponent;
    const pinNodes = nodes.filter(
      n => n.cavity !== null &&
           (n.terminationType === 'CONNECTOR_PIN' ||
            n.terminationType === 'FERRULE'        ||
            n.terminationType === 'TERMINAL'       ||
            n.terminationType === null),
    );

    const numeric = pinNodes
      .map(n => ({ num: parseInt(n.cavity!, 10) }))
      .filter(x => !isNaN(x.num));

    if (numeric.length < 2) continue;

    const sorted  = numeric.sort((a, b) => a.num - b.num);
    const min     = sorted[0].num;
    const max     = sorted[sorted.length - 1].num;

    if (max - min > 20) continue;

    const present       = new Set(sorted.map(x => x.num));
    const knownCavities = sorted.map(x => String(x.num));
    const gapCount      = max - min + 1 - present.size;

    console.log('[T23.6.1 MISSING PIN CHECK]', {
      component: canonicalComponent,
      occupiedCavities: sorted.map(x => String(x.num)),
      expectedCavities: Array.from({ length: max - min + 1 }, (_, i) => String(min + i)),
      missingCavities:  Array.from({ length: max - min + 1 }, (_, i) => min + i)
        .filter(n => !present.has(n)).map(String),
    });

    console.log('[T23.6.3.5 OCCUPANCY]', {
      component: canonicalComponent,
      occupiedPins: knownCavities,
    });

    for (let pin = min; pin <= max; pin++) {
      if (!present.has(pin)) {
        candidates.push({
          component: displayComponent,
          canonicalComponent,
          missingCavity: String(pin),
          knownCavities,
          confidence: gapCount <= 2 ? 'HIGH' : 'MEDIUM',
          reason: `Connector ${displayComponent} has wires on pins ${knownCavities.join(', ')} but pin ${pin} is not connected`,
        });
      }
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Primary export: analyzeHarnessTopology
// ---------------------------------------------------------------------------

/**
 * Build a topology graph from effective connectivity and run deterministic detections.
 *
 * Never throws. Pure function. Does not mutate inputs.
 */
export function analyzeHarnessTopology(args: {
  connectivity: HarnessConnectivityResult;
}): HarnessTopologyResult {
  const { wires } = args.connectivity;

  // ── Build node map ─────────────────────────────────────────────────────
  const nodeMap = new Map<string, TopologyNode>();
  const connectivityUF = new UnionFind();

  function getOrCreateNode(endpoint: WireEndpoint, wireId: string): string | null {
    const identity = resolveNodeIdentity(endpoint);
    const id = identity.nodeKey;
    if (!id || !identity.canonicalComponent) return null;
    const canonicalId = identity.canonicalComponent;
    const rawComponent = endpoint.component?.trim() ?? canonicalId;
    const displayName = componentDisplayName(rawComponent, canonicalId);

    const ferruleNodeId = resolveFerruleNodeId(endpoint, canonicalId);
    if (ferruleNodeId) {
      // T23.6.4: FERRULE endpoint with component+cavity → create explicit shared-ferrule node.
      // Ensure the mounting cavity node exists for pin-sequence occupancy tracking.
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          component:          rawComponent,
          displayName,
          canonicalComponent: canonicalId,
          canonicalId,
          cavity:             endpoint.cavity?.trim() ?? null,
          terminationType:    'CONNECTOR_PIN',
          wireIds:            [],
        });
      }
      if (!nodeMap.has(ferruleNodeId)) {
        nodeMap.set(ferruleNodeId, {
          id:                 ferruleNodeId,
          component:          rawComponent,
          displayName,
          canonicalComponent: canonicalId,
          canonicalId,
          cavity:             endpoint.cavity?.trim() ?? null,
          terminationType:    'FERRULE',
          wireIds:            [],
          isSharedFerrule:    true,
          ferrulePartNumber:  endpoint.partNumber?.trim() ?? null,
          mountedAtNodeId:    id,
        });
      }
      const ferruleNode = nodeMap.get(ferruleNodeId)!;
      if (!ferruleNode.wireIds.includes(wireId)) ferruleNode.wireIds.push(wireId);
      connectivityUF.union(ferruleNodeId, id);
      return ferruleNodeId;
    }

    if (!nodeMap.has(id)) {
      nodeMap.set(id, {
        id,
        component:          rawComponent,
        displayName,
        canonicalComponent: canonicalId,
        canonicalId,
        cavity:             endpoint.cavity?.trim() ?? null,
        terminationType:    resolveTerminationType(endpoint),
        wireIds:            [],
      });
    }
    const node = nodeMap.get(id)!;
    if (!node.wireIds.includes(wireId)) node.wireIds.push(wireId);
    return id;
  }

  // ── Build edge list ─────────────────────────────────────────────────────
  const edges: TopologyEdge[] = wires.map(wire => {
    const fromNodeId  = getOrCreateNode(wire.from, wire.wireId);
    const toNodeId    = getOrCreateNode(wire.to,   wire.wireId);
    const decBranch   = isDeclaredBranch(wire);

    if (fromNodeId && toNodeId) {
      connectivityUF.union(fromNodeId, toNodeId);
    }

    // T23.6.1: Resolve and log the shared-node anchor for this branch wire.
    // Normalization from FERRULE/TERMINAL → CONNECTOR_PIN happens in the
    // post-processing step below, after all edges are built.
    if (decBranch) {
      const anchor = resolveSharedAnchor(wire);
      console.log('[T23.6.1 ANCHOR RESOLVE]', {
        wireId:       wire.wireId,
        anchorNodeKey: anchor.anchorNodeKey ?? 'unknown',
        remoteNodeKey: anchor.remoteNodeKey ?? 'unknown',
        reason:       anchor.reason ?? 'declared branch',
      });
    }

    // T23.6.4: Log wire attachment to explicit shared-ferrule node.
    const fromNode = fromNodeId ? nodeMap.get(fromNodeId) : null;
    if (fromNode?.isSharedFerrule) {
      console.log('[T23.6.4 SHARED STRUCTURE]', {
        wireId:            wire.wireId,
        remoteEndpoint:    toNodeId ?? 'null',
        sharedFerruleNode: fromNodeId,
      });
    }

    return {
      wireId:          wire.wireId,
      fromNodeId,
      toNodeId,
      isDeclaredBranch: decBranch,
    };
  });

  // T23.6.1: Normalize declared branch anchor nodes.
  // When a wire's FROM endpoint is FERRULE or TERMINAL and the wire carries declared
  // branch topology, that endpoint IS a physical connector-pin occupancy point —
  // the FERRULE/TERMINAL is the connection method, not a separate node family.
  // Promoting terminationType to CONNECTOR_PIN makes missing-pin detection derive
  // correctness from the merged graph rather than from a termination-type exception.
  for (const edge of edges) {
    if (!edge.isDeclaredBranch || !edge.fromNodeId) continue;
    const branchWire = wires.find(w => w.wireId === edge.wireId);
    if (!branchWire) continue;
    const ft = branchWire.from.terminationType;
    if (ft !== 'FERRULE' && ft !== 'TERMINAL') continue;
    const anchorNode = nodeMap.get(edge.fromNodeId);
    // T23.6.4: skip explicit shared-ferrule nodes — their mounted cavity node
    // already carries CONNECTOR_PIN type and handles pin-sequence occupancy.
    if (!anchorNode || anchorNode.isSharedFerrule) continue;
    if (anchorNode.terminationType !== 'FERRULE' && anchorNode.terminationType !== 'TERMINAL') continue;
    anchorNode.terminationType = 'CONNECTOR_PIN';
    console.log('[T23.6.1 NODE MERGE]', {
      anchorNodeKey:     anchorNode.id,
      attachedWires:     anchorNode.wireIds,
      connectionMethods: [ft],
    });
  }

  // T23.6.4: Log all explicit shared-ferrule nodes for validation.
  for (const [, node] of nodeMap) {
    if (!node.isSharedFerrule) continue;
    console.log('[T23.6.4 FERRULE NODE]', {
      ferruleNodeKey:    node.id,
      ferrulePartNumber: node.ferrulePartNumber,
      mountedAt:         node.mountedAtNodeId,
      attachedWires:     node.wireIds,
    });
    console.log('[T23.6.4 PIN OCCUPANCY]', {
      component:  node.canonicalComponent,
      cavity:     node.cavity,
      occupiedBy: node.id,
    });
  }

  const nodes = [...nodeMap.values()];

  console.log('[T23.5 NODE BUILD]', {
    totalNodes:      nodes.length,
    nodeKeys:        nodes.slice(0, 20).map(n => n.id),
    multiWireNodes:  nodes
      .filter(n => n.wireIds.length > 1)
      .map(n => `${n.id}(${n.wireIds.length}w,${n.terminationType ?? 'null'})`),
  });

  // ── Group nodes by component ───────────────────────────────────────────
  const nodesByComponent = new Map<string, TopologyNode[]>();
  const componentGroups = new Map<string, Map<string, TopologyNode[]>>();
  for (const node of nodes) {
    const key = node.canonicalComponent;
    if (!nodesByComponent.has(key)) nodesByComponent.set(key, []);
    nodesByComponent.get(key)!.push(node);

    const root = connectivityUF.find(node.id);
    if (!componentGroups.has(key)) {
      componentGroups.set(key, new Map());
    }
    const groupMap = componentGroups.get(key)!;
    if (!groupMap.has(root)) {
      groupMap.set(root, []);
    }
    groupMap.get(root)!.push(node);
  }

  for (const [component, groupMap] of componentGroups) {
    for (const [root, groupNodes] of groupMap) {
      console.log('[T23.6.3.5 GROUP]', {
        component,
        root,
        nodes: groupNodes.map(n => n.id),
      });
    }
  }

  // ── A. Missing wire detection ──────────────────────────────────────────
  const missingWireCandidates = detectMissingWires(componentGroups);

  // T23.6: Log pin occupancy for connectors that have FERRULE/TERMINAL shared-node anchors.
  // These cavities now count as occupied (fix) and suppress otherwise-false MISSING_WIRE gaps.
  for (const [comp, compNodes] of nodesByComponent) {
    const anchors = compNodes.filter(
      n => (n.terminationType === 'FERRULE' || n.terminationType === 'TERMINAL') && n.cavity !== null,
    );
    if (anchors.length > 0) {
      console.log('[T23.6 NODE OCCUPANCY]', {
        component:            comp,
        cavity:               anchors.map(n => n.cavity),
        attachedWires:        anchors.flatMap(n => n.wireIds),
        satisfiedBySharedNode: true,
      });
    }
  }

  // ── B. Multi-wire / undeclared branch endpoints ───────────────────────
  // Only meaningful for CONNECTOR_PIN type: same connector pin on >1 wire.
  // T23.5: Nodes with FERRULE/TERMINAL terminationType represent valid physical
  // branch points and are excluded here — their wires need no explicit declaration.
  const multiWireEndpoints = nodes.filter(
    n => n.wireIds.length > 1 && n.terminationType === 'CONNECTOR_PIN',
  );

  console.log('[T23.5 VALIDATION]', {
    multiWireEndpointCount: multiWireEndpoints.length,
    multiWireEndpoints:     multiWireEndpoints.map(n => `${n.id}(${n.wireIds.length}w)`),
    declaredBranchEdges:    edges.filter(e => e.isDeclaredBranch).length,
    unlabeledWireCount:     wires.filter(w => !w.wireId || w.wireId.startsWith('op-')).length,
  });

  // ── C. Isolated subgraph detection (union-find) ────────────────────────
  // T23.6.4: reuse connectivityUF (built during node/edge construction) so that
  // ferrule-cavity mounted-at unions are included. A separate pass would miss
  // those unions and falsely report ferrule-sharing structures as isolated.

  const sgMap = new Map<string, { nodeIds: Set<string>; wireIds: Set<string> }>();
  for (const edge of edges) {
    const rep =
      edge.fromNodeId ? connectivityUF.find(edge.fromNodeId) :
      edge.toNodeId   ? connectivityUF.find(edge.toNodeId)   : null;
    if (!rep) continue;
    if (!sgMap.has(rep)) sgMap.set(rep, { nodeIds: new Set(), wireIds: new Set() });
    const sg = sgMap.get(rep)!;
    sg.wireIds.add(edge.wireId);
    if (edge.fromNodeId) sg.nodeIds.add(edge.fromNodeId);
    if (edge.toNodeId)   sg.nodeIds.add(edge.toNodeId);
  }

  const sgEntries           = [...sgMap.values()];
  const hasMultipleSubgraphs = sgEntries.length > 1;

  const isolatedSubgraphs: TopologySubgraph[] = sgEntries.map((sg, idx) => ({
    id:         idx,
    nodeIds:    [...sg.nodeIds],
    wireIds:    [...sg.wireIds],
    isIsolated: hasMultipleSubgraphs,
  }));

  // ── D. Dangling endpoint detection ────────────────────────────────────
  // A wire is dangling when one endpoint resolves to a graph node (known component)
  // but the other endpoint has null nodeId AND is not a valid open termination.
  // Excludes: unresolved wires (flagged by T2), declared FLOATING wires.
  const danglingSet = new Map<string, TopologyNode>();

  for (const edge of edges) {
    const wire = wires.find(w => w.wireId === edge.wireId);
    if (!wire || wire.unresolved || isDeclaredFloating(wire)) continue;

    if (edge.fromNodeId !== null && edge.toNodeId === null && !isValidOpenEnd(wire.to)) {
      const node = nodeMap.get(edge.fromNodeId);
      if (node) danglingSet.set(node.id, node);
    }
    if (edge.toNodeId !== null && edge.fromNodeId === null && !isValidOpenEnd(wire.from)) {
      const node = nodeMap.get(edge.toNodeId);
      if (node) danglingSet.set(node.id, node);
    }
  }

  const danglingEndpoints = [...danglingSet.values()];

  // ── E. Assemble warnings ───────────────────────────────────────────────
  const warnings: TopologyWarning[] = [];

  for (const c of missingWireCandidates) {
    warnings.push({
      code:            'MISSING_WIRE',
      confidence:      c.confidence,
      blocksCommit:    c.confidence === 'HIGH',
      affectedNodeIds: [`${c.canonicalComponent}:${c.missingCavity.toLowerCase()}`],
      affectedWireIds: [],
      message:         `Missing wire: ${c.component} pin ${c.missingCavity}`,
      reason:          c.reason,
    });
  }

  for (const node of danglingEndpoints) {
    warnings.push({
      code:            'DANGLING_ENDPOINT',
      confidence:      'HIGH',
      blocksCommit:    true,
      affectedNodeIds: [node.id],
      affectedWireIds: node.wireIds,
      message:         `Dangling endpoint: ${node.component}${node.cavity ? `:${node.cavity}` : ''}`,
      reason:          `Wire connects to ${node.id} but the other end has no valid termination`,
    });
  }

  for (const node of multiWireEndpoints) {
    // T23.5: A node is a valid branch if ANY co-located wire declares branch
    // topology. Extracted wires at operator-declared branch nodes inherit the
    // declaration — requiring ALL wires to independently declare would produce
    // false positives when extracted and operator wires share the same pin.
    const anyDeclared = node.wireIds.some(wid => {
      const w = wires.find(ww => ww.wireId === wid);
      return w ? isDeclaredBranch(w) : false;
    });
    if (!anyDeclared) {
      warnings.push({
        code:            'UNDECLARED_BRANCH',
        confidence:      'HIGH',
        blocksCommit:    true,
        affectedNodeIds: [node.id],
        affectedWireIds: node.wireIds,
        message:         `Undeclared branch at ${node.id}`,
        reason:          `${node.wireIds.length} wires share endpoint ${node.id} without a declared BRANCH or SPLICE topology`,
      });
    }
  }

  if (hasMultipleSubgraphs) {
    for (const sg of isolatedSubgraphs) {
      // T23.5: Use physical node IDs (component:cavity) instead of wire labels
      // so the message describes topology, not customer wire naming.
      const nodeLabel = sg.nodeIds.slice(0, 3).join(', ') + (sg.nodeIds.length > 3 ? '…' : '');
      warnings.push({
        code:            'ISOLATED_SUBGRAPH',
        confidence:      'MEDIUM',
        blocksCommit:    false,
        affectedNodeIds: sg.nodeIds,
        affectedWireIds: sg.wireIds,
        message:         `Isolated subgraph: ${nodeLabel}`,
        reason:          `${sg.nodeIds.length} node(s) in ${sg.wireIds.length} wire(s) form a subgraph disconnected from the rest of the harness`,
      });
    }
  }

  console.log('[T13 TOPOLOGY]', {
    nodeCount:        nodes.length,
    edgeCount:        edges.length,
    missingWireCount: missingWireCandidates.length,
    danglingCount:    danglingEndpoints.length,
    multiWireCount:   multiWireEndpoints.length,
    subgraphCount:    isolatedSubgraphs.length,
    warningCount:     warnings.length,
    blockingCount:    warnings.filter(w => w.blocksCommit).length,
  });

  return {
    nodes,
    edges,
    danglingEndpoints,
    multiWireEndpoints,
    isolatedSubgraphs,
    missingWireCandidates,
    warnings,
  };
}
