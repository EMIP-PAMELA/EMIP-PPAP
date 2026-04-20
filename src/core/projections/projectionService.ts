/**
 * V5.3 EMIP Core - Projection Service
 * 
 * FOUNDATION LAYER - Simplified BOM Projections
 * 
 * Responsibilities:
 * - Generate simplified, human-readable BOM views
 * - Extract structured wire and connector data
 * - Provide analytics-ready representations
 * - Support dual-view system (raw vs simplified)
 * 
 * CRITICAL: Projections are DERIVED from canonical BOM data
 * - NOT stored as source of truth
 * - Generated on-demand from bom_records
 * - Always current with active BOM version
 * 
 * Architecture:
 * - Uses bomService for canonical data access
 * - Uses normalizers for data transformation
 * - Pure computation layer (no storage)
 */

import { getNormalizedBOMForPart } from '../services/bomService';
import { getArtifactForPart } from '../services/artifactService';
import { getExecutionMode } from '../context/executionContext';
import type { ConnectorAuthority, NormalizedComponent, NormalizedConnector } from '@/src/features/documentEngine/types/bomTypes';

// ============================================================
// TYPES
// ============================================================

const CONNECTOR_AUTHORITY_PRIORITY: Record<ConnectorAuthority, number> = {
  BOM: 100,
  DRAWING_PRIMARY: 90,
  DRAWING_EQUIVALENT: 80,
  TABLE_HEADER: 70,
  TABLE: 60,
  DIAGRAM_CALLOUT: 50,
  ROW: 40,
  NOTES: 10,
  UNKNOWN: 0,
};

type ComponentOptionKind = 'CONNECTOR' | 'TERMINAL';

interface ComponentOption {
  canonicalId: string;
  displayName: string;
  kind: ComponentOptionKind;
  authority?: ConnectorAuthority;
  confidence?: number;
  cavities: string[];
}

export interface WireProjection {
  partNumber: string;
  gauge: string | null;
  color: string | null;
  length: number;
  lengthUnit: string;
  quantity: number;
  description: string | null;
  connectorPartNumber?: string | null;
  connectorCandidates?: string[];
}

export interface ConnectorProjection {
  partNumber: string;
  description: string | null;
  quantity: number;
  type: string | null;
}

export interface SimplifiedBOM {
  partNumber: string;
  revision: string;
  revisionOrder: number;
  ingestionBatchId: string;
  
  connectors: ConnectorProjection[];
  wires: WireProjection[];
  componentOptions: ComponentOption[];
  
  summary: {
    totalWireLength: number;
    wireTypes: number;
    connectorCount: number;
    totalComponents: number;
  };
  
  artifact: {
    url: string | null;
    path: string | null;
  };
}

// ============================================================
// MAIN PROJECTION METHOD
// ============================================================

/**
 * Get simplified BOM projection for a part number
 * 
 * Returns structured, human-readable view of active BOM.
 * 
 * @param partNumber Part number
 * @returns Simplified BOM projection
 */
