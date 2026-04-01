/**
 * EMIP Context Stub
 * V3.2F-2 Batch 1
 * 
 * STUB IMPLEMENTATION - Returns mock EmipContext data
 * 
 * Current Behavior: Returns placeholder component/BOM data for development
 * Future Behavior: Queries EMIP domain for real component/BOM data
 * 
 * IMPORTANT: The interface is FIXED and will NOT change when EMIP storage is built.
 * Only this file's implementation will be replaced with real EMIP queries.
 * 
 * As defined in V3.2F-1 Section 5.
 */

import { EmipContext, Component, Operation, BOMNode } from '../types/copilotTypes';

/**
 * Get EMIP context for a PPAP
 * 
 * STUB: Returns mock data with placeholder components and operations
 * FUTURE: Will query EMIP domain for real component/BOM data
 * 
 * @param ppapId - PPAP ID to get context for
 * @returns EmipContext with mock data (metadata.source = 'stub')
 */
export async function getEmipContext(ppapId: string): Promise<EmipContext> {
  console.log('[STUB] getEmipContext called for PPAP:', ppapId);
  console.log('[STUB] Returning mock EMIP data - EMIP storage not yet built');
  console.log('[STUB] Interface is fixed - only implementation changes when EMIP is real');
  
  // Mock components - realistic wire harness assembly data
  const mockComponents: Component[] = [
    {
      id: 'comp-wire-001',
      partNumber: 'WIRE-18AWG-RED-100',
      description: '18 AWG Red Wire, 100ft Spool',
      quantity: 10,
      uom: 'FT',
      category: 'wire',
      supplier: 'Wire Supplier Inc.'
    },
    {
      id: 'comp-wire-002',
      partNumber: 'WIRE-18AWG-BLK-100',
      description: '18 AWG Black Wire, 100ft Spool',
      quantity: 8,
      uom: 'FT',
      category: 'wire',
      supplier: 'Wire Supplier Inc.'
    },
    {
      id: 'comp-term-001',
      partNumber: 'TERM-RING-18-22',
      description: 'Ring Terminal 18-22 AWG, #10 Stud',
      quantity: 20,
      uom: 'EA',
      category: 'terminal',
      supplier: 'Terminal Corp'
    },
    {
      id: 'comp-term-002',
      partNumber: 'TERM-SPADE-18-22',
      description: 'Spade Terminal 18-22 AWG, #10 Stud',
      quantity: 20,
      uom: 'EA',
      category: 'terminal',
      supplier: 'Terminal Corp'
    },
    {
      id: 'comp-conn-001',
      partNumber: 'CONN-4PIN-FEMALE',
      description: '4-Pin Connector Female Housing',
      quantity: 2,
      uom: 'EA',
      category: 'connector',
      supplier: 'Connector Systems'
    },
    {
      id: 'comp-hw-001',
      partNumber: 'HEAT-SHRINK-3/8',
      description: 'Heat Shrink Tubing 3/8" Diameter',
      quantity: 12,
      uom: 'IN',
      category: 'hardware',
      supplier: 'Hardware Supply Co'
    },
    {
      id: 'comp-hw-002',
      partNumber: 'TAPE-ELECTRICAL-3M',
      description: 'Electrical Tape 3M Scotch 33+',
      quantity: 1,
      uom: 'EA',
      category: 'hardware',
      supplier: 'Hardware Supply Co'
    }
  ];
  
  // Mock operations - wire harness assembly process
  const mockOperations: Operation[] = [
    {
      id: 'op-cut-001',
      stepNumber: '--10',
      operationCode: 'CUT',
      description: 'Cut wire to length per drawing',
      workCenter: 'WC-KOMAX-01',
      setupTime: 15,
      cycleTime: 0.5
    },
    {
      id: 'op-strip-001',
      stepNumber: '--20',
      operationCode: 'STRIP',
      description: 'Strip wire ends 0.25" per spec',
      workCenter: 'WC-KOMAX-01',
      setupTime: 5,
      cycleTime: 0.3
    },
    {
      id: 'op-crimp-001',
      stepNumber: '--30',
      operationCode: 'CRIMP',
      description: 'Crimp terminals per crimp height spec',
      workCenter: 'WC-CRIMP-01',
      setupTime: 10,
      cycleTime: 0.8
    },
    {
      id: 'op-assy-001',
      stepNumber: '--40',
      operationCode: 'ASSY',
      description: 'Insert terminals into connector housing',
      workCenter: 'WC-ASSY-01',
      setupTime: 5,
      cycleTime: 1.2
    },
    {
      id: 'op-seal-001',
      stepNumber: '--50',
      operationCode: 'SEAL',
      description: 'Apply heat shrink and seal connections',
      workCenter: 'WC-ASSY-01',
      setupTime: 5,
      cycleTime: 0.6
    },
    {
      id: 'op-test-001',
      stepNumber: '--60',
      operationCode: 'TEST',
      description: 'Electrical continuity test per test plan',
      workCenter: 'WC-TEST-01',
      setupTime: 10,
      cycleTime: 1.0
    },
    {
      id: 'op-inspect-001',
      stepNumber: '--70',
      operationCode: 'INSPECT',
      description: 'Visual inspection per inspection checklist',
      workCenter: 'WC-QC-01',
      setupTime: 0,
      cycleTime: 0.5
    },
    {
      id: 'op-pack-001',
      stepNumber: '--80',
      operationCode: 'PACK',
      description: 'Label and package per packaging spec',
      workCenter: 'WC-SHIP-01',
      setupTime: 5,
      cycleTime: 0.4
    }
  ];
  
  // Mock BOM structure - hierarchical assembly
  const mockBOMStructure: BOMNode[] = [
    {
      id: 'node-root',
      component: {
        id: 'comp-assy-root',
        partNumber: 'MOCK-WH-ASSY-12345',
        description: 'Mock Wire Harness Assembly - Main',
        quantity: 1,
        uom: 'EA',
        category: 'other'
      },
      children: [
        {
          id: 'node-wire-red',
          parentId: 'node-root',
          component: mockComponents[0],
          children: [],
          level: 1
        },
        {
          id: 'node-wire-blk',
          parentId: 'node-root',
          component: mockComponents[1],
          children: [],
          level: 1
        },
        {
          id: 'node-term-ring',
          parentId: 'node-root',
          component: mockComponents[2],
          children: [],
          level: 1
        },
        {
          id: 'node-term-spade',
          parentId: 'node-root',
          component: mockComponents[3],
          children: [],
          level: 1
        },
        {
          id: 'node-conn',
          parentId: 'node-root',
          component: mockComponents[4],
          children: [],
          level: 1
        },
        {
          id: 'node-heat-shrink',
          parentId: 'node-root',
          component: mockComponents[5],
          children: [],
          level: 1
        },
        {
          id: 'node-tape',
          parentId: 'node-root',
          component: mockComponents[6],
          children: [],
          level: 1
        }
      ],
      level: 0
    }
  ];
  
  // Return mock EmipContext
  return {
    ppapId,
    partNumber: 'MOCK-WH-12345',
    partDescription: 'Mock Wire Harness Assembly for Customer XYZ',
    customerName: 'Mock Customer Inc.',
    supplierName: 'Mock Supplier LLC',
    
    components: mockComponents,
    operations: mockOperations,
    bomStructure: mockBOMStructure,
    
    metadata: {
      source: 'stub',
      lastUpdated: new Date().toISOString(),
      confidence: 'low'  // Low confidence because this is mock data
    }
  };
}

/**
 * Check if EMIP context is available (stub always returns true)
 * 
 * STUB: Always returns true (mock data always available)
 * FUTURE: Will check if EMIP domain has data for this PPAP
 * 
 * @param ppapId - PPAP ID to check
 * @returns true if context available
 */
export async function hasEmipContext(ppapId: string): Promise<boolean> {
  console.log('[STUB] hasEmipContext called for PPAP:', ppapId);
  console.log('[STUB] Returning true - mock data always available');
  return true;
}
