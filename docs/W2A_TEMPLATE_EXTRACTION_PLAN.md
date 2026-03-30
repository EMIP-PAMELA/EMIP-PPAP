# Phase W2A — PPAP Workbook Template Extraction Plan

**Date:** 2026-03-29  
**Workbook:** `QUAL TM 0027 - 01 PPAP Package.xlsx`  
**Total Sheets:** 52  
**Status:** Planning phase (inspection complete, implementation not started)

---

## Executive Summary

The PPAP Package workbook contains **52 sheets** comprising PPAP submission forms, examples, and instructions. After inspection, **18 sheets** are identified as real templates, **34 sheets** are examples/instructions/reference material.

**Recommendation:** Implement **3 first-wave templates** with high autofill potential from engineering BOM data.

---

## Sheet Classification

### Category A: Real Templates (18 sheets)

Forms that should be implemented as templates in the system:

| # | Sheet Name | Template ID (proposed) | Rows | Cols | Priority |
|---|------------|------------------------|------|------|----------|
| 1 | `18 - PSW - Example` | `psw` | 151 | 67 | **FIRST-WAVE** |
| 2 | `01 - Cover - Example` | `cover-page` | 38 | 8 | **FIRST-WAVE** |
| 3 | `02 - Index - Example` | `ppap-index` | 71 | 5 | **FIRST-WAVE** |
| 4 | `03 - Design Record - Example` | `design-record` | 26 | 7 | Deferred |
| 5 | `04 - DFMEA - Example` | `dfmea` | 32 | 29 | Deferred |
| 6 | `05a - PFMEA - Example` | `pfmea` | 32 | 35 | Deferred |
| 7 | `05b - Control Plan - Example` | `control-plan` | 51 | 25 | Deferred |
| 8 | `06 - P.Diag -Example` | `process-diagram` | 16 | 11 | Deferred |
| 9 | `08 - App Mat - Example` | `approved-materials` | 11 | 8 | Deferred |
| 10 | `09a - Dim Results - Example` | `dimensional-results` | 78 | 31 | Deferred |
| 11 | `09b - Dim Results - Example` | `dimensional-results-alt` | 56 | 32 | Ignore (duplicate) |
| 12 | `10a - Material Test - Example` | `material-test` | 39 | 15 | Deferred |
| 13 | `11a - Process Studies - Example` | `process-studies-summary` | 138 | 34 | Deferred |
| 14 | `11b - Process Studies - Example` | `process-studies-detailed` | 160 | 256 | Ignore (too complex) |
| 15 | `12 - Qualified Lab - Example` | `qualified-lab` | 17 | 5 | Deferred |
| 16 | `14- PPAP Sample Product-Example` | `sample-product` | 8 | 15 | Ignore (photo-based) |
| 17 | `16-Checking Aids - Example` | `checking-aids` | 14 | 8 | Deferred |
| 18 | `17 Special Reg -Package Example` | `packaging-approval` | 56 | 11 | Deferred |

### Category B: Instructions/Reference (20 sheets)

Documentation and guidance, not templates:

- `Submission requirement overview`
- `Read me - General instruction`
- `00 Index - Instruction`
- `01 - Instruction for Cover page`
- `02 - Instruction for Index`
- `03 - Instruction Design Record`
- `04 - Inst. DFMEA`
- `05a - Inst. PFMEA`
- `05b - Inst. for control plan`
- `06 - Inst P.Diag`
- `07a, 07b, 08, 09a, 09b, 10a - Inst. (various)`
- `11, 12, 14, 16, 17, 18 - Inst. (various)`
- `20 - ELC - Instruction for sup.`
- `20 - Inst for Cap Demo`

### Category C: Examples/Support (14 sheets)

Supporting materials, charts, evidence templates:

- `20 - ELC Example`
- `20 - Ichart Example S`
- `20 - Ichart Example M`
- `22 - CDR Example`
- `22 - CDR Evidence Example`
- `Version History`

---

## First-Wave Template Recommendations

### Template 1: Part Submission Warrant (PSW) ⭐ TOP PRIORITY

**Sheet:** `18 - PSW - Example`  
**Template ID:** `psw`  
**Dimensions:** 151 rows × 67 columns  
**Business Value:** ⭐⭐⭐⭐⭐ (CRITICAL - primary PPAP submission document)

**Autofill Readiness:**

