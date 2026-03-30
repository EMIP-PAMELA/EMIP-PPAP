# Phase W2A — PPAP Workbook Template Extraction Plan

**Date:** 2026-03-29  
**Revised:** 2026-03-29 (W2A.1 — validated re-inspection)  
**Workbook:** `QUAL TM 0027 - 01 PPAP Package.xlsx`  
**Total Sheets:** 52  
**Status:** Planning phase (inspection validated, implementation not started)

---

> **[W2A.1 CORRECTION]** Previous W2A results were invalid due to environment/classification issues.
> The workbook was re-read from scratch using ExcelJS (Node). All classifications, counts,
> and first-wave selections have been corrected below.

---

## Executive Summary

The PPAP Package workbook contains **52 sheets** organized as:

- **25 blank Form templates** (the actual forms to implement)
- **23 filled Example sheets** (reference copies showing completed forms)
- **3 instruction sheets** (guidance documents)
- **1 metadata sheet** (version history)

The workbook follows a consistent pattern: each PPAP element has a **Form** sheet (blank template for use) and a matching **Example** sheet (filled-in reference).

**First-wave recommendation (corrected):** Implement **Process Flow Diagram**, **PFMEA**, and **Control Plan** — the three core data-driven manufacturing forms with the highest autofill potential from BOM/process data.

---

## Sheet Classification (Validated W2A.1)

### Workbook Structure Pattern

The workbook uses a consistent dual-sheet pattern for each PPAP element:
- **Form sheet** — blank template for actual use (the template to implement)
- **Example sheet** — filled-in reference showing completed form (for field identification)

### Category A: Blank Form Templates (25 sheets)

These are the actual templates to implement. Each is a blank form ready for data entry.

| Sheet# | Sheet Name | Proposed Template ID | Cols | Rows | Priority |
|--------|------------|---------------------|------|------|----------|
| 2 | `2 - SDR - From` | `sdr` | 12 | 15 | Deferred |
| 3 | `3 - Engineering Approval - Form` | `engineering-approval` | 6 | 31 | Deferred |
| 4 | `4 - Design FMEA - Form` | `dfmea` | 19 | 42 | Deferred |
| 5 | `5-Proces Flow Diagram` | `process-flow` | 22 | 99 | **FIRST-WAVE** |
| 6 | `6a - Process FMEA - Form` | `pfmea` | 73 | 36 | **FIRST-WAVE** |
| 7 | `6b_PFMEA summary - Form` | `pfmea-summary` | 44 | 36 | **FIRST-WAVE** |
| 8 | `7_Process Control Plan - Form` | `control-plan` | 13 | 59 | **FIRST-WAVE** |
| 9 | `8a - MSA (Bias Study)` | `msa-bias` | 23 | 74 | Deferred |
| 10 | `8b - MSA (Gage R&R) - Form` | `msa-gage-rr` | 32 | 64 | Deferred |
| 11 | `8c1 - MSA Attribute - Form` | `msa-attribute-1` | 48 | 127 | Deferred |
| 12 | `8c2 - MSA Attribute - Form` | `msa-attribute-2` | 26 | 128 | Deferred |
| 13 | `9 - Dimensional Results - Form` | `dimensional-results` | 27 | 53 | Deferred |
| 14 | `10a - Material Test - Form` | `material-test` | 17 | 39 | Deferred |
| 15 | `10b - Performance Test - Form` | `performance-test` | 17 | 47 | Deferred |
| 16 | `11a - Process Studies - Form` | `process-studies` | 34 | 59 | Deferred |
| 17 | `11b - Process Studies - Form` | `process-studies-detailed` | 256 | 160 | Ignore (too complex) |
| 18 | `12 - Qualified Lab` | `qualified-lab` | 5 | 16 | Deferred |
| 19 | `13 - Appearance Approval - Form` | `appearance-approval` | 24 | 39 | Deferred |
| 20 | `14 - PPAP Sample product` | `sample-product` | 15 | 11 | Deferred |
| 21 | `16 Checking Aids` | `checking-aids` | 8 | 14 | Deferred |
| 22 | `17 Special Req - Package form` | `packaging-approval` | 11 | 57 | Deferred |
| 23 | `17Special Req - FFF Form` | `fff-form` | 17 | 32 | Deferred |
| 24 | `18 - PSW - Form` | `psw` | 67 | 146 | Deferred |
| 25 | `20 - ELC - Form` | `elc` | 13 | 55 | Deferred |
| 26 | `22 - CDR Form` | `cdr` | 43 | 53 | Deferred |