export async function getSimplifiedBOM(partNumber: string): Promise<SimplifiedBOM | null> {
  const mode = getExecutionMode();
  if (mode === 'sku_view') {
    console.log('[T23.6.59 PROJECTION BLOCKED — SKU VIEW]', { partNumber });
    return null;
  }
  console.log('🧠 V5.3 [Projection Service] Generating simplified BOM', {
    partNumber,
    timestamp: new Date().toISOString()
  });

  const canonical = await getNormalizedBOMForPart(partNumber);
  if (!canonical) {
    console.warn('[T23.6.55 CANONICAL INPUT]', {
      partNumber,
      reason: 'NORMALIZED_BOM_NOT_AVAILABLE'
    });
    return null;
  }

  const normalizedBOM = canonical.bom;
  const components = normalizedBOM.operations.flatMap(operation => operation.components);

  if (!components || components.length === 0) {
    throw new Error('[T23.6.55] Projection received invalid normalized components');
  }

  const hasInvalidCategory = components.some(component => component.componentType === undefined || component.componentType === null);
  if (hasInvalidCategory) {
    throw new Error('[T23.6.55] Non-normalized component detected in pipeline');
  }

  const wireCount = components.filter(component => component.componentType === 'wire').length;
  const categories = Array.from(new Set(components.map(component => component.componentType)));

  console.log('[T23.6.55 CANONICAL INPUT]', {
    partNumber,
    totalComponents: components.length,
    wireCount,
    categories,
  });

  const artifact = await getArtifactForPart(partNumber);
  const authorityConnectors = normalizedBOM.connectors ?? [];
  const terminalOptions = buildTerminalOptions(components);
  const connectorOptions = buildConnectorOptions(authorityConnectors);
  const componentOptions = mergeComponentOptions(terminalOptions, connectorOptions);
  console.log('[T23.6.64 CONNECTOR OPTIONS]', {
    count: connectorOptions.length,
    connectors: connectorOptions.map(option => option.canonicalId),
  });
  console.log('[T23.6.69 COMPONENT OPTION BUILD]', {
    connectorCount: authorityConnectors.length,
    terminalCount: terminalOptions.length,
    finalCount: componentOptions.length,
  });
  console.log('[T23.6.69 CONNECTOR OPTIONS PROPAGATED]', componentOptions.filter(option => option.kind === 'CONNECTOR'));
  const primaryConnector = normalizedBOM.primaryConnector ?? null;
  const wires = extractWires(components, authorityConnectors, primaryConnector);
  const connectors = extractConnectors(components);

  const totalWireLength = wires.reduce((sum, wire) => sum + wire.length, 0);
  const wireTypes = new Set(wires.map(wire => `${wire.partNumber}-${wire.gauge}-${wire.color}`)).size;
  const connectorCount = connectors.reduce((sum, connector) => sum + connector.quantity, 0);

  const projection: SimplifiedBOM = {
    partNumber,
    revision: canonical.revision,
    revisionOrder: canonical.revisionOrder,
    ingestionBatchId: canonical.ingestionBatchId,
    connectors,
    wires,
    componentOptions,
    summary: {
      totalWireLength,
      wireTypes,
      connectorCount,
      totalComponents: normalizedBOM.summary?.totalComponents ?? components.length,
    },
    artifact: {
      url: artifact?.url || null,
      path: artifact?.path || null
    }
  };

  return projection;
}

// ============================================================
// WIRE EXTRACTION
// ============================================================

/**
 * Extract and normalize wire data from BOM records
 * 
 * Phase 3H.18: Now uses canonical category === 'WIRE' for wire detection
 * This ensures projection respects the classification system from normalizers.ts
 * 
 * @param records BOM records
 * @returns Wire projections
 */
