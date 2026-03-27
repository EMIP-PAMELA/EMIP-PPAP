# Document Engine

Reusable document generation capability for EMIP-PPAP system.

## Architecture Overview

The document engine follows a **three-layer architecture**:

1. **Core Engine Layer** (this module)
2. **Standalone Surface** (`/tools/document-generator`)
3. **Embedded PPAP Surface** (integrated into PPAP workflow)

## Core Principles

### Build Once, Expose Twice
- ONE engine implementation
- TWO user-facing surfaces (standalone + embedded)
- NO duplicate template logic

### Context-Aware, Not PPAP-Dependent
- Engine accepts optional PPAP context
- Engine does NOT read `ppap.status` directly
- Engine is state-agnostic

### Pure Parser, Clean Separation
- Parser extracts raw data (NO side effects)
- Normalizer applies business logic
- Template mapper generates documents

## Module Structure

```
documentEngine/
  core/
    bomParser.ts       # PURE parser - extracts raw BOM data from text
    bomNormalizer.ts   # Business logic - classification, enrichment
  types/
    bomTypes.ts        # Core type definitions
  README.md            # This file
```

## Parser Responsibility vs Normalizer

### Parser (`bomParser.ts`)
**Responsibility:** Extract raw structured data from Visual Engineering Master text

**Input:** Raw text from PDF/file extraction

**Output:** `RawBOMData` with operations, components, metadata

**Rules:**
- PURE function (no side effects)
- NO database calls
- NO service imports
- NO PPAP coupling
- NO business logic

**What it does:**
- Parse operation headers (lines starting with `--`)
- Parse component lines (lines starting with `----`)
- Extract candidate IDs using regex patterns
- Detect ACI bridge numbers
- Log page accountability
- Preserve raw text for debugging

**What it does NOT do:**
- ❌ Classify components (Component/Consumable/Hardware)
- ❌ Determine if part is a terminal
- ❌ Interpret UOM semantics
- ❌ Calculate wire lengths
- ❌ Apply business rules

### Normalizer (`bomNormalizer.ts`)
**Responsibility:** Transform raw parsed data into normalized business entities

**Input:** `RawBOMData` from parser

**Output:** `NormalizedBOMData` with enriched components

**Rules:**
- Contains business logic
- Applies classification rules
- Enriches with domain knowledge
- Still NO database calls (pure transformation)

**What it does:**
- Classify components based on UOM and step
- Determine terminal vs non-terminal parts
- Calculate wire lengths for consumables
- Apply step labels (e.g., "10" → "Termination/Tooling Zone")
- Compute summary statistics

## Data Flow Pipeline

```
Raw Text (PDF/File)
    ↓
[bomParser.ts] → RawBOMData
    ↓
[bomNormalizer.ts] → NormalizedBOMData
    ↓
[Template Mapper] → Document Draft
    ↓
Generated Document
```

## Why This Separation?

### Parsing is Mechanical
- Extract what's literally on the page
- Pattern matching, regex, text processing
- No interpretation

### Normalization is Business Logic
- Apply domain knowledge
- Interpret semantics
- Classify and enrich

### Benefits
1. **Testability:** Parser can be tested with raw text samples
2. **Maintainability:** Business rules in one place
3. **Reusability:** Parser works for ANY manufacturer
4. **Extensibility:** Add new classifications without touching parser

## Usage Examples

### Parse BOM Text
```typescript
import { parseBOMText } from '@/features/documentEngine/core/bomParser';

const rawData = parseBOMText(pdfText);
console.log(`Found ${rawData.operations.length} operations`);
console.log(`Master Part: ${rawData.masterPartNumber}`);
```

### Parse BOM File
```typescript
import { parseBOMFile } from '@/features/documentEngine/core/bomParser';

const file = await fileInput.files[0];
const rawData = await parseBOMFile(file);
```

### Normalize Data (Future)
```typescript
import { normalizeBOMData } from '@/features/documentEngine/core/bomNormalizer';

const normalized = normalizeBOMData(rawData);
console.log(`Component breakdown: ${normalized.summary.componentCount} components`);
```

## Integration Points

### Standalone Surface (Future)
Path: `/tools/document-generator`

Independent document generator:
- Upload BOM file
- Select template
- Generate document
- Download result

**NO PPAP coupling**

### PPAP Embedded Surface (Future)
Integrated into existing PPAP workflow:
- "Create" buttons on document cards
- Pre-filled with PPAP context
- Respects workflow gates
- Honors pre-ack/post-ack boundary

**PPAP-aware but engine remains agnostic**

## Current Status

**Phase 3P Extension - Parser Integration ONLY**

✅ Parser integrated (`bomParser.ts`)  
✅ Types defined (`bomTypes.ts`)  
✅ Normalizer placeholder created (`bomNormalizer.ts`)  
⏳ Template system (future)  
⏳ Standalone UI (future)  
⏳ PPAP integration (future)

## Next Steps

1. Complete normalizer implementation
2. Build template registry
3. Implement PSW template (reference implementation)
4. Create standalone UI
5. Integrate into PPAP workflow

## Governance Rules

1. **Parser MUST remain pure** - No side effects ever
2. **NO database calls in core engine** - Data provided via parameters
3. **NO PPAP coupling in parser** - Context passed explicitly
4. **Business logic belongs in normalizer** - Not in parser
5. **Document engine does NOT read `ppap.status`** - State-agnostic

---

**Last Updated:** 2026-03-26  
**Phase:** 3P Extension (Parser Integration)  
**Status:** Foundation Complete