### Category B: Filled Example Sheets (23 sheets)

Reference copies showing completed forms. Used for field identification during implementation, not implemented as templates themselves.

| Sheet# | Sheet Name | Corresponds To |
|--------|------------|----------------|
| 27 | `2- SDR - Example` | Form sheet 2 |
| 28 | `3 - Eng Approval - Example` | Form sheet 3 |
| 29 | `5 - Process Flow - Example` | Form sheet 5 |
| 30 | `6a - Process FMEA - Example` | Form sheet 6 |
| 31 | `6b_PFMEA summary - Example` | Form sheet 7 |
| 32 | `7 - Control Plan Example` | Form sheet 8 |
| 33 | `8a - MSA (Bias Study) - Example` | Form sheet 9 |
| 34 | `8b - MSA (Gage R&R) - Example` | Form sheet 10 |
| 35 | `8c - MSA Attribute example` | Form sheets 11-12 |
| 36 | `9-Dimensional Results - Example` | Form sheet 13 |
| 37 | `10a - Material Test - Example` | Form sheet 14 |
| 38 | `11a - Process Studies - Example` | Form sheet 16 |
| 39 | `11b - Process Studies - Example` | Form sheet 17 |
| 40 | `12 - Qualified Lab - Example` | Form sheet 18 |
| 41 | `14- PPAP Sample Product-Example` | Form sheet 20 |
| 42 | `16-Checking Aids - Example` | Form sheet 21 |
| 43 | `17 Special Reg -Package Example` | Form sheet 22 |
| 44 | `18 - PSW - Example` | Form sheet 24 |
| 46 | `20 - ELC Example` | Form sheet 25 |
| 47 | `20 - Ichart Example S` | ELC sub-chart |
| 48 | `20 - Ichart Example M` | ELC sub-chart |
| 50 | `22 - CDR Example` | Form sheet 26 |
| 51 | `22 - CDR Evidence Example` | CDR supporting evidence |

### Category C: Instructions (3 sheets)

| Sheet# | Sheet Name | Purpose |
|--------|------------|---------|
| 1 | `Summary and Instructions` | General workbook guidance |
| 45 | `20 - ELC - Instruction for sup.` | ELC-specific instructions |
| 49 | `22 - Inst for Cap Demo` | CDR field definitions |

### Category D: Metadata (1 sheet)

| Sheet# | Sheet Name | Purpose |
|--------|------------|---------|
| 52 | `Version History` | Workbook revision tracking |

---

## W2A vs W2A.1 Discrepancy Log

| Item | Previous W2A | Corrected W2A.1 | Issue |
|------|-------------|-----------------|-------|
| Template count | 18 | 25 blank forms + 23 examples | Undercounted; many Form sheets missed |
| Instruction count | 20 | 3 | Overcounted; fabricated instruction sheets that don't exist |
| Example count | 14 | 23 | Undercounted; most examples not cataloged |
| First-wave selection | PSW, Cover Page, Index | Process Flow, PFMEA, Control Plan | Wrong strategy; data-driven forms should come first |
| Sheet naming | Used Example sheet names | Used Form sheet names | Forms are the templates; Examples are references |

> **[W2A.1 CORRECTION]** Previous W2A results were invalid. The workbook has NO Cover Page form, NO Index form — those sheet names were fabricated. The actual workbook uses numbered PPAP elements (2-22) following AIAG standard.

