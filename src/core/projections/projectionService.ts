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

import { getBOM } from '../services/bomService';
import { getArtifactForPart } from '../services/artifactService';
import {
  normalizeWireGauge,
  normalizeWireColor,
  normalizeLengthToFeet,
  parseLengthFromDescription,
  isConnector,
  isWire
} from './normalizers';
import type { BOMRecord } from '../data/bom/types';

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
  console.log('🧠 V5.3 [Projection Service] Generating simplified BOM', {
    partNumber,
    timestamp: new Date().toISOString()
  });

  // STEP 1: Load active BOM from canonical source
  const bomRecords = await getBOM(partNumber);
  
  if (!bomRecords || bomRecords.length === 0) {
    console.log('🧠 [Projection Service] No active BOM found for', partNumber);
    return null;
  }

  // Extract metadata from first record
  const firstRecord = bomRecords[0];
  const revision = firstRecord.revision || 'UNKNOWN';
  const revisionOrder = firstRecord.revision_order || 0;
  const ingestionBatchId = firstRecord.ingestion_batch_id || '';

  // STEP 2: Get artifact info
  const artifact = await getArtifactForPart(partNumber);

  // STEP 3: Extract and normalize wires
  const wires = extractWires(bomRecords);

  // STEP 4: Extract and normalize connectors
  const connectors = extractConnectors(bomRecords);

  // STEP 5: Build summary
  const totalWireLength = wires.reduce((sum, wire) => sum + wire.length, 0);
  const wireTypes = new Set(wires.map(w => `${w.gauge}-${w.color}`)).size;
  const connectorCount = connectors.reduce((sum, conn) => sum + conn.quantity, 0);

  const projection: SimplifiedBOM = {
    partNumber,
    revision,
    revisionOrder,
    ingestionBatchId,
    connectors,
    wires,
    summary: {
      totalWireLength,
      wireTypes,
      connectorCount,
      totalComponents: bomRecords.length
    },
    artifact: {
      url: artifact?.url || null,
      path: artifact?.path || null
    }
  };

  console.log('🧠 V5.3 PROJECTION GENERATED', {
    partNumber,
    connectors: connectors.length,
    wires: wires.length,
    totalWireLength,
    timestamp: new Date().toISOString()
  });

  return projection;
}

// ============================================================
// WIRE EXTRACTION
// ============================================================

/**
 * Extract and normalize wire data from BOM records
 * 
 * @param records BOM records
 * @returns Wire projections
 */
function extractWires(records: BOMRecord[]): WireProjection[] {
  const wires: WireProjection[] = [];

  for (const record of records) {
    // Check if this is a wire component
    if (!isWire(record.child_part_number, record.description)) {
      // Also check metadata
      if (!record.metadata?.isWire) {
        continue;
      }
    }

    // Extract wire properties
    const gaugeInput = record.description || 
                       (record.metadata?.gauge as string | undefined) || 
                       record.child_part_number;
    const gauge = normalizeWireGauge(gaugeInput);

    const colorInput = record.description || record.child_part_number;
    const color = normalizeWireColor(colorInput);

    // Get length (prioritize metadata, fallback to description parsing)
    let length = 0;
    let lengthUnit = 'ft';

    if (record.length && record.metadata?.lengthUnit) {
      // Use stored length from V5.0 wire detection
      length = normalizeLengthToFeet(record.length, record.metadata.lengthUnit as string);
      lengthUnit = 'ft';
    } else if (record.description) {
      // Parse from description
      const parsed = parseLengthFromDescription(record.description);
      if (parsed) {
        length = normalizeLengthToFeet(parsed.value, parsed.unit);
        lengthUnit = 'ft';
      }
    }

    wires.push({
      partNumber: record.child_part_number,
      gauge,
      color,
      length,
      lengthUnit,
      quantity: record.quantity,
      description: record.description
    });
  }

  return wires;
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
function extractConnectors(records: BOMRecord[]): ConnectorProjection[] {
  const connectorMap = new Map<string, ConnectorProjection>();

  for (const record of records) {
    // Check if this is a connector component
    if (!isConnector(record.child_part_number, record.description)) {
      continue;
    }

    const partNumber = record.child_part_number;

    // Group by part number
    if (connectorMap.has(partNumber)) {
      const existing = connectorMap.get(partNumber)!;
      existing.quantity += record.quantity;
    } else {
      // Determine connector type from description
      const type = determineConnectorType(record.description);

      connectorMap.set(partNumber, {
        partNumber,
        description: record.description,
        quantity: record.quantity,
        type
      });
    }
  }

  return Array.from(connectorMap.values());
}

/**
 * Determine connector type from description
 * 
 * @param description Component description
 * @returns Connector type or null
 */
function determineConnectorType(description: string | null): string | null {
  if (!description) return null;

  const upper = description.toUpperCase();

  if (upper.includes('PLUG')) return 'plug';
  if (upper.includes('SOCKET') || upper.includes('RECEPTACLE')) return 'socket';
  if (upper.includes('TERMINAL')) return 'terminal';
  if (upper.includes('HOUSING')) return 'housing';
  if (upper.includes('PIN')) return 'pin';
  if (upper.includes('CONTACT')) return 'contact';

  return 'connector';
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