| Field Category | Autofill Potential | Source | Notes |
|----------------|-------------------|---------|-------|
| Part identification | ✅ **High** | Engineering BOM master | Part number, description, customer info |
| Supplier information | ✅ **High** | System config/profile | Supplier name, code, contact |
| Submission details | ⚠️ **Medium** | Metadata + manual | Submission level, reason code |
| Engineering change | ❌ **Manual** | User input | ECN numbers, dates |
| Materials/specs | ⚠️ **Medium** | BOM components | Material codes, specifications |
| Weight/dimensions | ⚠️ **Medium** | BOM master if available | Product weight, dimensions |
| Approvals/signatures | ❌ **Manual** | User input | Names, dates, signatures |

**Implementation Priority:** 🔥 **FIRST** (Week 1)

**Complexity:** Medium  
**Dependencies:** None (standalone form)

---

### Template 2: Cover Page ⭐ FIRST-WAVE

**Sheet:** `01 - Cover - Example`  
**Template ID:** `cover-page`  
**Dimensions:** 38 rows × 8 columns  
**Business Value:** ⭐⭐⭐⭐ (Professional presentation, required for package)

**Autofill Readiness:**

| Field Category | Autofill Potential | Source | Notes |
|----------------|-------------------|---------|-------|
| Part information | ✅ **High** | Engineering BOM master | Part number, name, revision |
| Supplier details | ✅ **High** | System config | Company name, logo, address |
| Submission metadata | ⚠️ **Medium** | Wizard inputs | Submission date, package type |
| Customer information | ⚠️ **Medium** | System config or manual | Customer name, program |
| Document control | ❌ **Manual** | User input | Document number, revision |

**Implementation Priority:** 🔥 **SECOND** (Week 1)

**Complexity:** Low (simple form, mostly static fields)  
**Dependencies:** None

---

### Template 3: PPAP Index ⭐ FIRST-WAVE

**Sheet:** `02 - Index - Example`  
**Template ID:** `ppap-index`  
**Dimensions:** 71 rows × 5 columns  
**Business Value:** ⭐⭐⭐⭐ (Navigation, completeness checklist)

**Autofill Readiness:**

| Field Category | Autofill Potential | Source | Notes |
|----------------|-------------------|---------|-------|
| Document checklist | ⚠️ **Medium** | Template config | Standard PPAP elements (AIAG) |
| Submission status | ❌ **Manual** | User checklist | Which items submitted/waived |
| Page numbers | 🤖 **AI-assisted** | Future: document assembly | Auto-number if multi-doc package |
| Part identification | ✅ **High** | Engineering BOM master | Part number, name |
| Notes/deviations | ❌ **Manual** | User input | Waiver justifications |

**Implementation Priority:** 🔥 **THIRD** (Week 2)

**Complexity:** Medium (dynamic checklist behavior)  
**Dependencies:** Template registry awareness (to list available docs)

---

## Deferred Templates (Future Phases)

### High Value, Complex Autofill

1. **Control Plan** (`05b - Control Plan - Example`)
   - **Value:** ⭐⭐⭐⭐⭐
   - **Complexity:** High (process steps, characteristics, controls)
   - **Autofill:** Medium (some from BOM operations, mostly manual)
   - **Phase:** W2B or later

2. **Process Flow Diagram** (`06 - P.Diag -Example`)
   - **Value:** ⭐⭐⭐⭐
   - **Complexity:** High (graphical/flowchart format)
   - **Autofill:** Low (operations from BOM, flow logic manual)
   - **Phase:** W3+

3. **Dimensional Results** (`09a - Dim Results - Example`)
   - **Value:** ⭐⭐⭐⭐
   - **Complexity:** High (inspection data, measurements)
   - **Autofill:** Low (part dims from BOM, measurements manual)
   - **Phase:** W2B or later

### Lower Priority / Specialized

4. **DFMEA** (`04 - DFMEA - Example`) — Design-focused, not always supplier-submitted
5. **PFMEA** (`05a - PFMEA - Example`) — Process analysis, complex
6. **Approved Materials** (`08 - App Mat - Example`) — Simple, low frequency
7. **Material Test Results** (`10a - Material Test - Example`) — Lab data entry
8. **Process Studies** (`11a - Process Studies - Example`) — Statistical data
9. **Qualified Lab** (`12 - Qualified Lab - Example`) — Calibration records
10. **Checking Aids** (`16-Checking Aids - Example`) — Gauge/equipment list
11. **Packaging Approval** (`17 Special Reg -Package Example`) — Packaging specs

---

## Autofill Architecture Strategy

### Data Sources (Current System)