---

## First-Wave Template Recommendations (Corrected)

> **[W2A.1 STRATEGY]** First-wave templates corrected to data-driven forms.
> These three forms share process/operations data and form the core manufacturing triad.

### Template 1: Process Flow Diagram — FIRST WAVE

**Form Sheet:** `5-Proces Flow Diagram` (Sheet 5)  
**Example Sheet:** `5 - Process Flow - Example` (Sheet 29)  
**Template ID:** `process-flow`  
**Dimensions:** 22 cols x 99 rows (Form), 22 cols x 79 rows (Example)

**Why First-Wave:**
- Directly maps to BOM operations (step-by-step process)
- Operations data already parsed by Visual Master Parser
- Feeds into PFMEA and Control Plan (upstream dependency)
- Tabular format — straightforward template extraction

**Autofill Readiness:**

| Field Category | Autofill Potential | Source | Notes |
|----------------|-------------------|--------|-------|
| Process steps / operations | **HIGH** | BOM operations | Step numbers, descriptions, resources |
| Operation sequence | **HIGH** | BOM operation order | Natural ordering from parser |
| Input/output materials | **MEDIUM** | BOM components | Component names per operation |
| Process parameters | **MANUAL** | User input | Specific settings, tolerances |
| Part header info | **HIGH** | BOM master | Part number, name, revision |

**Estimated autofill coverage:** 60-70%

---

### Template 2: Process FMEA (PFMEA) — FIRST WAVE

**Form Sheets:**
- `6a - Process FMEA - Form` (Sheet 6) — Full PFMEA, 73 cols x 36 rows
- `6b_PFMEA summary - Form` (Sheet 7) — Summary view, 44 cols x 36 rows

**Example Sheets:**
- `6a - Process FMEA - Example` (Sheet 30)
- `6b_PFMEA summary - Example` (Sheet 31)

**Template IDs:** `pfmea` (full) + `pfmea-summary`  

**Why First-Wave:**
- Process steps directly from BOM operations (same source as Process Flow)
- PFMEA rows correspond 1:1 with process flow steps
- High business value — required for all PPAP submissions
- Summary form (6b) is simpler entry point

**Autofill Readiness:**

| Field Category | Autofill Potential | Source | Notes |
|----------------|-------------------|--------|-------|
| Process step / function | **HIGH** | BOM operations | Operation descriptions |
| Step number | **HIGH** | BOM operations | Step sequence |
| Part header info | **HIGH** | BOM master | Part number, name, revision |
| Potential failure mode | **MANUAL** | User/engineer | Requires domain expertise |
| Potential effect | **MANUAL** | User/engineer | Requires domain expertise |
| Severity / Occurrence / Detection | **MANUAL** | User/engineer | Risk ratings |
| Recommended actions | **MANUAL** | User/engineer | Corrective actions |
| Current controls | **MANUAL** | User/engineer | Existing process controls |

**Estimated autofill coverage:** 30-40% (process steps auto-filled, risk analysis manual)

**Note:** Recommend starting with `pfmea-summary` (6b) as it has fewer columns and simpler structure.

---

### Template 3: Process Control Plan — FIRST WAVE

**Form Sheet:** `7_Process Control Plan - Form` (Sheet 8)  
**Example Sheet:** `7 - Control Plan Example` (Sheet 32)  
**Template ID:** `control-plan`  
**Dimensions:** 13 cols x 59 rows (Form), 13 cols x 25 rows (Example)

**Why First-Wave:**
- Process steps from BOM operations (same source as Process Flow + PFMEA)
- Narrow column count (13) — simplest of the three to extract
- Directly linked to Process Flow and PFMEA (triad relationship)
- High business value — required for all PPAP submissions

**Autofill Readiness:**