function extractWires(
  components: NormalizedComponent[],
  authorityConnectors: NormalizedConnector[],
  primaryConnector: NormalizedConnector | null,
): WireProjection[] {
  if (!components || components.length === 0) {
    throw new Error('[T23.6.55] Projection received invalid normalized components');
  }

  const wires = components.filter(component => component.componentType === 'wire');
  const projections: WireProjection[] = wires.map(component => {
    const normalizedInches = typeof component.normalizedLengthInches === 'number'
      ? component.normalizedLengthInches
      : null;
    const lengthFeet = normalizedInches !== null ? normalizedInches / 12 : 0;
    const gauge = component.gauge !== undefined && component.gauge !== null
      ? String(component.gauge)
      : null;

    const { assignedConnector, candidatePartNumbers } = matchWireConnector(
      component,
      authorityConnectors,
    );
    const resolvedConnector = assignedConnector ?? primaryConnector;
    const wireProjection: WireProjection = {
      partNumber: component.partId,
      gauge,
      color: component.color ?? null,
      length: lengthFeet,
      lengthUnit: 'ft',
      quantity: component.quantity,
      description: component.description,
      connectorPartNumber: resolvedConnector?.partNumber ?? null,
    };

    if (candidatePartNumbers.length > 0) {
      wireProjection.connectorCandidates = candidatePartNumbers;
    }

    console.log('[T23.6.61 WIRE CONNECTOR MAP]', {
      wireId: component.partId,
      assigned: wireProjection.connectorPartNumber ?? null,
      candidates: wireProjection.connectorCandidates ?? [],
    });

    console.log('[T23.6.64 WIRE CONNECTOR RESOLUTION]', {
      wireId: component.partId,
      selectedFrom: wireProjection.connectorPartNumber ?? null,
      type: assignedConnector
        ? 'AUTHORITY'
        : primaryConnector && resolvedConnector === primaryConnector
          ? 'PRIMARY'
          : 'UNRESOLVED',
    });

    return wireProjection;
  });

  if (projections.length === 0) {
    console.warn('[T23.6.55 NORMALIZED INPUT] No wires found AFTER normalization');
  }

  return projections;
}

function buildWireSearchSpace(component: NormalizedComponent): string {
  const segments = [
    component.description,
    component.normalizedDescription,
    component.source?.rawLine,
    ...(component.source?.trailingLines ?? []),
  ];

  return segments
    .filter(Boolean)
    .map(segment => segment?.toString().toUpperCase())
    .join(' ');
}

function matchWireConnector(
  component: NormalizedComponent,
  authorityConnectors: NormalizedConnector[],
): {
  assignedConnector: NormalizedConnector | null;
  candidatePartNumbers: string[];
} {
  if (!authorityConnectors || authorityConnectors.length === 0) {
    return { assignedConnector: null, candidatePartNumbers: [] };
  }

  const searchSpace = buildWireSearchSpace(component);
  if (!searchSpace) {
    return { assignedConnector: null, candidatePartNumbers: [] };
  }

  const scored = authorityConnectors
    .map(connector => ({
      connector,
      score: scoreConnectorMatch(searchSpace, connector),
    }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const authorityDiff = (CONNECTOR_AUTHORITY_PRIORITY[b.connector.authority] ?? 0) - (CONNECTOR_AUTHORITY_PRIORITY[a.connector.authority] ?? 0);
      if (authorityDiff !== 0) return authorityDiff;
      return (b.connector.confidence ?? 0) - (a.connector.confidence ?? 0);
    });

  return {
    assignedConnector: scored[0]?.connector ?? null,
    candidatePartNumbers: scored.map(entry => entry.connector.partNumber),
  };
}

