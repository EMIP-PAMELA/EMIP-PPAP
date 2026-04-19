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
import type { NormalizedComponent, NormalizedConnector } from '@/src/features/documentEngine/types/bomTypes';

// ============================================================
// TYPES
// ============================================================

export interface WireProjection {
  partNumber: string;
  gauge: string | null;
  color: string | null;
  length: number;
  lengthUnit: string;
  quantity: number;
  description: string | null;
  connectorPartNumber: string | null;
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
  const wires = extractWires(components, normalizedBOM.primaryConnector ?? null);
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

    return {
      partNumber: component.partId,
      gauge,
      color: component.color ?? null,
      length: lengthFeet,
      lengthUnit: 'ft',
      quantity: component.quantity,
      description: component.description,
      connectorPartNumber: primaryConnector?.partNumber ?? null,
    };
  });

  if (projections.length === 0) {
    console.warn('[T23.6.55 NORMALIZED INPUT] No wires found AFTER normalization');
  }

  return projections;
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