| Field Category | Autofill Potential | Source | Notes |
|----------------|-------------------|--------|-------|
| Process step number | **HIGH** | BOM operations | Operation sequence |
| Process name/description | **HIGH** | BOM operations | Operation descriptions |
| Machine/device/tool | **MEDIUM** | BOM resources (if available) | May need manual entry |
| Part header info | **HIGH** | BOM master | Part number, name, revision |
| Product characteristics | **MANUAL** | User/engineer | Spec requirements |
| Process characteristics | **MANUAL** | User/engineer | Control parameters |
| Control method | **MANUAL** | User/engineer | Inspection/test method |
| Sample size / frequency | **MANUAL** | User/engineer | Sampling plan |
| Reaction plan | **MANUAL** | User/engineer | Out-of-spec response |

**Estimated autofill coverage:** 35-45%

---

## Implementation Order Rationale

The three first-wave templates form a **manufacturing process triad**:

```
Process Flow Diagram → PFMEA → Control Plan
     (what steps)      (what can go wrong)   (how to control)
```

All three share the same upstream data source: **BOM operations from the Visual Master Parser**.

**Recommended implementation sequence:**
1. **Process Flow Diagram** — simplest mapping, establishes operations baseline
2. **Control Plan** — narrowest column count (13), straightforward structure
3. **PFMEA Summary** — widest but builds on same operations data

---

## Deferred Templates (Future Phases)

| Template ID | Form Sheet | Priority | Notes |
|-------------|-----------|----------|-------|
| `psw` | `18 - PSW - Form` | Phase W2C | Critical doc, but mostly manual fields |
| `dimensional-results` | `9 - Dimensional Results - Form` | Phase W2C | Measurement data entry |
| `material-test` | `10a - Material Test - Form` | Phase W3 | Lab data |
| `performance-test` | `10b - Performance Test - Form` | Phase W3 | Test results |
| `dfmea` | `4 - Design FMEA - Form` | Phase W3 | Design-focused, not always required |
| `engineering-approval` | `3 - Engineering Approval - Form` | Phase W3 | Simple approval form |
| `sdr` | `2 - SDR - From` | Phase W3 | Supplier deviation request |
| `msa-bias` | `8a - MSA (Bias Study)` | Phase W4 | Statistical analysis |
| `msa-gage-rr` | `8b - MSA (Gage R&R) - Form` | Phase W4 | Measurement system |
| `msa-attribute-1` | `8c1 - MSA Attribute - Form` | Phase W4 | Attribute study |
| `msa-attribute-2` | `8c2 - MSA Attribute - Form` | Phase W4 | Attribute study alt |
| `process-studies` | `11a - Process Studies - Form` | Phase W4 | Capability studies |
| `appearance-approval` | `13 - Appearance Approval - Form` | Phase W4 | Visual inspection |
| `qualified-lab` | `12 - Qualified Lab` | Phase W5 | Lab accreditation |
| `checking-aids` | `16 Checking Aids` | Phase W5 | Gauge inventory |
| `packaging-approval` | `17 Special Req - Package form` | Phase W5 | Packaging specs |
| `fff-form` | `17Special Req - FFF Form` | Phase W5 | Fit/form/function |
| `sample-product` | `14 - PPAP Sample product` | Phase W5 | Photo-based |
| `elc` | `20 - ELC - Form` | Phase W5 | Early launch containment |
| `cdr` | `22 - CDR Form` | Phase W5 | Capacity demonstration |

---

## Autofill Architecture Strategy

### Data Sources (Current System)

1. **Engineering BOM (Visual Master)**
   - Master part number, description
   - Operations (steps, resources, descriptions) — **primary autofill source for first-wave**
   - Components (child parts, quantities, units)
   - Supplier/customer references (if present)

2. **System Configuration**
   - Supplier profile (name, address, contact)
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
| **HIGH** | High autofill | Field directly maps to parsed BOM data |
| **MEDIUM** | Medium autofill | Field partially derivable, may need user confirmation |
| **MANUAL** | Manual entry | Field requires domain expertise or external data |
| **AI-FUTURE** | AI-assisted | Future: intelligent inference/suggestion |