1. **Engineering BOM (Visual Master)**
   - Master part number
   - Part description
   - Operations (steps, resources, descriptions)
   - Components (child parts, quantities, units)
   - Supplier/customer references (if present)

2. **System Configuration**
   - Supplier profile (name, address, contact, logo)
   - Customer database (if available)
   - Document templates registry

3. **Wizard Inputs (User-provided)**
   - Submission level (1-5)
   - Submission reason (initial, engineering change, tooling, etc.)
   - Program/project codes
   - Dates and metadata

### Autofill Categories

| Symbol | Category | Definition |
|--------|----------|------------|
| ✅ | **High autofill** | 80%+ fields can be populated from BOM/config |
| ⚠️ | **Medium autofill** | 40-80% fields autofillable, rest manual |
| ❌ | **Manual** | <40% autofillable, mostly user input |
| 🤖 | **AI-assisted** | Future: intelligent inference/suggestion |

---

## Implementation Roadmap

### Phase W2A (Current) — Planning ✅
- [x] Inspect workbook structure
- [x] Classify sheets
- [x] Identify first-wave candidates
- [x] Document autofill readiness

### Phase W2B — Template Extraction (Next)
- [ ] Create `PswTemplate` class
- [ ] Create `CoverPageTemplate` class
- [ ] Create `PpapIndexTemplate` class
- [ ] Register templates in shared registry
- [ ] Add field mappings for autofill
- [ ] Test generation from sample BOM

### Phase W2C — Wizard Integration
- [ ] Add template selector dropdown in wizard
- [ ] Enable template upload/save flow
- [ ] Connect autofill mappings to wizard
- [ ] Test end-to-end generation

### Phase W3+ — Additional Templates
- [ ] Control Plan
- [ ] Process Flow Diagram
- [ ] Dimensional Results
- [ ] (others as prioritized)

---

## Technical Notes

### Template Definition Pattern

Based on existing `TemplateDefinition` interface:

```typescript
export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  category: 'ppap' | 'engineering' | 'quality';
  fieldDefinitions: FieldDefinition[];
  fieldMappings?: FieldMapping[];
  generate(input: TemplateInput): DocumentDraft;
}
```

### Field Mapping Strategy

Leverage existing `applyTemplateMappings()` from `templateMappingService.ts`:

- Map BOM master fields → PSW part info
- Map BOM operations → process-related fields
- Map system config → supplier/customer fields
- Leave complex/approval fields unmapped (manual entry)

### Storage

- **Static templates:** `src/features/documentEngine/templates/ppap/` (TypeScript classes)
- **Dynamic templates:** `dynamic_templates` table (if user-uploaded)
- **Registry:** `templateRegistry.ts` (shared registry)

---

## Success Criteria

**Phase W2 Complete When:**

1. ✅ PSW, Cover Page, and Index templates registered
2. ✅ Templates generate blank drafts correctly
3. ✅ Autofill mappings populate 60%+ of fields from BOM
4. ✅ Wizard displays templates in dropdown
5. ✅ User can upload BOM → select template → generate draft → edit → export
6. ✅ No regressions to existing W1 features

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Excel structure too complex | High | Start with simplest template (Cover Page) first |
| Field mapping ambiguity | Medium | Document assumptions, allow manual override |
| Template parsing errors | Medium | Robust error handling, fallback to manual |
| User expectation mismatch | Medium | Clear autofill vs manual labels in UI |
| Performance (large templates) | Low | Lazy load, optimize field rendering |

---

## Open Questions

1. **Template versioning:** How to handle workbook updates? → Version templates in registry
2. **Multi-sheet templates:** Should Control Plan + PFMEA be one template or two? → Separate for flexibility
3. **Conditional fields:** Some fields only required at certain submission levels → Phase W3 feature
4. **Approval workflow:** Should PSW include approval gates? → No, wizard is approval-free
5. **Template upload UI:** Should users upload Excel or manually configure? → Phase W2C decision

---

## Next Steps

**Immediate Actions (Phase W2B):**

1. Create `src/features/documentEngine/templates/ppap/PswTemplate.ts`
2. Create `src/features/documentEngine/templates/ppap/CoverPageTemplate.ts`
3. Create `src/features/documentEngine/templates/ppap/PpapIndexTemplate.ts`
4. Define field mappings for each template
5. Register in `templateRegistry.ts`
6. Test generation with sample BOM data

**No Implementation Yet** — This is planning phase only.

---

**END OF PLAN**
