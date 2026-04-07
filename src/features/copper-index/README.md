# Copper Index Module

**Status:** Scaffolded (V5.0) - Not Yet Implemented

**Purpose:** Calculate copper index and material costs for wire harness assemblies.

## Architecture

This is a **Domain Engine** in the V5.0 3-layer architecture:

```
Layer 1: FOUNDATION (EMIP Core)
  └─ BOM Repository, Parser, Services

Layer 2: DOMAIN ENGINES
  ├─ PPAP (process/state engine)
  └─ Copper Index (calculation/analytics engine) ← YOU ARE HERE

Layer 3: APPLICATION/UI
  └─ Workflow screens, Dashboards
```

## Module Boundaries

### ✅ ALLOWED
- Import BOM data via `@/src/core/services/bomService`
- Implement copper price calculations
- Generate cost analytics
- Provide cost data to UI layer

### ❌ FORBIDDEN
- Parse BOM independently (use core/parser)
- Own BOM data (use core/services)
- Import from `features/ppap` or other domain engines
- Cross-feature coupling

## Planned Capabilities (Not Yet Implemented)

1. **Copper Price Integration**
   - Fetch current copper prices
   - Historical price tracking
   - Price volatility analysis

2. **Wire Cost Calculation**
   - Calculate material cost per assembly
   - Factor in gauge, length, quantity
   - Account for copper market prices

3. **Cost Analytics**
   - Cost breakdown by operation
   - Material vs labor cost ratios
   - Cost trend analysis

4. **Reporting**
   - Cost reports per part number
   - Historical cost comparison
   - Predictive cost modeling

## Future Structure

```
src/features/copper-index/
├── services/
│   ├── copperPriceService.ts    (fetch market data)
│   ├── costCalculationService.ts (compute costs)
│   └── analyticsService.ts       (trend analysis)
├── calculations/
│   ├── wireCost.ts               (wire-specific calc)
│   ├── totalCost.ts              (assembly total)
│   └── costBreakdown.ts          (detailed breakdown)
├── types/
│   └── copperIndex.ts            (type definitions)
└── README.md                      (this file)
```

## Integration Points

### Input (from EMIP Core)
```typescript
import { getBOM, getWireLines } from '@/src/core/services/bomService';

const wires = await getWireLines(partNumber);
const copperCost = calculateWireCost(wires, currentCopperPrice);
```

### Output (to UI/PPAP)
```typescript
interface CopperIndexReport {
  partNumber: string;
  totalWireLength: number;
  estimatedCopperCost: number;
  priceDate: string;
  breakdown: CostBreakdown[];
}
```

## V5.0 Notes

This module is **scaffolded only** in V5.0. It demonstrates the architectural separation:
- Copper Index is a separate domain engine
- It does NOT parse BOM (uses core/parser)
- It does NOT own BOM data (uses core/services)
- It focuses on its domain: cost calculation

Full implementation will come in a future phase.