---

## Implementation Roadmap

### Phase W2A — Planning (COMPLETE)
- [x] Inspect workbook structure
- [x] Classify all 52 sheets
- [x] Identify first-wave candidates (corrected W2A.1)
- [x] Document autofill readiness

### Phase W2B — Template Extraction (Next)
- [ ] Create `ProcessFlowTemplate` definition
- [ ] Create `ControlPlanTemplate` definition
- [ ] Create `PfmeaSummaryTemplate` definition
- [ ] Map BOM operations to template fields
- [ ] Register templates in shared registry
- [ ] Test generation from sample BOM

### Phase W2C — Wizard Integration
- [ ] Add first-wave templates to wizard dropdown
- [ ] Connect autofill mappings to wizard
- [ ] Add PSW and Dimensional Results templates
- [ ] Test end-to-end generation

### Phase W3+ — Remaining Templates
- [ ] MSA templates (Bias, Gage R&R, Attribute)
- [ ] Process Studies
- [ ] Remaining PPAP elements
- [ ] (prioritized by business value)

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

### Field Mapping Strategy for First-Wave

Key mapping: **BOM Operations → Process Steps**

```
BOM Operation.step        → Process Flow step number
BOM Operation.description → Process Flow step description
BOM Operation.resource    → Process Flow machine/tool
BOM Operation.step        → PFMEA process step
BOM Operation.description → PFMEA process function
BOM Operation.step        → Control Plan operation number
BOM Operation.description → Control Plan process description
```

### Storage

- **Static templates:** `src/features/documentEngine/templates/ppap/` (TypeScript classes)
- **Dynamic templates:** `dynamic_templates` table (if user-uploaded)
- **Registry:** `templateRegistry.ts` (shared registry)

---

## Success Criteria

**Phase W2 Complete When:**

1. Process Flow, PFMEA Summary, and Control Plan templates registered
2. Templates generate drafts with BOM operations auto-populated
3. Autofill coverage meets estimated targets (35-70% by template)
4. Wizard displays first-wave templates in dropdown
5. User can upload BOM, select template, generate draft, edit, export
6. No regressions to existing W1 features

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Complex Excel layout (merged cells, formatting) | High | Use Example sheets for field identification, Form sheets for structure |
| BOM operations insufficient for all fields | Medium | Clearly label manual vs auto fields in UI |
| PFMEA has 73 columns | High | Start with PFMEA Summary (6b, 44 cols) first |
| Template parsing errors | Medium | Robust error handling, fallback to manual |
| Process Flow is graphical in nature | Medium | Focus on tabular data, not visual flow rendering |

---

## Open Questions

1. **PFMEA scope:** Implement full PFMEA (6a) or only summary (6b) first? Recommendation: summary first
2. **Process Flow rendering:** Table-based or visual flowchart? Recommendation: table first
3. **Cross-template linking:** Should Process Flow steps auto-populate PFMEA/Control Plan? Recommendation: yes, via shared operations
4. **Template versioning:** How to handle workbook updates? Version templates in registry
5. **Conditional fields:** Some fields only required at certain submission levels. Phase W3 feature

---

## Next Steps

**Immediate Actions (Phase W2B):**

1. Deep-inspect Form sheets 5, 7, 8 (Process Flow, PFMEA Summary, Control Plan) — extract exact field layouts
2. Deep-inspect Example sheets 29, 31, 32 — identify field values and expected data types
3. Create `src/features/documentEngine/templates/ppap/ProcessFlowTemplate.ts`
4. Create `src/features/documentEngine/templates/ppap/ControlPlanTemplate.ts`
5. Create `src/features/documentEngine/templates/ppap/PfmeaSummaryTemplate.ts`
6. Define BOM operations field mappings
7. Register in `templateRegistry.ts`
8. Test generation with sample BOM data

**No Implementation Yet** — This is planning phase only.

---

**END OF PLAN (W2A.1 Validated)**