function scoreConnectorMatch(searchSpace: string, connector: NormalizedConnector): number {
  if (!connector.partNumber || connector.partNumber === 'UNKNOWN') return 0;
  const partNumber = connector.partNumber.toUpperCase();
  if (!partNumber) return 0;

  let score = 0;
  const escapedPartNumber = escapeRegex(partNumber);
  const fromRegex = new RegExp(`FROM\\s+${escapedPartNumber}`);
  const toRegex = new RegExp(`TO\\s+${escapedPartNumber}`);
  const tokenRegex = new RegExp(`\\b${escapedPartNumber}\\b`);

  if (fromRegex.test(searchSpace)) score += 6;
  if (toRegex.test(searchSpace)) score += 6;
  if (tokenRegex.test(searchSpace)) score += 3;

  return score;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTerminalOptions(components: NormalizedComponent[]): ComponentOption[] {
  const seen = new Set<string>();
  const terminals = components.filter(component => component.componentType === 'terminal');
  const options: ComponentOption[] = [];

  for (const terminal of terminals) {
    const canonicalId = (terminal.normalizedPartNumber ?? terminal.partId ?? '').trim().toUpperCase();
    if (!canonicalId || seen.has(canonicalId)) continue;
    seen.add(canonicalId);
    options.push({
      canonicalId,
      displayName: terminal.partId?.trim() || terminal.normalizedPartNumber || canonicalId,
      kind: 'TERMINAL',
      cavities: [],
    });
  }

  return options;
}

function buildConnectorOptions(connectors: NormalizedConnector[]): ComponentOption[] {
  return connectors.map(connector => {
    const partNumber = (connector.partNumber || 'UNKNOWN').trim().toUpperCase();
    return {
      canonicalId: partNumber,
      displayName: connector.partNumber || partNumber,
      kind: 'CONNECTOR',
      authority: connector.authority,
      confidence: connector.confidence ?? 0,
      cavities: [],
    } satisfies ComponentOption;
  });
}

function mergeComponentOptions(
  terminals: ComponentOption[],
  connectors: ComponentOption[],
): ComponentOption[] {
  const merged: ComponentOption[] = [];
  const seen = new Map<string, ComponentOption>();

  const append = (option: ComponentOption) => {
    merged.push(option);
    seen.set(option.canonicalId, option);
  };

  terminals.forEach(option => {
    if (seen.has(option.canonicalId)) return;
    append(option);
  });

  connectors.forEach(option => {
    const existing = seen.get(option.canonicalId);
    if (existing) {
      if (existing.kind !== option.kind) {
        console.warn('[T23.6.69 COMPONENT OPTION COLLISION]', {
          canonicalId: option.canonicalId,
          existingKind: existing.kind,
          incomingKind: option.kind,
        });
      }
      return;
    }
    append(option);
  });

  return merged;
}

// ============================================================
// CONNECTOR EXTRACTION
// ============================================================

/**
 * Extract and group connector data from BOM records
 * 
 * @param records BOM records
 * @returns Connector projections
 */
function extractConnectors(components: NormalizedComponent[]): ConnectorProjection[] {
  const connectorMap = new Map<string, ConnectorProjection>();

  components
    .filter(component => component.componentType === 'connector')
    .forEach(component => {
      const partNumber = component.partId;
      const existing = connectorMap.get(partNumber);
      const typeSignal = component.classificationSignals?.find(signal => signal.startsWith('TYPE_'));
      const type = typeSignal ? typeSignal.replace('TYPE_', '').toLowerCase() : null;

      if (existing) {
        existing.quantity += component.quantity;
        return;
      }

      connectorMap.set(partNumber, {
        partNumber,
        description: component.description,
        quantity: component.quantity,
        type,
      });
    });

  return Array.from(connectorMap.values());
}

// ============================================================
// DUAL VIEW HELPER
// ============================================================

export type EngineeringMasterViewType = 'raw' | 'simplified';

export interface EngineeringMasterView {
  viewType: EngineeringMasterViewType;
  partNumber: string;
  
  // For 'raw' view
  artifactUrl?: string | null;
  
  // For 'simplified' view
  projection?: SimplifiedBOM | null;
}

/**
 * Get engineering master view (dual-representation system)
 * 
 * Supports:
 * - "raw": Return artifact URL for PDF viewing
 * - "simplified": Return structured projection
 * 
 * @param partNumber Part number
 * @param viewType View type
 * @returns Engineering master view
 */
export async function getEngineeringMasterView(
  partNumber: string,
  viewType: EngineeringMasterViewType
): Promise<EngineeringMasterView> {
  console.log('🧠 V5.3 [Projection Service] Fetching engineering master view', {
    partNumber,
    viewType,
    timestamp: new Date().toISOString()
  });

  if (viewType === 'raw') {
    // Return artifact URL for PDF viewing
    const artifact = await getArtifactForPart(partNumber);
    
    return {
      viewType: 'raw',
      partNumber,
      artifactUrl: artifact?.url || null
    };
  }

  // Return simplified projection
  const projection = await getSimplifiedBOM(partNumber);
  
  return {
    viewType: 'simplified',
    partNumber,
    projection
  };
}
