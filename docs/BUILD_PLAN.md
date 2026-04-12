# EMIP-PPAP System Architecture & Build Plan

**Last Updated:** 2026-04-07 14:35 CT  
**Version:** V5.0 - 3-Layer Architecture Realignment  
**Status:** Foundation Layer Established + Architectural Blueprint

**Previous Version:** 3F.15 + Implementation Update (Phases 9-21)  
**Archive:** `BUILD_PLAN_ARCHIVE_20260325.md`

---

## CURRENT PHASE

HWI.15.4.1 — System Stabilization

---

## CURRENT SYSTEM STATE

- **Vault intake:** store-first, non-blocking uploads for every document class
- **Classification engine:** asynchronous multi-pass service (deterministic → heuristic → AI scaffold)
- **Alias system:** drawing ↔ part mapping through lookup + learned hints
- **Linking engine:** multi-signal inference guarded by signal presence + confidence thresholds

---

## ACTIVE OBJECTIVES

- enforce store-first ingestion
- stabilize classification lifecycle
- prevent invalid linking
- fix retry mechanism
- eliminate data corruption paths

---

## KNOWN ISSUES (FROM AUDIT)

- retry engine not yet implemented (status-based retries lack scheduler)
- `PARTIAL_MISMATCH` persistence bug
- provisional SKU cleanup missing
- UNKNOWN document type misclassification via fallback materialization
- documentation drift vs implementation

---

## NEXT PHASES

- HWI.15.4.1 — Stabilization *(current)*
- HWI.15.5 — Revision Intelligence
- HWI.15.6 — Component Graph

---

## DEFERRED WORK

- full AI classification
- graph visualization
- automated SKU merging

---

## V5.0 ARCHITECTURE REALIGNMENT (2026-04-07)

### System Architecture - Three Layers

**V5.0 establishes EMIP as a properly layered system with clear separation of concerns:**

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: APPLICATION / UI                                   │
│ - Workflow screens                                          │
│ - Dashboards                                                │
│ - User interaction components                               │
└─────────────────────────────────────────────────────────────┘
                          ↓ consumes
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: DOMAIN ENGINES                                     │
│ - PPAP (process/state engine)                  [COMPLETE]   │
│ - Copper Index (cost/analytics engine)        [SCAFFOLDED] │
│ - Future modules (DFMEA, MSA, etc.)                         │
└─────────────────────────────────────────────────────────────┘
                          ↓ consumes
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: FOUNDATION (EMIP Core)              [V5.0 NEW]    │
│ - BOM Repository (canonical data store)                     │
│ - Parser Engine (shared BOM parsing)                        │
│ - Data Services (single access point)                       │
│ - Ingestion Pipeline (normalize & store)                    │
│ - Parts Master (future)                                     │
└─────────────────────────────────────────────────────────────┘
```

### V5.0 Core Components

**EMIP Core Data Backbone** (`src/core/`)

1. **BOM Repository** (`src/core/data/bom/`)
   - Canonical BOM data model with full traceability
   - Normalized storage format (parent/child/qty/unit/metadata)
   - Source tracking (visual_export, engineering_master, manual_entry)
   - Versioning and revision control

2. **Parser Service** (`src/core/parser/`)
   - Pure parsing engine (NO side effects, NO feature coupling)
   - Extracted from documentEngine to foundation layer
   - Shared across all feature modules
   - Confidence scoring and error handling
   - Parser version tracking (V5.0.0)

3. **BOM Service** (`src/core/services/`)
   - **SINGLE ACCESS POINT** for all BOM data
   - Methods: `getBOM()`, `getFlattenedBOM()`, `getWireLines()`, `getBOMBySource()`
   - Abstract data source (in-memory cache V5.0, database V5.1)
   - Debug logging for all BOM access

4. **Ingestion Pipeline** (`src/core/data/bom/ingestion.ts`)
   - Parse → Normalize → Store pipeline
   - Wire detection and enrichment
   - Full metadata capture (source, timestamp, parser version)
   - Validation before ingestion

### V5.0 Module Boundaries - CRITICAL RULES

**✅ ALLOWED:**
- Feature modules consume BOM via `core/services/bomService`
- Domain engines operate on engineering data
- UI components call domain engines

**❌ FORBIDDEN:**
- Feature modules MUST NOT parse BOM independently
- Feature modules MUST NOT own BOM data
- NO cross-feature imports (PPAP ← → Copper Index)
- NO parsing logic outside `core/parser`

### Copper Index Module (Scaffolded)

**Status:** Placeholder structure created, not yet implemented

**Location:** `src/features/copper-index/`

**Purpose:** Calculate copper costs for wire harness assemblies

**Architecture Compliance:**
- ✅ Imports BOM via `core/services/bomService` (enforced)
- ✅ NO parsing logic (uses core)
- ✅ Isolated from PPAP module
- 🔲 Implementation pending (future phase)

### V5.0 Impact on Existing Systems

**PPAP Workflow System:**
- ✅ Fully preserved and operational
- ✅ No breaking changes
- ✅ Can now consume BOM via core services if needed

**Document Engine:**
- ✅ Continues to operate as before
- 🔄 Can migrate to use `core/parser` and `core/services` (optional optimization)
- ✅ No breaking changes

**Build Status:**
- ✅ All existing functionality intact
- ✅ New core layer added without disruption
- ✅ TypeScript compilation successful

---

## IMPLEMENTATION STATUS OVERVIEW

**Post-Implementation Clarification** — Added 2026-03-28

This section summarizes the current implementation status of the EMIP-PPAP system as of Phase 21, reconciling the original BUILD_PLAN with actual delivered functionality.

### Legacy PPAP Workflow System (Phase 3F–3K) — IMPLEMENTED

**Status:** ✅ **COMPLETE AND OPERATIONAL**

The core PPAP workflow system defined in this BUILD_PLAN has been fully implemented:

- **State Machine Architecture:** `ppap.status` as single source of truth ✅
- **5-Layer Process Model:** Intake → Pre-Ack → Ack Gate → Post-Ack → Submission ✅
- **Role-Based Authority:** Coordinator vs Engineer boundaries enforced ✅
- **Guided Validation Flow:** Sequential validation with completion tracking ✅
- **Pre-Ack/Post-Ack Boundary:** Hard separation with lock-on-acknowledge ✅
- **Document Upload System:** File upload and tracking for external documents ✅
- **Event Logging:** All state transitions logged to audit trail ✅

**Key Governance Rules Enforced:**
- All status updates flow through `updatePPAPState()` ✅
- No direct database status writes ✅
- Backward transition guards active ✅
- Acknowledgement gate restricted to Coordinator/Admin roles ✅

### Document Engine System (Phase 3P–3V, Phases 9–21) — IMPLEMENTED

**Status:** ✅ **COMPLETE AND OPERATIONAL**

The Document Engine addendum (added in Version 3P.1) has been fully implemented across 13 phases:

**Core Engine (Phases 9–11):**
- **Phase 9.1–9.3:** Document generation (Process Flow, PFMEA, Control Plan) ✅
- **Phase 10:** OEM alignment and BOM-to-document mapping ✅
- **Phase 11:** Validation engine with field-level error reporting ✅

**Workspace & Workflow (Phases 12–16):**
- **Phase 12:** DocumentWorkspace UI with template selection and editing ✅
- **Phase 13–15:** Workflow guidance (dependency chains, staleness detection, soft gating) ✅
- **Phase 16:** Local session persistence (multi-session support) ✅

**Integration & Governance (Phases 17–21):**
- **Phase 17:** PPAP integration (`/ppap/[id]/documents` route) ✅
- **Phase 18:** Multi-session management with session switching ✅
- **Phase 19:** Hard workflow gating (prerequisite enforcement) ✅
- **Phase 20:** Approval workflow (owner + draft/review/approved lifecycle) ✅
- **Phase 21:** **Document system unification (single entry point)** ✅

**Capabilities Delivered:**
- BOM-driven document generation ✅
- Template-based field mapping ✅
- Real-time validation with error highlighting ✅
- PDF export per document ✅
- Dependency-aware generation (Process Flow → PFMEA → Control Plan) ✅
- Session persistence across page reloads ✅
- Approval gating before export ✅
- Single unified document system (Phase 21) ✅

### Current System Architecture (As of Phase 21)

**TWO INTEGRATED LAYERS:**

1. **PPAP Workflow System** (state-driven, validation-driven)
   - Routes: `/ppap`, `/ppap/[id]`, `/ppap/dashboard`
   - Components: `PPAPWorkflowWrapper`, `DocumentationForm`, `PPAPControlPanel`
   - Purpose: PPAP lifecycle management, validation tracking, submission gating
   - Status: Fully operational

2. **Document Engine System** (data-driven, template-driven)
   - Routes: `/ppap/[id]/documents`, `/document-workspace`
   - Components: `DocumentWorkspace`, `BOMUpload`, `DocumentEditor`
   - Purpose: BOM-driven document generation, editing, validation, export
   - Status: Fully operational

**Integration Point:** `/ppap/[id]/documents` (Phase 17)

**Unified Entry:** Phase 21 eliminated duplicate document systems; DocumentWorkspace is now the SINGLE entry point for all document creation.

### Implementation Complete

**Phases 9–21:** ✅ All delivered and operational
**Phases W1, W2A-W2E, V2.1-V2.6:** ✅ Document Wizard complete
**Phase V2.6X:** ✅ Field Certainty + Guided Completion UX
**Phase V2.6B/V2.6B.1:** ✅ Process Flow Excel Template Injection
**Phase V2.6Y:** ✅ Guided Completion Mode with Navigation
**Phase V2.6Z:** ✅ Dropdown and Boilerplate Input System
**Phase V2.7A:** ✅ Centralized Option Registry
**Phase V2.7B:** ✅ Control Plan Excel Template Injection
**Phase V2.7C:** ✅ Soft Pre-Export Completeness Warning
**Phase V2.7D:** ✅ PFMEA Excel Injection (Limited + Honest)
**Phase V2.7E:** ✅ Field-Level Context / "Why" Layer
**Phase V2.8A:** ✅ Export Mapping Validation & Alignment
**Phase V2.8B:** ✅ Export Readiness Indicator
**Phase V2.8B.1:** ✅ ExcelJS Workbook Stability Patch
**Phase V2.8B.3:** ✅ Worksheet Protection Neutralization
**Phase V2.8B.4:** ✅ Row-Level Protection Normalization
**Phase V2.8B.5:** ✅ Aggressive Protection Metadata Stripping
**Phase V2.8B.6:** ✅ Workbook Rehydration (Clean Rebuild)
**Phase V2.8C:** ✅ Required Field Summary
**Phase V2.8C.1:** ✅ Controlled Formatting Reconstruction
**Phase V2.8C.3:** ✅ Controlled Merge Reconstruction
**Phase V2.8C.5:** ✅ Deterministic Border Reconstruction
**Phase V2.9A:** ✅ Single Sheet Export
**Phase V2.9B-PF.1:** ✅ Process Flow Header + Symbol Reconstruction
**Phase V2.9B-PF.4:** ✅ Symbol Image Browser Compatibility Fix
**Phase V2.9B-PF.5:** ✅ Process Flow Data Injection Column Alignment Fix
**Phase V2.9B-PF.8:** ✅ STEP Table Landmark Detection with Contextual Validation
**Phase V2.9B-PF.9:** ✅ Multi-Column Landmark Detection (STEP + ROUTING + OPERATION)

**What is COMPLETE:**
- ✅ Document generation engine (Process Flow, PFMEA, Control Plan, PSW)
- ✅ BOM parsing and normalization
- ✅ Field-level validation with error reporting
- ✅ Dependency-based workflow with staleness detection
- ✅ Multi-session persistence
- ✅ PPAP integration with dedicated route
- ✅ Document Wizard with PDF extraction and autofill (W1-W2E, V2.1-V2.6)
- ✅ Field certainty classification and guided completion UX (V2.6X)
- ✅ Excel workbook template export (Process Flow, PFMEA Summary - V2.6/V2.6B)
- ✅ Approval workflow (owner + status lifecycle)
- ✅ Document system unification (Phase 21)

**What is PARTIALLY IMPLEMENTED:**
- ⚠️ Document upload coexists with generation (legacy upload preserved for external docs)
- ⚠️ Validation system exists in both layers (PPAP workflow validations + document field validations)

**What is PLANNED (Post-21):**
- 🔲 Backend persistence (PPAP-linked document storage)
- 🔲 Real user system (ownership tied to authenticated users)
- 🔲 Document revision/version control
- 🔲 Additional templates (DFMEA, MSA, Dimensional Results)

### Key Architectural Decision (Phase 21)

**"There must be ONE document system in the application."**

**Before Phase 21:**
- Legacy `/tools/*` routes (broken, dead code)
- Individual "Create" buttons per document (confusing UX)
- Multiple entry points for document creation

**After Phase 21:**
- ✅ ONE system: DocumentWorkspace
- ✅ ONE entry point: `/ppap/[id]/documents`
- ✅ Clear, consistent UX across all PPAP interfaces

**Impact:** All document creation now flows through DocumentWorkspace. Upload functionality preserved for external documents only (e.g., customer-supplied files).

### Reconciliation Summary

This BUILD_PLAN remains the architectural blueprint. The implementation (Phases 9–21) has:
- ✅ Preserved all core PPAP workflow architecture
- ✅ Added Document Engine capability as designed in Phase 3P addendum
- ✅ Unified document systems to eliminate technical debt (Phase 21)
- ✅ Maintained governance rules and hard boundaries
- ✅ Integrated seamlessly without breaking existing PPAP workflow

**Next sections provide detailed clarification of current system state.**

---

## Document Purpose

This document is the **implementation-grade source of truth** for the EMIP-PPAP system. It defines:

- **System identity and operating philosophy**
- **Workflow architecture and boundaries**
- **State machine truth model**
- **Role architecture and authority**
- **Validation and document systems**
- **Governance rules for future implementation**
- **Phased execution roadmap**

**This document is detailed enough that a repository agent can reliably execute future build chunks by consulting this plan directly.**

---

## Core System Identity

### What EMIP-PPAP IS

**EMIP-PPAP is a controlled execution system for PPAP intake, readiness validation, acknowledgement, build execution, submission package assembly, and closeout.**

It is **NOT** a passive tracker or document repository.

It is an **active workflow controller** that:
- Drives workflow progression
- Guides operators through sequential tasks
- Enforces readiness and responsibility boundaries
- Reduces ambiguity in PPAP execution
- Supports future document generation and autofill

### System Must

- **Drive workflow** (not just record it)
- **Guide operators** (not just show them options)
- **Enforce readiness** (block progression when incomplete)
- **Enforce responsibility boundaries** (coordinator vs engineer authority)
- **Reduce ambiguity** (one active task at a time when possible)
- **Support future document intelligence** (template generation, autofill)

### What EMIP-PPAP is NOT

- ❌ NOT a document storage system (that's SharePoint/drives)
- ❌ NOT a passive checklist tool
- ❌ NOT a flexible "do anything in any order" system
- ❌ NOT primarily a reporting tool (reporting is secondary to execution)
- ❌ NOT separate systems for different roles (one workflow, role-aware views)

---

## Single Source of Truth Architecture

### The Truth Model

**`ppap.status` is the ONLY workflow truth.**

Everything else derives from status:
- Workflow progress indicator
- Active phase
- Action bar controls
- Validation editability
- Submission readiness
- Role-appropriate UI rendering

### Hard Rules (MUST NEVER BE VIOLATED)

1. **No direct status writes**
   - All status updates MUST go through `updatePPAPState()`
   - Direct DB writes to `ppap_records.status` are PROHIBITED
   - Direct mutations bypassing state machine are PROHIBITED

2. **No UI-only phase mutation**
   - Phases are derived from status
   - UI cannot maintain separate phase state
   - React state cannot override database status

3. **No legacy `workflow_phase` control**
   - The `workflow_phase` column is DEPRECATED
   - All new code must use `status` field
   - `updateWorkflowPhase()` is DISABLED

4. **State-driven rendering**
   - UI must render based on `ppap.status`
   - Conditional visibility driven by status
   - Action availability driven by status

5. **All transitions logged**
   - Every status change must log an event
   - Event must include from/to status
   - Event must include actor and role
   - Stack traces logged for debugging

### Implementation Enforcement

```typescript
// CORRECT: All status updates go through state machine
await updatePPAPState(
  ppapId,
  'READY_TO_ACKNOWLEDGE',
  currentUser.id,
  currentUser.role
);

// WRONG: Direct status write (PROHIBITED)
await supabase
  .from('ppap_records')
  .update({ status: 'ACKNOWLEDGED' })
  .eq('id', ppapId);

// WRONG: Bypassing state machine (PROHIBITED)
await updatePPAP(ppapId, { status: 'ACKNOWLEDGED' });
```

**Guards in place:**
- `updatePPAP()` throws error if `input.status` is provided
- `updateWorkflowPhase()` throws error (function disabled)
- Trace logging identifies all state write sources
- Backward transition guard prevents invalid reversions

---

## High-Level Process Model (5 Layers)

EMIP-PPAP workflow is structured into 5 distinct layers that separate concerns and enforce operational boundaries.

### Layer 1: Intake / Coordinator Layer

**Purpose:** Receive and structure incoming PPAP work.

**Owner:** Coordinator

**Key Responsibilities:**
- Notification received (Reliance, email, PO)
- Download Reliance/customer packet
- Create SharePoint folder structure
- Upload customer-supplied documents
- Create PPAP record in system
- Log 48-hour acknowledgement clock start
- Assign engineer to PPAP
- Prepare tracker row / initial metadata
- Set initial context (customer, part, revision, etc.)

**Typical Actions:**
- Manual data entry from customer notification
- File download and organization
- Initial triage and assignment
- Acknowledgement deadline tracking

**System Intent:**
Coordinator owns intake orchestration. This is **not** a shared responsibility. Engineers do not create their own PPAPs.

---

### Layer 2: Pre-Acknowledgement Readiness Layer

**Purpose:** Validate understanding, build feasibility, and package completeness before formal acknowledgement.

**Owner:** Assigned Engineer

**Critical Clarification:**
**This is NOT a document upload phase.**
**This is a readiness validation phase.**

The system validates that the engineer **understands** what is being requested and that the organization is **ready** to acknowledge the PPAP commitment.

**Key Validation Categories:**

**1. Drawing / Document Alignment**
- Customer drawing vs internal record alignment verified
- Engineering change notes reviewed
- Revision level confirmed
- Drawing package completeness validated

**2. Commercial / Order Verification**
- PO number confirmed
- Pricing validated
- Quantity verified
- PPAP level identified (Level 1-5)

**3. Package Completeness**
- PSW presence confirmed
- Reliance attachments reviewed
- Customer-supplied documents reviewed
- Change notes / discrepancy list reviewed

**4. BOM Alignment** (see BOM Model section)
- Customer BOM vs Visual BOM comparison
- Component completeness verified
- Realistic buildability confirmed

**5. Build Site Determination** (see Build Site section)
- Routing determined (Warner Robins vs Ball Ground)
- Plant capacity confirmed
- Tooling location verified

**6. Tooling Availability**
- Tooling status confirmed (ordered, received, validated)
- Tool location identified
- Tool condition assessed

**7. Material Availability**
- Component availability checked
- Lead time risks identified
- Stock sanity validated

**8. Discrepancy Resolution**
- Customer vs internal discrepancies logged
- Resolution plan defined
- Outstanding issues documented

**Ordered Validation Sequence (as of Phase 3F.13):**
1. Drawing Verification
2. BOM Review / Alignment
3. Tooling Validation
4. Material Availability Check
5. PSW Presence
6. Discrepancy Resolution

**Completion Criteria:**
- All required validations marked complete
- Engineer confirms readiness for acknowledgement
- System validates all requirements met
- Transition to READY_TO_ACKNOWLEDGE status

**System Intent:**
This layer ensures that **before we commit** to the customer, we:
- Understand what they're asking for
- Have the materials and tooling to build it
- Can route it to the correct plant
- Have resolved any discrepancies

---

### Layer 3: Acknowledgement Gate (CONTROL POINT)

**Purpose:** Formal decision point where organization commits to PPAP execution.

**Owner:** Coordinator (or Admin)

**Authority:** ONLY Coordinator and Admin roles can acknowledge

**Acknowledgement Means:**
- PPAP has been reviewed by engineering
- Pre-ack readiness is complete
- Package is accepted for execution / production validation
- Organization commits to customer timeline

**System Actions on Acknowledgement:**
- Lock all pre-ack validations (permanent read-only)
- Unlock post-ack execution phases
- Log ACKNOWLEDGEMENT_RECEIVED event
- Snapshot pre-ack state for audit
- Start acknowledgement clock (if applicable)

**Critical Rule:**
**Engineers CANNOT acknowledge PPAPs.**

This is a **coordinator-only authority** that enforces separation between execution (engineer) and commitment (coordinator).

**System Intent:**
The acknowledgement gate is a **hard control point**. It represents organizational commitment, not just individual engineer readiness.

---

### Layer 4: Post-Acknowledgement Build Layer

**Purpose:** Create engineering documentation, perform build-related preparation, and complete first-article-related work.

**Owner:** Assigned Engineer

**Key Work Categories:**

**1. Engineering Documentation Creation**
- Engineering drawings
- Ballooned drawings (markup annotations)
- Process flow diagrams
- Work instructions

**2. Traveler / Build Package Release**
- Traveler creation
- Routing finalization
- Bill of materials finalization

**3. Build / Kit Preparation**
- Component kitting
- Material staging
- Tooling setup

**4. First Article Inspection**
- Dimensional inspection (FAIR)
- Measurement data collection
- GD&T verification

**5. Document Package Assembly**
- PSW completion
- Control plan finalization
- FMEA documentation
- Capability studies
- Material certifications

**Document Categories (see Document System section):**
- REQUIRED documents (9)
- CONDITIONAL documents (2+)

**Completion Criteria:**
- All required documents uploaded or created
- All post-ack validations complete
- Engineer marks ready for submission
- System validates completeness

**System Intent:**
This layer represents **execution and validation**. The engineer is building the first article, collecting data, and assembling the documentation package.

---

### Layer 5: Submission / Closeout Layer

**Purpose:** Assemble final package, upload finalized documentation, update external systems, and close PPAP.

**Owner:** Coordinator

**Key Workflow:**

**1. Package Review**
- Coordinator reviews completeness
- Validates all required documents present
- Checks for obvious errors or omissions

**2. Package Assembly**
- Collect all finalized documents
- Generate submission package (PDF, ZIP, etc.)
- Organize per customer requirements

**3. Upload to External Systems**
- Upload to SharePoint (customer folder)
- Upload to Reliance (if applicable)
- Upload to Visual (if applicable)
- Update external tracker

**4. Customer Submission**
- Submit package to customer
- Log submission date and method
- Track customer response

**5. PPAP Closure**
- Customer approval logged
- PPAP marked complete
- Archive for future reference

**Completion Criteria:**
- Package submitted to customer
- Customer response logged
- PPAP closed or reopened based on outcome

**System Intent:**
Coordinator owns **final delivery**. This is not engineer responsibility.

---

## Pre-Ack / Post-Ack Boundary

### Foundational Design Rule

**The pre-ack / post-ack boundary is a FOUNDATIONAL DESIGN RULE that must be preserved in all future implementation.**

### Boundary Definition

**Pre-Acknowledgement:**
- Validation
- Readiness assessment
- Comparison (customer vs internal)
- Feasibility analysis
- Discrepancy resolution
- **NO DOCUMENT CREATION** (validation only)

**Post-Acknowledgement:**
- Execution
- Document creation
- Physical first article
- Package assembly
- Submission preparation

### Why This Boundary Exists

**Pre-ack answers:** "Can we do this?"
**Post-ack executes:** "Do this."

Pre-ack is about **confirming understanding and readiness**.
Post-ack is about **performing the work**.

### Enforcement

- Pre-ack validations lock on acknowledgement (permanent read-only)
- Post-ack work cannot begin until acknowledgement gate passed
- UI must clearly distinguish pre-ack from post-ack sections
- System must prevent cross-boundary mutations

---

## BOM Model (Comparison Workflow)

### Critical Clarification

**BOM handling is NOT a single upload item.**
**It is a comparison workflow.**

### BOM Types

The system must distinguish between:

1. **Customer / Reliance BOM**
   - Provided by customer
   - Defines customer's understanding of the assembly
   - May be incomplete or outdated

2. **Internal / Visual BOM**
   - Maintained in Visual (ERP system)
   - Defines actual manufacturing build
   - Source of truth for component list

3. **BOM Alignment Verification**
   - Comparison between customer and internal BOMs
   - Identifies discrepancies
   - Validates buildability

### BOM Review Validation (Pre-Ack)

The "BOM Review" validation in pre-ack specifically validates:

- **Customer BOM vs Visual BOM alignment**
- **Component completeness** (all required parts listed)
- **Realistic buildability** (can we actually build this?)
- **Routing / build site implications** (does this affect plant selection?)
- **Part availability / stock sanity** (do we have or can we get the components?)

### System Intent

BOM review is not "did you upload a BOM file?"
BOM review is "did you verify that what the customer thinks we're building matches what we can actually build?"

### Future Implementation

System should support:
- Side-by-side BOM comparison view
- Discrepancy highlighting
- Component availability lookup
- Visual BOM integration

---

## Build Site Determination

### Routing Rule (Current Operating Logic)

**Ball Ground:**
- Component contains >6 AWG wire
- Component requires 5-ton press
- Specialized tooling located at Ball Ground

**Warner Robins:**
- Majority of standard work
- Default routing for most assemblies
- General manufacturing capacity

**Important Note:**
This is a **business rule subject to confirmation/refinement**. It is documented here as **current operational guidance**, not as a fixed system constraint.

### Build Site Determination Process

Build site determination happens during **pre-acknowledgement** as part of readiness validation.

**Factors considered:**
- Component complexity (wire gauge, press requirements)
- Tooling location
- Plant capacity and workload
- Specialized capability requirements

**Ownership:**
- Engineer identifies routing requirements
- Coordinator confirms and sets plant in PPAP record

### System Intent

Build site must be determined **before acknowledgement** because:
- It affects tooling availability validation
- It affects material staging
- It affects traveler routing
- It affects coordinator assignment (potentially)

---

## Guided Validation Flow (Phase 3F.13)

### Design Philosophy

**The pre-ack readiness layer is no longer a passive checklist.**
**It is a guided workflow with progressive gating.**

### Progressive Gating Principles

1. **One active task at a time** (when possible)
2. **Completed tasks clearly marked**
3. **Future tasks visually locked or de-emphasized**
4. **Flexible override for already-completed work**
5. **Explicit "Current Step" and "Next Step" guidance**

### Ordered Validation Sequence (Pre-Ack)

**The system enforces this sequence:**

1. Drawing Verification
2. BOM Review / Alignment
3. Tooling Validation
4. Material Availability Check
5. PSW Presence
6. Discrepancy Resolution

### UI States (Phase 3F.13)

**ACTIVE:**
- Blue border (border-2 border-blue-500)
- Shadow effect (shadow-md)
- 👉 pointing finger icon
- "(ACTIVE)" label
- Blue text color
- Editable

**COMPLETE:**
- Green border (border border-green-300)
- Green background (bg-green-50)
- ✓ checkmark icon
- Green text
- Editable (override flexibility - users can go back and update)

**LOCKED:**
- Gray border (border border-gray-200)
- Reduced opacity (opacity-50)
- ☐ empty checkbox icon
- "(LOCKED)" label
- Gray text
- Not editable
- Tooltip: "Complete previous step first"

### Next Action Panel

System displays:
- **Current Step**: Name of active validation
- **Next Step**: Name of next validation in sequence
- **Completion Message**: When all validations complete

### Override Flexibility (IMPORTANT)

**Users CAN edit already-completed validations.**

Locked state only applies to:
- Incomplete validations
- Non-active validations
- Required validations

**Rationale:**
- Prevents unnecessary blocking
- Allows corrections to completed work
- Flexible workflow, not rigid

### System Intent

Guided validation flow:
- **Reduces cognitive overload** (user knows what to do next)
- **Improves onboarding** (new engineers guided through process)
- **Makes operator action obvious** (current step highlighted)
- **Preserves flexibility** (experienced users can skip ahead if work already done)

---

## Document Action System (Phase 3F.14)

### Design Philosophy

**Documents are not just listed.**
**Each document is an actionable unit.**

### Document Action Model

```typescript
type DocumentAction = 'upload' | 'create';

interface DocumentItem {
  id: string;
  name: string;
  requirement_level: 'REQUIRED' | 'CONDITIONAL';
  status: 'missing' | 'ready';
  actions: DocumentAction[];
  file?: {
    name: string;
    uploaded_at: string;
  };
}
```

### Actions Array (Not Hardcoded)

Each document defines available actions via **actions array**:

```typescript
{ 
  id: 'ballooned_drawing', 
  name: 'Ballooned Drawing', 
  actions: ['upload', 'create'] 
}
```

**System MUST NOT hardcode** "upload only" or "create only" logic.
UI rendering is driven by the **actions array**.

### Current Action Configuration

**Ballooned Drawing:**
- Actions: `['upload', 'create']`
- Only document with Create capability (as of Phase 3F.14)
- Create button is placeholder for future template engine

**All Other Documents:**
- Actions: `['upload']`
- Upload-first approach
- Future phases will add Create to more documents

### Document Card Layout

Each document renders as a card with:

1. **Title Row**
   - Document name
   - Requirement badge (REQUIRED / CONDITIONAL)
   - Status badge (Ready / Missing)

2. **File Info** (if uploaded)
   - File name
   - Uploaded timestamp

3. **Actions Row**
   - Upload button (if 'upload' in actions)
   - Create button (if 'create' in actions)

4. **Dropzone**
   - Always visible when upload allowed
   - Drag & drop support
   - Click to upload

5. **Error Display**
   - Per-document error messages

### Upload Behavior

**After upload:**
- Status updates to 'ready'
- File name displayed
- Uploaded timestamp shown
- Button changes to "Replace File"

**Logging:**
```javascript
console.log('📄 DOCUMENT UPLOADED', {
  documentType: 'ballooned_drawing',
  fileName: 'drawing_v2.pdf',
  timestamp: '2026-03-25T19:00:00.000Z'
});
```

### Create Button Behavior (IMPORTANT)

**Current implementation:**
- Button exists
- On click → console log ONLY
- NO modal, NO navigation

```javascript
console.log('🛠 CREATE DOCUMENT', {
  documentType: 'ballooned_drawing'
});
```

**Purpose:**
Placeholder for future template engine.
System is **ready** for template generation without refactor.

### System Intent

Document action system:
- Makes each document independently actionable
- Supports future template-based generation
- Extensible action model (can add 'view', 'download', 'edit', etc.)
- Not hardcoded (actions array drives UI)

---

## REQUIRED / CONDITIONAL / OPTIONAL Document Model

### Document Classification

Post-ack documents are classified into three categories:

### REQUIRED Documents (9)

**These MUST be present for submission:**

1. **PSW** (Production Part Submission Warrant)
2. **Ballooned Drawing**
3. **FAIR** (First Article Inspection Report)
4. **Control Plan**
5. **PFMEA** (Process Failure Mode Effects Analysis)
6. **DFMEA** (Design Failure Mode Effects Analysis)
7. **Dimensional Results**
8. **Material Certifications**
9. **MSA** (Measurement System Analysis)

**Badge:** Red (`bg-red-100 text-red-800`)
**Enforcement:** System blocks submission if missing

### CONDITIONAL Documents (2+)

**Required based on part characteristics or customer requirements:**

1. **Packaging Approval** (if special packaging required)
2. **Appearance Approval** (if cosmetic requirements apply)
3. **Performance Testing** (if functional requirements apply)
4. **Barcode Standards** (if barcode/labeling required)
5. **Assembly Standards** (if assembly-specific requirements)

**Badge:** Yellow (`bg-yellow-100 text-yellow-800`)
**Enforcement:** System prompts but may not strictly block

### OPTIONAL Documents

**Nice to have but not required:**
- Additional test data
- Photos
- Supplemental documentation

**Badge:** Gray or no badge
**Enforcement:** No blocking

### Important Note

**These classifications are CURRENT WORKING ASSUMPTIONS pending stakeholder confirmation.**

The system must be flexible enough to:
- Add new documents
- Reclassify documents (REQUIRED → CONDITIONAL, etc.)
- Customer-specific document requirements (Trane vs Rheem)

---

## Document Intelligence / Template Strategy (FUTURE)

### Critical Architectural Direction

**The build plan locks in the following future strategy:**

**Documents should not only be uploaded.**
**They should eventually be generated, prefilled, and assembled from known system data.**

### Document Evolution Path

**Phase 1 (Current):** Upload-first
- All documents uploaded by users
- No template support (except Create placeholder)

**Phase 2 (Future):** Template-based generation
- System provides templates
- User fills in fields
- System pre-populates known fields

**Phase 3 (Future):** Auto-fill and assembly
- System generates documents from data
- User reviews and approves
- Minimal manual data entry

### Template Model

Each document should be viewed as having:

1. **Template Structure**
   - Document format (PDF, Excel, etc.)
   - Required sections
   - Standard layout

2. **Known Auto-Fill Fields**
   - PPAP number
   - Part number
   - Customer name
   - Revision level
   - Plant location
   - Dates
   - Engineer / coordinator names
   - BOM-derived fields
   - Measurement data (from FAIR)
   - Package metadata

3. **User-Entered Fields**
   - Narrative descriptions
   - Analysis results
   - Decisions and justifications
   - Custom notes

### Known Data for Auto-Fill (Examples)

**PPAP Record:**
- PPAP number
- Part number
- Customer
- Revision
- Request date
- Acknowledgement date

**Assignment:**
- Engineer name
- Coordinator name
- Plant location

**BOM Data:**
- Component list
- Material specifications

**Measurement Data:**
- Dimensional results (from FAIR)
- Capability data (Cpk, Ppk)

### Document-Specific Template Examples

**PSW (Production Part Submission Warrant):**
- Auto-fill: Part number, revision, customer, supplier info, dates
- User-entry: Submission reason, change description

**Control Plan:**
- Auto-fill: Part number, process steps from routing, measurement specs
- User-entry: Control methods, reaction plans

**FAIR (First Article Inspection Report):**
- Auto-fill: Part number, drawing reference, measurement specs from drawing
- User-entry: Actual measurements, pass/fail decisions

**FMEA (DFMEA / PFMEA):**
- Auto-fill: Part number, process steps, component list
- User-entry: Failure modes, effects, controls, RPN

### System Intent

**Future implementation should support:**
- Upload-first now
- Template/generation later
- **WITHOUT refactoring the document action model**

The actions array already supports this:
- `'upload'` = user provides file
- `'create'` = system generates from template

---

## Active Work Zone / Operator Clarity

### UI Philosophy

**The system must visually distinguish:**

- **ACTIVE work** (what I should be doing now)
- **COMPLETED work** (what I've already done)
- **UPCOMING work** (what I'll do next)
- **LOCKED / future work** (what I can't do yet)
- **INFORMATIONAL context** (background data, not actionable)

### Critical Rule

**If data is shown but not actionable, its visual treatment must make that obvious.**

### Visual Treatment Principles

**ACTIVE Section:**
- High contrast (blue, bold)
- Prominent placement
- Clear "You Are Here" indicator
- Action buttons enabled

**COMPLETED Section:**
- Green indication
- Collapsed or secondary placement
- Read-only or edit-with-confirmation
- Summary view

**UPCOMING Section:**
- Gray or muted colors
- Preview of next steps
- Disabled controls
- "Coming next" indication

**LOCKED Section:**
- Very muted (gray, low opacity)
- Clear lock icon or "LOCKED" label
- Tooltip explaining why locked
- No interaction allowed

**INFORMATIONAL Section:**
- Neutral colors
- Minimal visual weight
- Reference data only
- No call-to-action

### Application Examples

**Validation Lists:**
- Active validation: Blue border, shadow, highlighted
- Complete validation: Green background, checkmark
- Locked validation: Gray, reduced opacity, tooltip

**Documentation Lists:**
- Active document: Emphasized card
- Complete document: Green badge, collapsed
- Missing document: Red badge, upload prominent

**Submission Package:**
- Pre-submission: Actions enabled, clear next step
- Post-submission: Read-only, review mode only

**Review Controls:**
- Coordinator in review state: Controls enabled
- Engineer after submit: Controls disabled, "Awaiting review" message

### "You Are Here" Indicators

System must provide:
- **Current task banner** (top of page or section)
- **Next task visibility** (preview of next step)
- **Active section emphasis** (visual hierarchy)
- **Reduced visual competition** (de-emphasize non-active sections)

### System Intent

Clear operator clarity:
- **Reduces decision paralysis** (one obvious next action)
- **Reduces errors** (can't click locked items)
- **Improves efficiency** (no time wasted figuring out what to do)
- **Better onboarding** (new users immediately see current task)

---

## Role Model / Perspective Model

### Role Architecture

**EMIP-PPAP defines 4 fixed roles:**

1. **Admin** - Supervisory / override role
2. **Coordinator** - Process controller
3. **Engineer** - Execution role
4. **Viewer** - Read-only oversight

### Admin Role

**Responsibilities:**
- Full visibility across all PPAPs
- Reassignment authority
- Override authority
- Can perform all coordinator actions
- Can acknowledge PPAPs
- Can make exceptions

**Intent:**
Admin is **NOT the primary operator**.
Admin is an **escalation and override authority** for exceptional situations.

**Authority Level:** Unlimited (within system constraints)

### Coordinator Role

**Responsibilities:**
- PPAP intake (create PPAP records)
- Engineer assignment
- Plant assignment
- **Acknowledgement authority** (primary)
- Review decision authority (approve/reject at gates)
- Final submission to customer
- Closeout / archival

**Critical Authority:**
**ONLY Coordinator and Admin can acknowledge PPAPs.**

This is a **hard gate** separating pre-ack from post-ack work.

**Intent:**
Coordinator is the **primary workflow operator**.
Coordinator drives PPAP progression and controls gates.

**Authority Level:** Workflow control + assignment + acknowledgement gate

### Engineer Role

**Responsibilities:**
- Pre-ack readiness validation
- Post-ack document creation
- Validation completion
- Build execution
- Package preparation
- Mark work complete for coordinator review

**Restrictions:**
- **Cannot assign work** (no assignment authority)
- **Cannot acknowledge PPAPs** (coordinator-only gate)
- **Cannot make final review decisions** (coordinator authority)
- **Cannot override workflow state** (state machine enforced)

**Intent:**
Engineer **executes work** but does not control workflow.
Engineers operate within phases and states assigned by coordinator.

**Authority Level:** Work execution only (no workflow control)

### Viewer Role

**Responsibilities:**
- Full visibility into all PPAPs
- Can view documents and validation status
- Can view workflow history and events
- Can generate reports

**Restrictions:**
- **No edit permissions** (read-only)
- **No workflow control** (cannot transition states)
- **No document uploads** (cannot modify data)

**Intent:**
Used for **leadership visibility and reporting**.
Oversight without operational control.

**Authority Level:** Read-only (no write permissions)

### Critical Rule: One Workflow, Different Views

**The system is ONE workflow, not separate systems for different roles.**

**Same state machine, same data, different role-aware views:**
- Coordinator sees intake queue, assignment controls, acknowledgement buttons
- Engineer sees my work, validation tasks, document uploads
- Viewer sees everything but cannot modify

**DO NOT describe this as:**
- "Coordinator system" vs "Engineer system"
- "Two different workflows"
- "Separate applications"

**DO describe this as:**
- "Role-aware views of same workflow"
- "Different emphasis based on role"
- "Same PPAP, different responsibilities"

---

## Review Gate Authority (Phase 3F.11)

### Review Decision Control

**Review decision controls are restricted to coordinator/admin authority.**

**Allowed Roles:**
- Coordinator (primary decision maker)
- Admin (override authority)

**Prohibited:**
- Engineer (can submit for review, cannot approve/reject)
- Viewer (read-only)

### Review Gates in Workflow

**Pre-Ack Review Gate:**
- Engineer marks pre-ack work complete
- Transitions to IN_REVIEW status
- **Coordinator reviews** and either:
  - Approves → READY_TO_ACKNOWLEDGE
  - Requests changes → Returns to PRE_ACK_IN_PROGRESS

**Post-Ack Review Gate:**
- Engineer marks post-ack work complete
- Transitions to IN_VALIDATION status
- **Coordinator reviews** and either:
  - Approves → READY_FOR_SUBMISSION
  - Requests changes → Returns to ACKNOWLEDGED

### UI Implementation

**Coordinator View:**
- Review form with approve/reject controls
- Comment/feedback field
- Clear decision buttons

**Engineer View:**
- Read-only status panel
- "Awaiting coordinator review" message
- No decision controls (grayed out or hidden)

### Rationale

Review authority separation ensures:
- **Quality oversight** (second pair of eyes)
- **Accountability** (clear responsibility for decisions)
- **Workflow integrity** (engineers cannot self-approve)

### Future Policy Consideration

**Current policy: Coordinator-only review authority.**

**Note:** This may change in future if business requirements evolve.
System is designed to be flexible (role-based guards can be updated).

---

## Governance / Implementation Rules

### Hard Enforcement Rules

**ALL FUTURE IMPLEMENTATION MUST FOLLOW THESE RULES:**

#### Rule 1: All Status Writes Through State Machine

**REQUIRED:**
```typescript
await updatePPAPState(ppapId, newStatus, userId, userRole);
```

**PROHIBITED:**
```typescript
// Direct DB write
await supabase
  .from('ppap_records')
  .update({ status: newStatus })
  .eq('id', ppapId);

// Bypassing state machine
await updatePPAP(ppapId, { status: newStatus });
```

**Enforcement:**
- `updatePPAP()` throws error if `status` field present
- `updateWorkflowPhase()` throws error (disabled function)
- All status changes logged with stack trace

#### Rule 2: Workflow Progression Must Be State-Driven

**UI rendering MUST be based on `ppap.status`.**

**CORRECT:**
```typescript
if (ppap.status === 'PRE_ACK_IN_PROGRESS') {
  return <PreAckValidationPanel />;
}
```

**WRONG:**
```typescript
if (currentPhase === 'validation') {
  return <PreAckValidationPanel />;
}
```

**Rationale:** React state is ephemeral. Database status is truth.

#### Rule 3: Bootstrap Against Planning Documents

**ALL FUTURE PROMPTS should reference:**
- `docs/BUILD_PLAN.md` (this document)
- `docs/BUILD_LEDGER.md` (implementation history)
- `docs/DECISION_REGISTER.md` (architectural decisions)

**Before implementing any change:**
1. Read current architecture from BUILD_PLAN
2. Validate alignment with current direction
3. Check BUILD_LEDGER for recent changes
4. Check DECISION_REGISTER for relevant decisions

#### Rule 4: Preserve Pre-Ack / Post-Ack Boundary

**The boundary is a foundational design rule.**

**Pre-ack:**
- Validation / readiness checks
- No document creation

**Post-ack:**
- Execution / document creation
- No readiness validation

**Future implementation MUST NOT blur this boundary.**

#### Rule 5: Prefer Guided Workflow Over Passive Checklists

**Future phases should favor:**
- Sequential guided flow
- One active task emphasis
- Progressive gating
- Clear "current step" indication

**Over:**
- Flat unordered checklists
- "Do anything in any order" approach
- All items equally emphasized

**Exception:** Override flexibility for experienced users is acceptable.

#### Rule 6: Preserve Upload/Create/Generate Extensibility

**Future document features MUST preserve action model:**
- Documents have actions array
- Actions drive UI rendering
- System supports upload, create, and future generate

**DO NOT hardcode:**
- "Upload only" logic
- Separate create flows divorced from document cards
- Document-specific UI that breaks the action model

---

## Bootstrap Protocol for Future Implementation

### Required Reading Before ANY Change

1. **Read BUILD_PLAN.md** (this document)
   - Understand system identity
   - Understand workflow architecture
   - Understand governance rules

2. **Read BUILD_LEDGER.md**
   - Check recent implementation history
   - Identify current phase
   - Check for related recent work

3. **Read DECISION_REGISTER.md**
   - Check for architectural decisions
   - Check for policy decisions
   - Understand rationale for current design

### Validation Checklist

Before implementing:

**✓ Changes align with current architecture**
- Respects state machine truth model
- Preserves pre-ack / post-ack boundary
- Follows role authority model
- Maintains guided workflow direction

**✓ No duplicate patterns**
- No reimplementation of existing logic
- No competing state management
- No duplicate data stores

**✓ No legacy patterns reintroduced**
- No `workflow_phase` mutations
- No direct status writes
- No UI-only state

**✓ State machine remains single source of truth**
- All workflow logic derived from `ppap.status`
- No parallel truth sources

**✓ No violations of core principles**
- State-driven rendering preserved
- No direct status writes
- Role-based workflow rules preserved
- Guided validation flow preserved
- Document action system preserved

### Post-Implementation Requirements

After implementation:

**✓ Update BUILD_LEDGER.md**
- Add detailed entry documenting change
- Include before/after state
- Document files changed
- Document impact

**✓ Update DECISION_REGISTER.md** (if applicable)
- If architecture changed, add decision entry
- If workflow logic changed, add decision entry
- Document rationale and consequences

**✓ Tag phase in commit message**
- `feat: phase 3F.X - description`
- Clear phase numbering for traceability

---

## Execution Roadmap (Phased Implementation)

### Current State (Phase 3F.15)

**Completed:**
- ✅ State machine truth model (status-driven workflow)
- ✅ Single source of truth enforcement (updatePPAPState only)
- ✅ Role-based access control (coordinator vs engineer authority)
- ✅ Guided validation workflow (progressive gating)
- ✅ Document action system (upload + create capability)
- ✅ Pre-ack validation database (persistent validations)
- ✅ Demo mode removed (real data flow enforced)

**Current Phase Focus:**
- Architectural documentation and governance
- BUILD_PLAN expansion to implementation-grade
- Planning for next implementation chunks

---

### Near-Term Stabilization (Phase 3G)

**Objective:** Eliminate remaining legacy patterns, fix React/render issues, validate end-to-end flow

**Tasks:**
1. **Eliminate Legacy Workflow Paths**
   - Remove any remaining `workflow_phase` references
   - Ensure all components use status-driven rendering
   - Audit for direct status writes (should be zero)

2. **Fix React/Render Stability**
   - Resolve any hydration errors
   - Fix state synchronization issues
   - Optimize re-render performance

3. **Validate Phase Transitions End-to-End**
   - Test full PPAP lifecycle (NEW → COMPLETE)
   - Verify acknowledgement gate locking
   - Verify review gate authority enforcement
   - Test rejection loop (REJECTED → IN_VALIDATION)

4. **Confirm Status Persistence**
   - Verify status persists across page reloads
   - Verify event logging for all transitions
   - Verify trace logging identifies all sources

**Success Criteria:**
- Zero legacy workflow patterns remaining
- Zero React hydration errors
- Full PPAP lifecycle tested and working
- All status transitions logged

---

### Workflow Clarity Enhancement (Phase 3H)

**Objective:** Improve active work zone clarity, role-based emphasis, hide irrelevant sections

**Tasks:**
1. **Active Work Zone Redesign**
   - Prominent "You Are Here" indicator
   - Current task banner at top of page
   - Active section emphasized (blue, bold)
   - Completed sections collapsed or de-emphasized

2. **Role-Based Emphasis**
   - Coordinator view emphasizes intake, assignment, gates
   - Engineer view emphasizes validation tasks, document work
   - Viewer view emphasizes read-only reporting

3. **Hide/De-Emphasize Irrelevant Sections**
   - Pre-ack sections hidden after acknowledgement (or collapsed)
   - Post-ack sections hidden before acknowledgement
   - Locked sections clearly marked and non-interactive

4. **Cleaner Current Task Presentation**
   - Single clear next action highlighted
   - Reduced visual competition from non-active elements
   - Progress indicator shows overall completion

**Success Criteria:**
- User always knows current task
- Minimal cognitive load (one clear action)
- Role-appropriate views implemented
- Irrelevant sections hidden or de-emphasized

---

### Document System Evolution (Phase 3I)

**Objective:** Inline upload/create cards, document status persistence, template placeholders

**Tasks:**
1. **Inline Upload/Create Cards** ✅ (Phase 3F.14 complete)
   - Document cards with inline actions
   - Upload and Create buttons per document
   - Status updates on upload

2. **Document Status Persistence**
   - Store document status in database
   - Sync status with uploaded files
   - Track document approval (if applicable)

3. **Uploads Auto-Completing Validations**
   - Link document uploads to validation completion
   - Auto-mark validation complete when required documents uploaded
   - Show validation status on document cards

4. **Template Placeholders** ✅ (Phase 3F.14 complete)
   - Create button exists for Ballooned Drawing
   - Placeholder logging for template generation
   - System ready for future template engine

5. **Future Autofill Engine (Design)**
   - Design template data model
   - Identify auto-fill fields per document
   - Design template generation API

**Success Criteria:**
- Document status persists across sessions
- Document uploads trigger validation completion
- Template placeholders ready for future engine
- Autofill design documented

---

### Validation Evolution (Phase 3J)

**Objective:** Persistent validation DB ✅, approval workflow, conditional branching, post-ack guided flow

**Tasks:**
1. **Persistent Validation Database** ✅ (Phase 3H complete)
   - Validations stored in database
   - Validation status persists
   - Validation completion tracked

2. **Approval Workflow**
   - Implement `requires_approval` flag
   - Coordinator approval for flagged validations
   - Block progression if approval required but missing

3. **Conditional Branching**
   - Conditional validations based on part type
   - Customer-specific validation requirements
   - Template-driven validation lists

4. **Stronger Post-Ack Guided Flow**
   - Extend guided workflow to post-ack phase
   - Sequential document completion flow
   - Active document indication
   - Locked future documents

**Success Criteria:**
- Approval workflow enforced
- Conditional validations working
- Post-ack guided flow implemented
- Clear progression through post-ack work

---

### Coordinator Workspace Evolution (Phase 3K)

**Objective:** Intake workspace, assignment queue, acknowledgement queue, closeout workspace

**Tasks:**
1. **Intake Workspace**
   - Dedicated view for new PPAP creation
   - Customer notification integration (Reliance, email)
   - SharePoint folder creation automation
   - Initial metadata capture

2. **Assignment Queue**
   - List of unassigned PPAPs
   - Engineer availability visibility
   - Bulk assignment capability
   - Plant assignment controls

3. **Acknowledgement Queue**
   - List of PPAPs ready for acknowledgement
   - Pre-ack readiness summary
   - Acknowledgement deadline tracking
   - Bulk acknowledgement capability

4. **Closeout Workspace**
   - List of PPAPs ready for submission
   - Package assembly tools
   - Upload to external systems (SharePoint, Reliance)
   - Customer submission tracking

**Success Criteria:**
- Coordinator has dedicated workspaces for each phase
- Queues show only relevant PPAPs
- Bulk actions available where appropriate
- External system integration working

---

### Engineer Workspace Evolution (Phase 3L)

**Objective:** My work queue, guided readiness, document execution view, submission prep flow

**Tasks:**
1. **My Work Queue**
   - List of PPAPs assigned to current user
   - Filtered by status (active, review, complete)
   - Priority sorting (overdue, due soon)
   - Quick navigation to active work

2. **Guided Readiness (Pre-Ack)**
   - Sequential validation flow ✅ (Phase 3F.13 complete)
   - Current step highlighted
   - Clear completion criteria
   - Discrepancy logging

3. **Document Execution View (Post-Ack)**
   - Document cards with inline actions ✅ (Phase 3F.14 complete)
   - Upload and Create buttons
   - Document status tracking
   - Required vs conditional indicators

4. **Submission Prep Flow**
   - Checklist of required documents
   - Validation status summary
   - Submit for review button
   - Coordinator feedback display

**Success Criteria:**
- Engineer sees only assigned PPAPs
- Guided flow reduces errors
- Document execution is streamlined
- Submission process is clear

---

### Document Intelligence Layer (Phase 3M - Future)

**Objective:** Template ingestion, field mapping, auto-fill model, generation for key documents

**Tasks:**
1. **Template Ingestion**
   - Define template format (PDF, Excel, etc.)
   - Upload template files
   - Parse template structure
   - Identify fillable fields

2. **Field Mapping**
   - Map PPAP data fields to template fields
   - Map BOM data to template fields
   - Map measurement data to template fields
   - Map user-entered fields

3. **Auto-Fill Model**
   - Auto-populate known fields
   - Leave user-entered fields blank
   - Generate document with pre-filled data
   - Allow user to review and edit

4. **Generation for Key Documents**
   - **PSW**: Auto-fill supplier info, part number, dates
   - **Control Plan**: Auto-fill process steps, measurement specs
   - **FAIR**: Auto-fill part number, drawing reference, measurement specs
   - **FMEA**: Auto-fill part number, process steps, component list

**Success Criteria:**
- Template engine can generate documents
- Auto-fill reduces manual data entry
- User review and approval workflow implemented
- Generated documents meet quality standards

---

### Integration Layer (Phase 3N - Future)

**Objective:** Reliance integration, SharePoint automation, Visual BOM integration, external tracker sync

**Tasks:**
1. **Reliance Integration**
   - API connection to Reliance
   - Auto-download customer packets
   - Auto-upload submission packages
   - Status synchronization

2. **SharePoint Automation**
   - Auto-create folder structure
   - Auto-upload documents to customer folders
   - Naming convention enforcement
   - Version control

3. **Visual BOM Integration**
   - API connection to Visual (ERP)
   - Fetch internal BOM for comparison
   - Display side-by-side with customer BOM
   - Highlight discrepancies

4. **External Tracker Sync**
   - Sync PPAP status to external tracker
   - Sync completion dates
   - Sync submission status
   - Bidirectional updates (if applicable)

**Success Criteria:**
- External systems integrated
- Manual data entry minimized
- Data flows automatically between systems
- No duplicate data entry

---

## ADDENDUM: Reusable Document Engine Architecture

**Date Added:** 2026-03-26  
**Status:** Architectural Direction - Implementation Pending  
**Phase Scope:** Phase 3P and beyond

### System Identity Evolution

**CRITICAL ARCHITECTURAL EXPANSION:**

EMIP-PPAP is evolving from a **PPAP workflow orchestration system** into a **dual-capability platform**:

1. **PPAP Workflow Orchestration** (existing)
   - Controlled execution system for PPAP lifecycle management
   - State machine-driven workflow with gates and validations
   - Role-based authority and multi-site coordination

2. **Reusable Document Generation Capability** (new)
   - Standalone document creation from BOM and templates
   - BOM ingestion, normalization, and intelligent auto-fill
   - Template-driven draft generation with user completion
   - **Used both independently AND embedded within PPAP workflow**

**This is NOT two separate products.** This is ONE system with a **shared document intelligence capability** exposed through **multiple surfaces**.

---

### Core Architectural Concept

The reusable document engine follows a **three-layer architecture**:

#### Layer 1: Core Engine / Capability Layer

**Responsibilities:**
- BOM file ingestion (upload, parse, validate)
- BOM normalization into structured internal representation
- Template / document definition registry
- Auto-fill field mapping (BOM data → template fields)
- Optional context integration (PPAP metadata, system data)
- Draft document generation with best-effort pre-fill
- Export / print / save hooks

**Critical Properties:**
- **Context-aware but not PPAP-dependent**
- Can operate with BOM alone OR with PPAP context
- No direct coupling to PPAP state machine
- Testable and reusable across surfaces

#### Layer 2: Standalone Access Surface

**Responsibilities:**
- User uploads BOM file independently
- System parses and previews BOM structure
- User selects from available supported templates
- System generates prefilled draft document
- User completes remaining required fields
- User prints, exports, or saves to local storage

**Entry Point:** Dedicated route (e.g., `/tools/document-generator`)

**Use Cases:**
- Engineer needs PSW for non-PPAP project
- Quick document generation without full PPAP workflow
- Template exploration and testing
- External supplier document requests

#### Layer 3: Embedded PPAP Access Surface

**Responsibilities:**
- Uses PPAP-linked BOM when available
- Reuses same core generation engine
- Integrates PPAP metadata (part number, dates, engineer, customer)
- Saves generated documents into PPAP context
- Respects PPAP workflow gates and permissions
- Preserves existing document execution UI

**Entry Point:** Existing PPAP detail page document cards

**Use Cases:**
- Engineer creating Control Plan during post-ack phase
- Coordinator generating PSW for submission package
- Document creation within governed PPAP workflow

---

### Canonical Design Principles

**PRINCIPLE 1: Build Once, Expose Twice**

- ONE engine implementation
- TWO access surfaces (standalone + embedded)
- ZERO duplication of parser, normalization, or template logic

**PRINCIPLE 2: Context-Aware, Not PPAP-Bound**

- Document generation accepts optional context
- Works with BOM alone (standalone mode)
- Enhances with PPAP context when available (embedded mode)
- Never assumes PPAP context exists

**PRINCIPLE 3: BOM → Normalized Data → Template → Editable Draft**

Data flow is unidirectional and explicit:
```
BOM File Input
  ↓ Parse
Structured BOM Data
  ↓ Normalize
Internal Standard Representation
  ↓ Combine with Optional Context
Enriched Data Model
  ↓ Map to Template
Field Assignments
  ↓ Generate
Editable Draft Document
  ↓ User Review/Complete
Final Document
```

**PRINCIPLE 4: No Direct Coupling to PPAP State Machine**

- Document engine MUST NOT read `ppap.status` directly
- PPAP workflow layer provides context as explicit parameters
- Engine remains state-agnostic, operates on provided data

**PRINCIPLE 5: PPAP Remains Workflow Orchestration, Engine Remains Document Intelligence**

- PPAP components: Control workflow, enforce gates, manage permissions
- Document engine: Parse BOM, map fields, generate drafts
- Clear separation of concerns, no architectural blurring

**PRINCIPLE 6: No False Affordances**

- Only expose "Create" flows when template is truly supported
- Show clear "Template not yet available" for unsupported documents
- Never promise capability that doesn't exist

---

### Recommended Module Boundaries

**Recommended Structure:**

```
src/features/
  documentEngine/               # NEW - Reusable document capability
    core/
      bomParser.ts              # BOM file parsing
      bomNormalizer.ts          # Normalize to internal standard
      templateRegistry.ts       # Available template definitions
      fieldMapper.ts            # Data → template field mapping
      draftGenerator.ts         # Generate editable drafts
    templates/
      pswTemplate.ts            # PSW template definition + logic
      controlPlanTemplate.ts    # Control Plan template
      fairTemplate.ts           # FAIR template
      [additional templates]
    standalone/
      DocumentGeneratorPage.tsx # Standalone UI surface
      BOMUploadForm.tsx         # BOM upload + preview
      TemplateSelector.tsx      # Choose template
      DraftEditor.tsx           # Complete and export
    embedded/
      PPAPDocumentGenerator.tsx # PPAP-integrated wrapper
      [integrations with existing PPAP components]
    types/
      bomTypes.ts               # BOM data structures
      templateTypes.ts          # Template interfaces
      draftTypes.ts             # Draft document types
      
  ppap/                         # EXISTING - PPAP workflow
    [existing structure preserved]
    # Integration points:
    # - DocumentationForm imports from documentEngine/embedded
    # - Control panel imports from documentEngine/embedded
```

**Interface Contracts:**

```typescript
// Core engine accepts optional context
interface DocumentGenerationRequest {
  bom: StructuredBOM;              // Required
  templateId: string;              // Required
  ppapContext?: PPAPContext;       // Optional - only for embedded use
  userContext?: UserContext;       // Optional - for all uses
}

interface PPAPContext {
  ppapId: string;
  ppapNumber: string;
  partNumber: string;
  customerName: string;
  plant: string;
  engineer: string;
  acknowledgedDate?: string;
  // NO ppap.status - workflow state not exposed to engine
}
```

---

### Data Flow Pipeline

**Stage 1: BOM Acquisition**

- **Standalone mode:** User uploads BOM file
- **PPAP-embedded mode:** System retrieves BOM from PPAP context or prompts upload
- **Output:** Raw BOM file (Excel, CSV, PDF, etc.)

**Stage 2: BOM Parsing**

- System identifies file format
- Extracts tabular data (part numbers, descriptions, quantities, specs)
- Handles format variations (customer-specific layouts)
- **Output:** Raw parsed data structure

**Stage 3: BOM Normalization**

- Converts parsed data into internal standard representation
- Maps vendor-specific field names to standard schema
- Validates required fields present
- Flags anomalies or missing data
- **Output:** `StructuredBOM` object

**Stage 4: Context Enrichment (Optional)**

- Combines normalized BOM with PPAP metadata (if available)
- Adds system-known values (dates, engineer, plant)
- Merges user-provided context
- **Output:** `EnrichedDataModel`

**Stage 5: Template Selection**

- User selects template from registry of supported documents
- System validates template compatibility with available data
- Identifies fillable fields vs. user-required fields
- **Output:** Selected `TemplateDefinition`

**Stage 6: Field Mapping**

- Maps enriched data to template fields
- Auto-fills fields where data exists with confidence
- Leaves uncertain fields blank for user completion
- Marks required vs. optional fields
- **Output:** `FieldAssignments`

**Stage 7: Draft Generation**

- Generates editable document with pre-filled values
- Renders in appropriate format (PDF form, Excel, web form)
- Highlights user-required fields
- Provides field-level help text
- **Output:** Editable draft document

**Stage 8: User Completion**

- User reviews auto-filled values
- User completes remaining required fields
- User adds narrative, analysis, engineering judgment
- System validates completeness
- **Output:** Completed document draft

**Stage 9: Save/Export**

- **Standalone mode:** Export to PDF, Excel, or save locally
- **PPAP-embedded mode:** Save to PPAP document context, log event
- Both modes support print-ready output

**CRITICAL RULE:** System prefills ONLY what it knows with confidence. Uncertain fields remain blank for user validation.

---

### Product Modes

#### Mode 1: Standalone Document Generation

**Entry Point:** `/tools/document-generator` (or similar dedicated route)

**User Flow:**
1. User navigates to standalone document generator
2. User uploads BOM file
3. System parses and previews BOM structure
4. System shows compatible templates (PSW, Control Plan, etc.)
5. User selects template
6. System generates draft with auto-filled fields
7. User completes remaining required fields
8. User exports to PDF or prints

**Context Available:**
- BOM data (user-uploaded)
- User identity (current logged-in user)
- No PPAP context

**Save/Export Behavior:**
- No PPAP linkage
- Export to file or print directly
- Optional: Save to user's document library for reuse

**Permissions:**
- Available to Engineer, Coordinator, Admin roles
- Viewer role: read-only (cannot generate)

**Use Case Example:**
> Engineer needs to create a Control Plan for an internal improvement project (not a formal PPAP). They upload the project BOM, select Control Plan template, review auto-filled process steps, complete control methods, and export final PDF.

#### Mode 2: PPAP-Embedded Document Creation

**Entry Point:** Existing PPAP detail page document cards ("Create" button)

**User Flow:**
1. User working in PPAP workflow (post-ack phase)
2. User clicks "Create" button on document card (e.g., PSW)
3. System loads PPAP-linked BOM (if exists) or prompts upload
4. System pre-populates PPAP context (part number, customer, dates)
5. System generates draft combining BOM + PPAP context
6. User completes remaining fields
7. User saves to PPAP context (links to PPAP record)

**Context Available:**
- BOM data (PPAP-linked or uploaded)
- PPAP metadata (ID, number, part, customer, engineer, dates)
- User identity
- Workflow state awareness (via PPAP layer, not engine)

**Save/Export Behavior:**
- Saves to `ppap_documents` table
- Links to PPAP record via `ppap_id`
- Logs `DOCUMENT_ADDED` event
- Updates document validation status
- Also supports export/print

**Permissions:**
- Respects PPAP workflow permissions
- Engineer can create during assigned post-ack work
- Coordinator can create at any time
- Workflow state gates may restrict (enforced by PPAP layer)

**Use Case Example:**
> Engineer assigned to PPAP-2026-0042 completes pre-ack validations. Coordinator acknowledges PPAP. Engineer enters post-ack phase and clicks "Create" on Control Plan card. System loads PPAP BOM, pre-fills part number, process steps, and measurement specs from BOM. Engineer completes control methods and reaction plans. Saves to PPAP, validation auto-completes.

---

### Shared Core Prevents Duplication

**ANTI-PATTERN (Prohibited):**
```typescript
// ❌ WRONG: Duplicate template logic in PPAP component
function generatePSWInPPAPWorkflow(ppap: PPAPRecord) {
  // Custom PSW generation logic here
  // This duplicates template logic
}

// ❌ WRONG: Separate parser in standalone surface
function parseStandaloneBOM(file: File) {
  // Different parsing logic
  // This duplicates parser logic
}
```

**CORRECT PATTERN (Required):**
```typescript
// ✅ CORRECT: PPAP component uses shared engine
import { generateDocument } from '@/features/documentEngine/core/draftGenerator';

async function handleCreatePSW(ppapId: string) {
  const bom = await fetchPPAPBOM(ppapId);
  const ppapContext = await fetchPPAPContext(ppapId);
  
  const draft = await generateDocument({
    bom,
    templateId: 'psw',
    ppapContext,  // Optional context
  });
  
  // Rest of PPAP-specific logic (save, link, log event)
}

// ✅ CORRECT: Standalone surface uses same engine
async function handleStandaloneGenerate(bomFile: File, templateId: string) {
  const bom = await parseBOM(bomFile);  // Same parser
  
  const draft = await generateDocument({
    bom,
    templateId,
    // No ppapContext - standalone mode
  });
  
  // Rest of standalone logic (export, print)
}
```

---

### Phased Roadmap

#### Phase 3P: Foundation Architecture & Planning

**Goal:** Establish module structure, define interfaces, document template strategy

**Scope:**
- Create `src/features/documentEngine/` module structure
- Define TypeScript interfaces for BOM, templates, drafts
- Document template definition schema
- Create placeholder template registry
- Define parser extension points for future format support

**Dependencies:**
- Current BUILD_PLAN update (this addendum)
- Decision to proceed with dual-surface architecture

**Risks:**
- Over-engineering: Keep interfaces simple, iterate based on real use
- Under-specification: Ensure interfaces support both standalone and embedded

**Success Criteria:**
- Module structure exists and compiles
- Interfaces documented and reviewed
- Template schema defined
- No breaking changes to existing PPAP workflow

#### Phase 3Q: BOM Ingestion & Normalization Baseline

**Goal:** Parse Excel/CSV BOMs, normalize to internal standard

**Scope:**
- Implement Excel BOM parser (primary format)
- Implement CSV BOM parser (secondary format)
- Create normalization logic (vendor formats → internal schema)
- Handle common BOM variations (Trane, customer-specific)
- Validate parsed data completeness
- Error handling and user feedback

**Dependencies:**
- Phase 3P complete (interfaces defined)
- Sample BOM files for testing

**Risks:**
- BOM format variations may be more complex than anticipated
- Normalization rules may require domain expertise input

**Success Criteria:**
- Can parse 80%+ of existing BOM files
- Normalized data structure is consistent
- Clear error messages for unsupported formats
- Unit tests cover common and edge cases

#### Phase 3R: Template Registry & First Supported Template (PSW)

**Goal:** Implement template registry, build PSW template as reference implementation

**Scope:**
- Create template registry with supported templates list
- Define PSW template structure and fields
- Implement PSW field mapping (BOM + PPAP context → PSW fields)
- Generate editable PSW draft (PDF form or web form)
- Validate PSW completeness
- Export PSW to PDF

**Dependencies:**
- Phase 3Q complete (BOM normalization works)
- PSW template requirements documented
- Sample PSW forms for reference

**Risks:**
- PSW template may have variations (customer-specific)
- PDF generation libraries may have limitations
- Field mapping may be more complex than expected

**Success Criteria:**
- PSW template generates successfully
- Auto-fill populates 60%+ of PSW fields
- User can complete remaining fields
- Export produces valid PSW PDF
- Code serves as template pattern for future documents

#### Phase 3S: Standalone UI Flow

**Goal:** Build standalone document generator surface

**Scope:**
- Create `/tools/document-generator` route
- BOM upload form with drag & drop
- BOM preview after parse (show component list)
- Template selector (show only supported templates)
- Draft editor with field completion
- Export and print functionality
- Error handling and user guidance

**Dependencies:**
- Phase 3R complete (at least one template works)
- UX design for standalone flow

**Risks:**
- Standalone flow may compete for resources with PPAP work
- User adoption uncertain (may prefer PPAP-embedded)

**Success Criteria:**
- Engineer can upload BOM and generate PSW independently
- Flow is intuitive (minimal training needed)
- Export produces usable document
- No PPAP coupling in standalone code

#### Phase 3T: PPAP Embedded Integration

**Goal:** Integrate document engine into PPAP workflow

**Scope:**
- Update DocumentationForm "Create" buttons to use engine
- Implement PPAP context provider
- Link generated documents to PPAP records
- Auto-complete validations on document save
- Log events for document creation
- Preserve existing workflow gates and permissions

**Dependencies:**
- Phase 3S complete (engine proven in standalone)
- Phase 3R complete (PSW template works)

**Risks:**
- Integration may reveal coupling issues
- Existing PPAP components may need refactoring
- Workflow state interactions require careful testing

**Success Criteria:**
- Create button generates PSW using engine
- PPAP context auto-fills correctly
- Saved documents link to PPAP record
- Validations auto-complete
- No regression in existing PPAP workflow

#### Phase 3U: Expanded Template Library

**Goal:** Add Control Plan, PFMEA, FAIR templates

**Scope:**
- Control Plan template definition
- PFMEA template definition
- FAIR template definition
- Advanced field mapping for each
- Customer-specific template variations (if needed)
- Template versioning strategy

**Dependencies:**
- Phase 3T complete (integration proven)
- Template requirements documented for each
- Sample filled templates for reference

**Risks:**
- Templates may be more complex than PSW
- Engineering judgment fields difficult to auto-fill
- Measurement data integration (FAIR) may require additional systems

**Success Criteria:**
- 4 total templates supported (PSW + 3 new)
- Each template auto-fills 50%+ of fields
- Templates work in both standalone and embedded modes
- Clear documentation of what each template auto-fills

#### Phase 3V: Advanced Parsing & BOM Intelligence

**Goal:** Support PDF BOMs, multi-sheet Excel, improved normalization

**Scope:**
- PDF BOM parsing (OCR if needed)
- Multi-sheet Excel support
- Intelligent field detection (machine learning?)
- BOM comparison logic (customer vs internal)
- Material availability lookup integration
- Component specification extraction

**Dependencies:**
- Phase 3U complete (template library stable)
- Advanced parsing libraries evaluated

**Risks:**
- PDF parsing accuracy may be low
- OCR may require external services
- ML models may require training data

**Success Criteria:**
- Can parse PDF BOMs with 70%+ accuracy
- Multi-sheet Excel handled correctly
- BOM comparison identifies discrepancies
- Material availability integrated (if feasible)

---

### Non-Goals / Boundaries

**This effort is explicitly NOT doing:**

1. **Not replacing PPAP state machine**
   - Document engine operates alongside, not instead of workflow
   - PPAP status-driven progression remains unchanged
   - Pre-ack/post-ack boundary preserved

2. **Not bypassing workflow gates**
   - Embedded mode respects all PPAP permissions
   - Coordinator acknowledgement gate still required
   - Document creation during pre-ack still prohibited

3. **Not promising AI-derived engineering judgment**
   - Auto-fill is data mapping, not analysis
   - Failure modes, risk ratings, control methods require human expertise
   - System assists, does not replace engineer

4. **Not auto-completing uncertain compliance data**
   - Measurement results require actual measurements
   - Material certifications require supplier documentation
   - Capability studies require statistical analysis
   - System will NOT fabricate data

5. **Not exposing Create for unsupported templates**
   - Only show "Create" button when template truly exists
   - Unsupported documents: upload only, clear messaging
   - No false expectations

6. **Not turning BOM parsing into silent defaults**
   - Uncertain field values left blank, not guessed
   - User must validate all auto-filled values
   - Clear indication of confidence level per field

7. **Not creating a separate disconnected product**
   - This is ONE repo, ONE system, shared capability
   - Not a microservice, not a separate deployment
   - Integrated architecture, not bolted-on tool

---

### Integration Guidance for Future Implementation

**RULE 1: Reuse One Engine**

- Standalone and embedded surfaces MUST use same core engine
- Do not duplicate template logic in PPAP components
- Do not create separate parsers for different surfaces

**RULE 2: Avoid Mixing Parser Logic into UI**

- UI components import and call parser functions
- UI components do not contain parsing logic
- Parser layer is testable independently of UI

**RULE 3: Keep Context Interfaces Explicit**

- Engine accepts context as explicit parameters
- No implicit global state or hidden dependencies
- Testable with mock context

**RULE 4: Preserve PPAP Architectural Rules**

- `ppap.status` remains single source of truth for workflow
- All status updates through `updatePPAPState()`
- Pre-ack/post-ack boundary preserved
- Document engine does not read or write workflow state

**RULE 5: Make Generation APIs Testable**

- Core generation functions are pure (input → output)
- Side effects (save, log, upload) handled by surface layer
- Unit tests do not require database or UI

**RULE 6: Fail Fast on Unsupported Templates**

- Template registry returns clear "not supported" status
- UI checks registry before showing "Create" button
- Error messages guide user to upload instead

**RULE 7: Document What Each Template Auto-Fills**

- Each template definition includes list of auto-filled fields
- Documentation shows examples of before/after
- User knows what to expect from generation

---

### Initial Candidate Templates (Priority Order)

**Tier 1: High Auto-Fill Potential (Implement First)**

1. **PSW (Production Part Submission Warrant)**
   - Auto-fill: Part number, revision, customer, supplier info, submission reason, dates
   - User-entry: Change description, submission level, deviations
   - Rationale: Mostly metadata, high success rate

2. **Control Plan**
   - Auto-fill: Part number, process steps (from routing or BOM), measurement specs (from drawing)
   - User-entry: Control methods, reaction plans, sampling frequency
   - Rationale: Structured data, clear mapping from BOM

3. **PFMEA (Process FMEA)**
   - Auto-fill: Part number, process steps, component list (from BOM)
   - User-entry: Failure modes, effects, causes, controls, RPN calculations
   - Rationale: Framework auto-fill, judgment fields remain manual

**Tier 2: Moderate Auto-Fill Potential (Implement Second)**

4. **FAIR (First Article Inspection Report)**
   - Auto-fill: Part number, drawing reference, measurement specs (from drawing)
   - User-entry: Actual measurements, pass/fail, inspector notes
   - Rationale: Specs from drawing, measurements require physical inspection

5. **DFMEA (Design FMEA)**
   - Auto-fill: Part number, component list, material specs (from BOM)
   - User-entry: Failure modes, effects, design controls, severity/occurrence/detection
   - Rationale: Similar to PFMEA, design-focused

**Tier 3: Low Auto-Fill Potential (Defer or Upload-Only)**

6. **MSA / Gauge R&R**
   - Auto-fill: Part number, gage info (if tracked)
   - User-entry: Repeatability/reproducibility analysis, statistical calculations
   - Rationale: Highly measurement-dependent, complex statistical analysis

7. **Capability Studies**
   - Auto-fill: Part number, process info
   - User-entry: SPC data, Cpk/Ppk calculations, control charts
   - Rationale: Requires extensive measurement data collection

8. **Dimensional Results**
   - Auto-fill: Part number, drawing reference, spec limits
   - User-entry: All actual measurements
   - Rationale: Almost entirely measurement data

**Prioritization Strategy:**
- Start with high auto-fill templates (PSW, Control Plan)
- Prove engine architecture works
- Expand to moderate auto-fill templates
- Consider upload-only for low auto-fill templates (defer generation)

---

### Reconciliation with Current PPAP Documentation UI

**Current State:**
- DocumentationForm shows document cards with upload/create actions
- Create button exists for ballooned_drawing (routes to markup tool)
- Create button for other documents shows "Template coming soon"

**Post-Engine Integration:**
- Document cards remain primary UI (no redesign needed)
- Create button behavior changes based on template registry
  - Supported templates: Generate using engine
  - Unsupported templates: Continue showing "Template not available, please upload"
- Upload button always available (upload-first approach preserved)

**Integration Points:**
- DocumentationForm imports `generateDocument()` from engine
- Create button handler calls engine with PPAP context
- Generated documents saved to PPAP via existing save flow
- Validation auto-completion logic unchanged

**Workflow Awareness:**
- Document engine is workflow-agnostic (operates on provided context)
- PPAP layer enforces workflow rules (pre-ack/post-ack boundary)
- Embedded surface checks `ppap.status` before allowing creation
- Engine itself never reads `ppap.status`

**Permissions:**
- Embedded surface enforces PPAP permissions
- Engine has no permission logic (receives validated context)
- Standalone surface has simpler role-based permissions

**No Breaking Changes Required:**
- Existing upload flow unchanged
- Existing document cards UI unchanged
- Existing validation logic unchanged
- Engine integrates via "Create" button enhancement

---

### Implementation-Grade Writing Standards

This addendum follows BUILD_PLAN standards:

**Structured Sections:**
- Clear hierarchy (major sections, subsections, bullets)
- Consistent formatting and naming
- Cross-references to existing plan sections

**Concrete Architecture Boundaries:**
- Specific module structure recommendations
- Interface contracts with TypeScript examples
- Data flow diagrams with explicit stages

**Phased Delivery:**
- 7 phases with clear goals, scope, dependencies, risks, success criteria
- Each phase builds on previous, no circular dependencies
- Realistic scope per phase

**Decision-Grade Clarity:**
- Principles stated as firm rules, not suggestions
- Non-goals explicitly called out
- Integration guidance with MUST/MUST NOT requirements

**Implementation Hooks:**
- TypeScript code examples show correct patterns
- Anti-patterns explicitly shown and prohibited
- Module boundaries mapped to actual file structure

**No Speculation:**
- Template capabilities based on known data sources (BOM, PPAP metadata)
- Parsing scope based on common file formats
- Phasing based on logical dependency chains

---

## Appendices

### Appendix A: Status Definitions (Current)

```typescript
type PPAPStatus = 
  | 'NEW'
  | 'PRE_ACK_IN_PROGRESS'
  | 'READY_TO_ACKNOWLEDGE'
  | 'ACKNOWLEDGED'
  | 'POST_ACK_IN_PROGRESS'
  | 'AWAITING_SUBMISSION'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETE';
```

### Appendix B: Role Definitions (Current)

```typescript
type UserRole = 'admin' | 'coordinator' | 'engineer' | 'viewer';
```

### Appendix C: Validation Categories (Current)

```typescript
type ValidationCategory = 'pre-ack' | 'post-ack';
```

### Appendix D: Document Actions (Current)

```typescript
type DocumentAction = 'upload' | 'create';
```

### Appendix E: Requirement Levels (Current)

```typescript
type RequirementLevel = 'REQUIRED' | 'CONDITIONAL' | 'OPTIONAL';
```

---

## Document History

**Version 3P.1 (2026-03-26 20:25 CT):**
- Added ADDENDUM: Reusable Document Engine Architecture
- Established dual-capability platform direction (PPAP workflow + standalone document generation)
- Defined three-layer architecture (core engine, standalone surface, embedded PPAP surface)
- Documented canonical design principles (build once, expose twice; context-aware not PPAP-bound)
- Defined recommended module boundaries and interface contracts
- Documented nine-stage data flow pipeline (BOM acquisition → save/export)
- Defined two product modes (standalone and PPAP-embedded) with detailed user flows
- Created 7-phase implementation roadmap (Phases 3P through 3V)
- Documented non-goals and boundaries (preserves PPAP architecture, no AI judgment, no false affordances)
- Added integration guidance and implementation rules
- Prioritized candidate templates (Tier 1: PSW, Control Plan, PFMEA)
- Reconciled with current PPAP documentation UI

**Version 3F.15 (2026-03-25 19:15 CT):**
- Complete rewrite to implementation-grade source of truth
- Added core system identity and single source of truth rules
- Documented 5-layer process model
- Defined pre-ack / post-ack boundary
- Documented BOM comparison model
- Added build site determination logic
- Documented guided validation flow (Phase 3F.13)
- Documented document action system (Phase 3F.14)
- Added document intelligence / template strategy
- Defined role model and perspective model
- Documented review gate authority
- Added governance / implementation rules
- Created phased execution roadmap

**Previous Version:**
- Archived to `BUILD_PLAN_ARCHIVE_20260325.md`

---

## SYSTEM ARCHITECTURE (CURRENT STATE)

**Post-Implementation Clarification** — Added 2026-03-28

This section clarifies the current dual-layer architecture of the EMIP-PPAP system as implemented through Phase 21.

### Two Integrated Layers

The EMIP-PPAP system now operates as **two integrated layers** that work together seamlessly:

#### Layer 1: PPAP Workflow System (State-Driven, Validation-Driven)

**Purpose:** Manage PPAP lifecycle from intake through submission

**Architecture Foundation:** Original BUILD_PLAN (Phase 3F–3K)

**Core Components:**
- **State Machine:** `ppap.status` as single source of truth
- **Workflow Orchestration:** `PPAPWorkflowWrapper` drives sequential phases
- **Validation System:** Pre-ack and post-ack validation tracking
- **Document Tracking:** Upload and status tracking for external documents
- **Event Logging:** Audit trail of all state transitions

**Routes:**
- `/ppap` — PPAP list/dashboard
- `/ppap/[id]` — Individual PPAP workflow
- `/ppap/dashboard` — System-wide overview

**Key Files:**
- `src/features/ppap/components/PPAPWorkflowWrapper.tsx`
- `src/features/ppap/components/DocumentationForm.tsx`
- `src/features/ppap/components/PPAPControlPanel.tsx`
- `src/features/ppap/utils/updatePPAPState.ts`

**Responsibilities:**
- PPAP record creation and lifecycle management
- Pre-acknowledgement readiness validation
- Acknowledgement gate enforcement (coordinator-only)
- Post-acknowledgement workflow progression
- Submission readiness determination
- External document upload (customer-supplied files, manual uploads)

#### Layer 2: Document Engine System (Data-Driven, Template-Driven)

**Purpose:** Generate PPAP documents from BOM data using templates

**Architecture Foundation:** BUILD_PLAN Addendum (Phase 3P–3V), Implemented as Phases 9–21

**Core Components:**
- **BOM Parser:** Excel/CSV/PDF text extraction and normalization
- **Template Engine:** Field definitions and mapping logic
- **Document Generator:** BOM + template → draft document
- **Validation Engine:** Field-level validation with error reporting
- **Workspace UI:** Multi-document editing and workflow guidance
- **Session Persistence:** Local storage for multi-session work

**Routes:**
- `/ppap/[id]/documents` — PPAP-integrated workspace (Phase 17)
- `/document-workspace` — Standalone workspace

**Key Files:**
- `src/features/documentEngine/ui/DocumentWorkspace.tsx`
- `src/features/documentEngine/core/documentGenerator.ts`
- `src/features/documentEngine/validation/validateDocument.ts`
- `src/features/documentEngine/templates/` (registry + individual templates)
- `src/features/documentEngine/mapping/` (BOM-to-document mappers)

**Responsibilities:**
- BOM data ingestion and normalization
- Document generation (Process Flow, PFMEA, Control Plan, PSW)
- Field-level validation and error reporting
- Dependency-aware workflow (staleness detection, prerequisite enforcement)
- Document editing and approval workflow
- PDF export with validation + approval gating

### How the Layers Integrate

**Integration Point:** `/ppap/[id]/documents` route (Phase 17)

**Flow:**
1. User creates PPAP in Layer 1 (PPAP Workflow System)
2. User uploads BOM or enters PPAP data (Layer 1)
3. User clicks "Open Document Workspace" button (Layer 1 → Layer 2 transition)
4. User generates documents from BOM data (Layer 2)
5. User edits, validates, approves documents (Layer 2)
6. User exports PDFs (Layer 2)
7. User uploads exported PDFs to PPAP record (Layer 2 → Layer 1 transition)
8. PPAP workflow progresses based on document readiness (Layer 1)

**Key Architectural Principle (Phase 21):**

> **"There must be ONE document system in the application."**

**Before Phase 21:** Duplicate systems (legacy /tools/* + DocumentWorkspace)  
**After Phase 21:** Single system (DocumentWorkspace only)

**Document Creation:**
- ✅ **Generated documents:** DocumentWorkspace (Layer 2)
- ✅ **External documents:** Upload only (Layer 1)

**No More:**
- ❌ Individual "Create" buttons per document
- ❌ `/tools/*` routes
- ❌ Duplicate document creation systems

### Validation Architecture

The system has **two complementary validation systems**:

**1. PPAP Workflow Validations (Layer 1):**
- **Type:** Checklist-based, human-verified
- **Scope:** Pre-ack readiness (drawing verification, BOM review, tooling, material availability)
- **Purpose:** Ensure organization is ready to acknowledge PPAP commitment
- **UI:** Sequential validation checkboxes in `DocumentationForm`
- **Storage:** `ppap_validations` table

**2. Document Field Validations (Layer 2):**
- **Type:** Automated, field-level constraints
- **Scope:** Document completeness (required fields, numeric ranges, table row completeness)
- **Purpose:** Ensure generated documents meet template requirements
- **UI:** Inline error messages in `DocumentEditor`
- **Storage:** Client-side (validation run on-demand)

**Relationship:** Both systems are independent but complementary. PPAP workflow validations ensure readiness to build; document field validations ensure generated documents are complete and correct.

### Upload vs Generation Coexistence

**Upload System (Layer 1):**
- **Purpose:** Accept external documents (customer-supplied files, manually created documents)
- **UI:** Upload buttons in `DocumentationForm` and `PPAPControlPanel`
- **Use Case:** Documents not generated from BOM (e.g., customer drawings, material certs, manual MSA reports)

**Generation System (Layer 2):**
- **Purpose:** Create documents from BOM data using templates
- **UI:** DocumentWorkspace with step-based workflow
- **Use Case:** Documents that can be auto-generated (Process Flow, PFMEA, Control Plan, PSW)

**Coexistence Strategy:**
- Upload remains for documents that **cannot** be auto-generated
- Generation handles documents that **can** be derived from BOM
- User chooses appropriate path based on document type and data availability

### Current State Summary

**Layer 1 (PPAP Workflow):** ✅ Fully operational, unchanged by Phases 9–21  
**Layer 2 (Document Engine):** ✅ Fully operational, integrated via Phase 17  
**Integration:** ✅ Seamless via `/ppap/[id]/documents` route  
**Unification:** ✅ Single document system enforced (Phase 21)

---

## DOCUMENT SYSTEM UNIFICATION (PHASE 21)

**Post-Implementation Clarification** — Added 2026-03-28

Phase 21 (implemented 2026-03-28) eliminated duplicate document systems and enforced a single entry point for all document creation.

### Problem Statement

**Before Phase 21:**
- **Two separate document systems coexisted:**
  1. Legacy `/tools/*` routes (broken, dead code)
  2. DocumentWorkspace (Phases 12–20, fully functional)
- Individual "Create" buttons on each document in `DocumentationForm` and `PPAPControlPanel`
- Confusing UX: multiple entry points, unclear where to create documents
- Dead code referencing non-existent routes
- Inconsistent behavior between different UI components

**After Phase 21:**
- **ONE document system:** DocumentWorkspace
- **ONE entry point:** `/ppap/[id]/documents`
- Clear, consistent UX across all PPAP interfaces
- No dead code or broken references

### Changes Made

**1. DocumentationForm Simplification:**
- ❌ Removed individual "Create" buttons (one per document)
- ❌ Removed `canCreate()` template availability function
- ❌ Removed `handleCreateDocument()` handler
- ✅ Kept single "Open Document Workspace" button at top
- ✅ Kept upload functionality for external documents

**2. PPAPControlPanel Simplification:**
- ❌ Removed individual "Create" buttons in document matrix
- ❌ Removed `canCreate()` function
- ❌ Removed `handleCreateDocument()` handler
- ✅ Added prominent purple "Document Workspace" entry card
- ✅ Renamed "Document Matrix" → "Document Status" (reflects new purpose: status overview only)

**3. Dead Code Removal:**
- ❌ Removed `openBalloonTool()` function from `documentHelpers.ts` (referenced non-existent `/tools/*`)

### Architectural Impact

**Routing Before:**
```
/ppap/[id] → DocumentationForm → [Create] → /tools/* (404)
/ppap/[id] → PPAPControlPanel → [Create] → /tools/* (404)
/ppap/[id]/documents → DocumentWorkspace ✓
```

**Routing After:**
```
/ppap/[id] → DocumentationForm → "Open Workspace" → /ppap/[id]/documents ✓
/ppap/[id] → PPAPControlPanel → "Open Workspace" → /ppap/[id]/documents ✓
/ppap/[id]/documents → DocumentWorkspace ✓
```

**User Experience Before:**
```
Document Execution Panel
┌──────────────────────────────────────┐
│ Process Flow                  REQUIRED│
│ [🛠 Create] [📤 Upload]              │  ← Confusing: two options
├──────────────────────────────────────┤
│ PFMEA                        REQUIRED │
│ [🛠 Create] [📤 Upload]              │
└──────────────────────────────────────┘
```

**User Experience After:**
```
Document Execution Panel
[🚀 Open Document Workspace]  ← Clear: one entry point

┌──────────────────────────────────────┐
│ Process Flow                  REQUIRED│
│ [📤 Upload]                          │  ← Simple: upload only
├──────────────────────────────────────┤
│ PFMEA                        REQUIRED │
│ [📤 Upload]                          │
└──────────────────────────────────────┘
```

### Success Criteria Met

✅ One document system only (DocumentWorkspace)  
✅ All document actions go through DocumentWorkspace  
✅ No 404 routes (no /tools/* references)  
✅ No broken buttons (all route to workspace)  
✅ PPAP flow feels coherent (single entry point)  
✅ Validation + documents aligned (unchanged)  
✅ Clean navigation experience (clear UX)

---

## DOCUMENT ENGINE — IMPLEMENTED PHASES

**Post-Implementation Clarification** — Added 2026-03-28

This section summarizes the 13 implementation phases (Phases 9–21) that delivered the Document Engine system as defined in the BUILD_PLAN Addendum (Phase 3P–3V).

### Phase 9: Document Generation Foundation

**Phase 9.1 — Process Flow Template:**
- Purpose: Generate process flow diagrams from BOM data
- Capability: BOM → process steps with operations, controls, and outputs
- Template: `processFlowTemplate.ts`
- Mapper: `mapBOMToProcessFlow.ts`

**Phase 9.2 — PFMEA Template:**
- Purpose: Generate PFMEA documents from process flow
- Capability: Process Flow → failure modes, effects, severity, occurrence, detection
- Template: `pfmeaTemplate.ts`
- Mapper: `mapProcessFlowToPFMEA.ts`
- Dependency: Requires Process Flow

**Phase 9.3 — Control Plan Template:**
- Purpose: Generate control plans from PFMEA
- Capability: PFMEA → control methods, measurement specs, reaction plans
- Template: `controlPlanTemplate.ts`
- Mapper: `mapPFMEAToControlPlan.ts`
- Dependency: Requires PFMEA

### Phase 10: OEM Alignment

- Purpose: Ensure document formats align with OEM requirements (Ford, GM, Chrysler)
- Capability: Template variations per OEM standard
- Implementation: Field definitions match OEM PSW/APQP requirements

### Phase 11: Validation Engine

- Purpose: Field-level validation with error reporting
- Capability: Required field checks, numeric range validation, table row completeness
- Implementation: `validateDocument.ts` with `ValidationError` and `ValidationResult` types
- UI: Inline error messages in `DocumentEditor`, error summary panel

### Phase 12: DocumentWorkspace UI

- Purpose: Unified workspace for document generation and editing
- Capability: BOM upload, template selection, document editing, PDF export
- Implementation: `DocumentWorkspace.tsx` with multi-step workflow
- UI: Upload → Select Template → Input Data → Edit Document → Export PDF

### Phase 13: Workflow Visibility

- Purpose: Show document dependency chain and recommended next steps
- Capability: Step-based navigation, dependency labels, recommended step highlighting
- Implementation: `WORKFLOW_STEPS` array with `dependsOn` relationships

### Phase 14: Staleness Detection

- Purpose: Detect when documents are out of sync with dependencies
- Capability: Timestamp tracking, stale status indicators, regeneration messaging
- Implementation: `documentTimestamps` state, `isStale()` function
- UI: Warning indicators, "regenerate recommended" messages

### Phase 15: Soft Workflow Gating

- Purpose: Guide users to follow dependency order without hard blocking
- Capability: Recommended step logic, guidance banners, visual indicators
- Implementation: `recommendedStep` calculation, prerequisite warnings

### Phase 16: Session Persistence

- Purpose: Save and restore workspace state across page reloads
- Capability: Multi-session storage, session switching, automatic save
- Implementation: `localStorage` with `StoredSession` type, session selector UI

### Phase 17: PPAP Integration

- Purpose: Integrate DocumentWorkspace into PPAP workflow
- Capability: PPAP-specific route, optional `ppapId` prop
- Implementation: `/ppap/[id]/documents` route, `ppapId` context passing

### Phase 18: Multi-Session Management

- Purpose: Support multiple concurrent PPAP document workspaces
- Capability: Session creation, switching, deletion
- Implementation: Session selector UI, `activeSessionId` state

### Phase 19: Hard Workflow Gating

- Purpose: Enforce dependency order (cannot generate without prerequisites)
- Capability: Step enablement logic, lock icons on disabled steps, prerequisite error messages
- Implementation: `isStepEnabled()` function, `STEP_ORDER` enforcement

### Phase 20: Approval Workflow

- Purpose: Add ownership and approval lifecycle to documents
- Capability: Owner assignment, draft/in_review/approved status, approval-gated export
- Implementation: `documentMeta` state with `DocumentStatus` type, status dropdown UI
- Gating: PDF export blocked unless status = 'approved'

### Phase 21: Document System Unification

- Purpose: Eliminate duplicate document systems
- Capability: Single entry point for all document creation
- Implementation: Removed individual "Create" buttons, added prominent workspace button
- Impact: `/ppap/[id]/documents` is now the ONLY document creation route

### Capabilities Summary

**Complete and Operational:**
- ✅ BOM parsing (Excel, CSV, PDF text extraction)
- ✅ BOM normalization (vendor formats → internal schema)
- ✅ Template-based generation (Process Flow, PFMEA, Control Plan, PSW)
- ✅ Dependency-aware workflow (staleness, prerequisite enforcement)
- ✅ Field-level validation (required, numeric, table completeness)
- ✅ Real-time editing with validation feedback
- ✅ Multi-session persistence (localStorage)
- ✅ PPAP integration (dedicated route)
- ✅ Approval workflow (owner + status lifecycle)
- ✅ PDF export (per document, validation + approval gated)
- ✅ Single unified document system (Phase 21)

---

## KNOWN TRANSITION AREAS

**Post-Implementation Clarification** — Added 2026-03-28

This section documents known architectural boundaries and areas where the two systems (PPAP Workflow + Document Engine) coexist.

### 1. Dual Validation Systems

**Situation:** Two separate validation systems exist

**Layer 1 (PPAP Workflow):**
- Pre-ack and post-ack validation checklists
- Human-verified, checklist-based
- Stored in `ppap_validations` table

**Layer 2 (Document Engine):**
- Field-level document validation
- Automated, constraint-based
- Run client-side on-demand

**Architectural Boundary:** These systems serve different purposes and do not conflict. PPAP workflow validations ensure organizational readiness; document field validations ensure document completeness.

**Status:** ✅ Intentional design, no conflict

### 2. Upload and Generation Coexistence

**Situation:** Both upload and generation capabilities exist for documents

**Upload (Layer 1):**
- User manually uploads externally created documents
- Use case: Customer-supplied files, manually created documents
- UI: Upload buttons in `DocumentationForm` and `PPAPControlPanel`

**Generation (Layer 2):**
- System generates documents from BOM data
- Use case: Documents that can be auto-generated
- UI: DocumentWorkspace

**Architectural Boundary:** Upload is for external documents; generation is for BOM-derived documents. Both paths are valid depending on document source.

**Status:** ✅ Intentional design, no conflict

### 3. Document Status Tracking

**Situation:** Document status tracked in two places

**Layer 1 (PPAP Workflow):**
- Document upload status (missing/ready)
- Stored in `ppap_documents` table (uploaded files)
- UI: Document matrix shows uploaded file status

**Layer 2 (Document Engine):**
- Document generation status (not generated / generated / approved)
- Stored in `localStorage` (client-side sessions)
- UI: Workspace shows generation + approval status

**Architectural Boundary:** Upload status and generation status are separate concerns. A document can be generated in workspace but not yet uploaded to PPAP record.

**Status:** ⚠️ Potential for user confusion if not clear which status is being shown

**Mitigation:** Phase 21 clarified UI to distinguish "Document Status" (uploaded) from "Document Workspace" (generation)

### 4. Client-Side vs Server-Side Persistence

**Situation:** Document Engine uses client-side persistence only

**Current State:**
- Generated documents stored in `localStorage`
- Session data persists per browser/device
- No server-side document storage
- No cross-device synchronization

**Architectural Boundary:** Document Engine is currently client-side only. PPAP workflow is server-side (database-backed).

**Status:** ⚠️ Temporary limitation (planned for Phase 22+)

**Impact:** Users cannot access generated documents from different devices. Generated documents are not linked to PPAP records in database.

### 5. Ownership and User System

**Situation:** Approval workflow uses client-side owner tracking

**Current State:**
- Owner entered as free-text string
- No authentication or user validation
- No role-based approval authority

**Architectural Boundary:** Real user system and authentication not yet implemented.

**Status:** ⚠️ Temporary limitation (planned for Phase 23+)

**Impact:** Owner field is informational only, not enforced by authentication.

### Summary

**Intentional Boundaries (No Action Needed):**
- ✅ Dual validation systems (serve different purposes)
- ✅ Upload and generation coexistence (different use cases)

**Temporary Limitations (Future Enhancement):**
- ⚠️ Client-side only persistence (Phase 22: Backend storage)
- ⚠️ Free-text owner tracking (Phase 23: Real user system)
- ⚠️ Document status disconnect (Phase 22: Link generated docs to PPAP records)

**No Breaking Issues Identified.**

---

## FORWARD ROADMAP (POST-21)

**Post-Implementation Clarification** — Added 2026-03-28

This section outlines planned future phases to extend the Document Engine system capabilities.

### Phase 22: Backend Persistence (PPAP-Linked Storage)

**Goal:** Store generated documents in database, link to PPAP records

**Scope:**
- Create `ppap_generated_documents` table (document drafts, metadata, timestamps)
- Link generated documents to PPAP via `ppap_id` foreign key
- Persist document edits to database (replace `localStorage`)
- Enable cross-device access to generated documents
- Sync approval status with PPAP workflow

**Dependencies:**
- Database schema extension
- Server-side document storage API

**Success Criteria:**
- Generated documents accessible from any device
- Document generation visible in PPAP dashboard
- Approval status synced with PPAP submission readiness

### Phase 23: User System Integration (Ownership Tied to Real Users)

**Goal:** Replace free-text owner with authenticated user assignment

**Scope:**
- Integrate with authentication system
- Assign documents to real users (not free-text)
- Enforce role-based approval authority (approver vs editor roles)
- Track approval history with user audit trail
- Implement approval delegation workflows

**Dependencies:**
- Phase 22 complete (backend persistence)
- Authentication system integrated

**Success Criteria:**
- Owner field populated from user database
- Only designated approvers can change status to 'approved'
- Approval history logged with timestamps and user IDs

### Phase 24: Document Revision/Version Control

**Goal:** Track document revisions and enable version history

**Scope:**
- Version numbering for generated documents
- Revision history tracking (who changed what, when)
- Diff view between versions
- Restore previous versions
- Lock finalized versions (prevent edits after submission)

**Dependencies:**
- Phase 22 complete (backend persistence)
- Phase 23 complete (user system)

**Success Criteria:**
- Each document edit creates new version
- Users can view and compare historical versions
- Submitted documents locked from further edits

### Phase 25: Additional Document Templates

**Goal:** Expand template library beyond current four templates

**Scope:**
- DFMEA template (design failure mode analysis)
- MSA template (measurement system analysis)
- Dimensional Results template (FAIR/inspection results)
- Ballooned Drawing template (annotated CAD markup)
- Material Test Results template

**Dependencies:**
- Template design and field definition
- Mapping logic for each template
- Sample data for testing

**Success Criteria:**
- 5+ additional templates operational
- Same workflow and validation capabilities as existing templates
- Integration with dependency chain (e.g., DFMEA → PFMEA)

### Phase 26: Cross-PPAP Dashboard (System Visibility)

**Goal:** System-wide view of document generation status across all PPAPs

**Purpose:** Manager/coordinator visibility into document readiness across active PPAPs

**Scope:**
- Dashboard showing all PPAPs with document generation status
- Filter by approval status, owner, template type
- Identify bottlenecks (documents awaiting approval)
- Export aggregated reports

**Note:** This is NOT a replacement for existing PPAP dashboard; it is a complementary view focused on document engine status.

**Dependencies:**
- Phase 22 complete (backend persistence)
- Phase 23 complete (user system)

**Success Criteria:**
- Coordinators can see document status across all PPAPs
- Identify which PPAPs have unapproved documents
- Track document generation velocity

### Phasing Strategy

**Near-Term (Next 2-4 Phases):**
- Phase 22 is highest priority (removes client-side limitation)
- Phase 23 follows naturally (real users once backend exists)

**Mid-Term (Phases 24-25):**
- Version control enhances audit capability
- Additional templates expand utility

**Long-Term (Phase 26+):**
- Cross-PPAP visibility for management
- Advanced analytics and reporting

**Guiding Principles:**
- Preserve all existing functionality
- Maintain separation of concerns (PPAP workflow vs Document Engine)
- Avoid over-engineering; build based on real usage patterns
- Continue iterative enhancement approach

---

## BUILD PLAN ADDENDUM — POST-PHASE 43 ARCHITECTURAL EXTENSIONS

**Added:** 2026-03-29 19:59 CT  
**Status:** Architectural Definition (No Implementation)  
**Purpose:** Define Document Wizard + PPAP Orchestration Layer

This addendum extends the BUILD_PLAN with two major architectural additions:
1. **Document Wizard Module** — Unstructured, workflow-independent document generation
2. **PPAP Orchestration Layer** — Missing coordinator workflow and PPAP definition management

These additions are **purely architectural**. No implementation has occurred. All sections below define future phases and system design.

---

## SYSTEM ARCHITECTURE — DUAL ENTRY MODEL (POST PHASE 43)

**Architectural Clarification**

As of Phase 43, the EMIP-PPAP system consists of a **shared deterministic engine** with **TWO distinct interaction layers**:

### Interaction Layer 1: PPAP Workflow System (Structured)

**Purpose:** Guided, multi-document PPAP lifecycle management

**Characteristics:**
- Workflow-driven (sequential phases)
- Session-bound (persistent state)
- Multi-document coordination
- Approval gates enforced
- Role-based access control
- Audit trail required

**Entry Point:** `/ppap/[id]/documents`

**User Type:** Engineers executing formal PPAP programs

**Workflow:**
```
Create PPAP → Upload BOM → Generate Documents (ordered) → 
Complete/Edit → Validate → Approve → Submit Package
```

**Key Constraint:** Documents are bound to PPAP session lifecycle

---

### Interaction Layer 2: Document Wizard System (Unstructured)

**Purpose:** Fast, flexible, single-document generation

**Characteristics:**
- Workflow-independent (no PPAP required)
- Stateless or ephemeral (documents not session-bound)
- Single-document focused
- No approval gates
- No role restrictions
- Minimal persistence (optional caching)

**Entry Point:** `/tools/document-wizard` (proposed)

**User Type:** Engineers needing quick document generation outside formal PPAP

**Workflow:**
```
Upload BOM (or select template) → Generate Document → 
Edit → Export (PDF/Excel) → Done
```

**Key Constraint:** Documents are NOT bound to PPAP session; outputs are ephemeral

---

### Shared Engine Components

**Both layers use the SAME underlying engine:**

| Component | Purpose | Shared? |
|-----------|---------|---------|
| **Template Registry** | Store all templates (static, dynamic, uploaded) | ✅ Yes |
| **Mapping Engine** | BOM → Template field mapping (`templateMappingService.ts`) | ✅ Yes |
| **Validation Engine** | Template-driven validation (`validateDocument.ts`) | ✅ Yes |
| **Document Generator** | Orchestrate generation (`documentGenerator.ts`) | ✅ Yes |
| **DocumentEditor** | Field editing UI component | ✅ Yes |
| **Versioning System** | Immutable version history | ✅ Yes (PPAP only) |
| **Risk + Guidance Layers** | Intelligent warnings, health scoring | ✅ Yes (PPAP only) |
| **Session Persistence** | Multi-session state | ❌ PPAP only |
| **Approval Workflow** | Document approval gates | ❌ PPAP only |

---

### Key Architectural Principle

**"Different UX layers, same deterministic engine."**

- The **engine** is workflow-agnostic
- The **PPAP layer** adds workflow, gating, persistence
- The **Wizard layer** provides direct access without workflow overhead

**Design Goal:**
- PPAP users get structured guidance and audit trails
- Wizard users get fast, flexible document generation
- NO duplicate template logic
- NO duplicate mapping logic
- NO duplicate validation logic

---

### Template Flow (Unified)

**All templates flow into ONE registry:**

```
Template Sources:
├── Static Templates (built-in: PSW, Process Flow, PFMEA, Control Plan)
├── Admin-Uploaded Templates (via admin panel, Phase 29-30)
└── Wizard-Uploaded Templates (user-created, future Phase W2)
    ↓
Template Registry (shared, persistent)
    ↓
Available to:
├── PPAP Workflow System
└── Document Wizard System
```

**Persistence:** ALL templates saved to database (`dynamic_templates` table)

**Lifecycle:** Templates persist indefinitely unless explicitly deleted

---

## DOCUMENT WIZARD MODULE (NEW — PHASE W SERIES)

**Status:** Not implemented (architectural definition only)

**Purpose:** Provide a standalone, workflow-independent document generation tool for users who need quick document creation without formal PPAP overhead.

---

### Wizard Behavior Definition (STRICT)

**The Wizard MUST:**
- ✅ NOT require PPAP session
- ✅ NOT require workflow state
- ✅ NOT enforce prerequisite gating
- ✅ Allow template selection OR template upload
- ✅ Allow BOM / engineering master upload
- ✅ Generate documents using existing mapping engine
- ✅ Render documents using existing `DocumentEditor` component
- ✅ Allow export (PDF/Excel)
- ✅ Support immediate download (no approval required)

**The Wizard MUST NOT:**
- ❌ Create PPAP sessions
- ❌ Enforce approval workflows
- ❌ Require role-based permissions (beyond basic auth)
- ❌ Bind documents to long-term persistence (ephemeral by default)

---

### Data Model

**Templates:**
- Status: **PERSISTENT** (shared registry)
- Storage: `dynamic_templates` table (existing)
- Lifecycle: Survive app restarts, available to all systems

**Generated Documents:**
- Status: **EPHEMERAL** (no session binding)
- Storage: In-memory during editing, exported on demand
- Lifecycle: Lost on navigation away (unless explicitly saved to future "Recent Outputs" cache)

**Optional (Future Enhancement):**
- "Recent Outputs" cache: Store last N generated documents per user
- Not critical for Phase W1-W3

---

### Template Handling Strategy

**Template Sources (Wizard Accepts):**

1. **Select Existing Template**
   - From shared template registry
   - Includes static templates (PSW, PFMEA, etc.)
   - Includes admin-uploaded templates
   - Includes wizard-uploaded templates (future)

2. **Upload New Template** (Future: Phase W2)
   - User uploads Excel/PDF template
   - System parses structure
   - Saves to shared registry
   - Immediately available for generation

**Template Identity (Phase W4):**
- **Fingerprinting:** Hash-based template identity
- **Duplicate Detection:** Check if template already exists before saving
- **User Prompt:** "This template already exists. Reuse existing or create new version?"

---

### Template Types

**All templates share same registry, but tagged by source:**

| Type | Source | Editable? | Deletable? | Availability |
|------|--------|-----------|------------|--------------|
| **Static** | Built-in (code) | ❌ No | ❌ No | Always |
| **Admin** | Admin panel upload | ✅ Yes (admin) | ✅ Yes (admin) | Always |
| **Wizard** | Wizard upload | ✅ Yes (creator) | ✅ Yes (creator) | After Phase W2 |

---

### Wizard Workflow (Phase W1-W3)

**Step 1: Template Selection**
```
User lands on /tools/document-wizard
↓
Two options:
  A. Select from dropdown (existing templates)
  B. Upload new template (future Phase W2)
```

**Step 2: BOM Upload**
```
User uploads BOM file (Visual Engineering Master)
↓
System parses using existing bomParser.ts
↓
System normalizes using existing bomNormalizer.ts
```

**Step 3: Generation**
```
System calls existing templateMappingService.ts
↓
Mapping engine populates fields from BOM
↓
Document rendered in existing DocumentEditor component
```

**Step 4: Edit (Optional)**
```
User edits fields directly in DocumentEditor
↓
Real-time validation using existing validateDocument.ts
↓
Errors highlighted inline
```

**Step 5: Export**
```
User clicks "Export"
↓
Two options:
  A. Export as PDF
  B. Export as Excel
↓
File downloaded immediately
```

**Step 6: Done**
```
User navigates away
↓
Document state discarded (ephemeral)
↓
Template remains in registry (persistent)
```

---

## DOCUMENT WIZARD PHASES (W1–W5)

**Note:** These phases are **independent** of main PPAP phases. They define the Wizard module only.

---

### Phase W1 — Wizard Foundation

**Status:** Not implemented

**Objective:** Basic wizard functionality with template selection and document generation

**Deliverables:**
1. New route: `/tools/document-wizard`
2. Wizard UI:
   - Template dropdown (existing templates only)
   - BOM upload field
   - Generate button
3. Generation pipeline:
   - Reuse `generateDocumentDraft()` from `documentGenerator.ts`
   - Reuse `applyTemplateMapping()` from `templateMappingService.ts`
4. Render via existing `DocumentEditor` component
5. Basic export (PDF only, Phase W3 for Excel)

**Dependencies:**
- Template registry (existing, Phase 30.1)
- Mapping engine (existing, Phase 32)
- Document generator (existing)
- DocumentEditor component (existing)

**Success Criteria:**
- User can select template, upload BOM, generate document
- Document displays in DocumentEditor
- User can edit fields
- Validation errors display inline

---

### Phase W2 — Template Memory Integration

**Status:** Not implemented

**Objective:** Enable wizard to save uploaded templates to shared registry

**Deliverables:**
1. "Upload Template" button in wizard
2. Template upload flow:
   - Accept Excel/PDF files
   - Parse template structure (reuse existing ingestion service)
   - Save to `dynamic_templates` table
3. Template selector dropdown:
   - Show all templates (static + admin + wizard-uploaded)
   - Filter by type (optional)
4. Template persistence:
   - All wizard-uploaded templates persist
   - Available to PPAP system immediately

**Dependencies:**
- Phase W1 complete
- Template persistence service (existing, Phase 30)
- Template ingestion service (existing, Phase 29)

**Success Criteria:**
- User can upload new template
- Template appears in dropdown immediately
- Template persists across app restarts
- Template available in PPAP system

---

### Phase W3 — Export System

**Status:** Not implemented

**Objective:** Complete export functionality (PDF + Excel)

**Deliverables:**
1. Export dialog:
   - Choose format: PDF or Excel
   - File naming convention: `{templateName}_{partNumber}_{timestamp}`
2. PDF export:
   - Reuse existing PDF export logic (if available)
   - OR implement new PDF renderer
3. Excel export:
   - Generate Excel workbook from document fields
   - Preserve template layout (future: Phase 48)
4. Download handling:
   - Browser download dialog
   - Clear success message

**Dependencies:**
- Phase W1 complete

**Success Criteria:**
- User can export as PDF
- User can export as Excel
- Files download with correct naming
- Exported files open correctly in respective applications

---

### Phase W4 — Template Fingerprinting

**Status:** Not implemented

**Objective:** Prevent duplicate templates, enable template reuse

**Deliverables:**
1. Template hashing:
   - Generate SHA-256 hash of template structure
   - Store hash in `dynamic_templates` table
2. Duplicate detection:
   - Check hash before saving new template
   - If match found, prompt user:
     - "Template already exists. Use existing template or create new version?"
3. Template versioning (optional):
   - Allow multiple versions of same template
   - Tag with version number

**Dependencies:**
- Phase W2 complete

**Success Criteria:**
- Duplicate templates detected before save
- User prompted with reuse option
- No duplicate templates in registry (unless user explicitly creates versions)

---

### Phase W5 — AI-Assisted Parsing (Optional Advanced)

**Status:** Not implemented (future consideration)

**Objective:** Use AI to assist with template structure detection and field extraction

**Deliverables:**
1. AI-assisted template parsing:
   - Analyze uploaded PDF/Excel template
   - Detect field types (text, table, dropdown, etc.)
   - Suggest field mappings to BOM
2. Mapping suggestions:
   - AI recommends which BOM fields map to template fields
   - User confirms or adjusts mappings
3. Structure detection:
   - Identify headers, sections, tables
   - Generate template definition automatically

**Dependencies:**
- Phase W2 complete
- AI/ML integration (requires AI platform integration)

**Success Criteria:**
- AI correctly identifies 80%+ of template fields
- Mapping suggestions reduce manual configuration
- User can override AI suggestions

**Note:** This phase is **optional** and **long-term**. Not required for basic wizard functionality.

---

## PPAP ORCHESTRATION LAYER (PHASE 44+)

**Status:** Not implemented (architectural gap identified)

**Problem Statement:**

The current system (as of Phase 43) lacks explicit **PPAP definition management**. This creates the following gaps:

1. **No PPAP Creation Workflow:**
   - Coordinator cannot define a new PPAP in the system
   - No way to specify required documents upfront
   - No customer package upload capability

2. **No Template Assignment:**
   - Cannot specify which templates are required for a specific PPAP
   - Cannot customize workflow based on customer requirements

3. **No Coordinator UX:**
   - Coordinator role defined but no dedicated workflow
   - Engineer sees PPAP but doesn't know origin/context

4. **No PPAP Initialization:**
   - Documents generated ad-hoc by engineer
   - No pre-population of PPAP metadata

---

### PPAP Orchestration Layer Definition

**Purpose:** Provide coordinator-driven PPAP definition, initialization, and assignment workflow

**Core Component: PPAP Definition**

A PPAP Definition must include:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Unique PPAP identifier |
| `customerId` | UUID | Yes | Customer this PPAP is for |
| `customerName` | String | Yes | Customer name (cached) |
| `partNumber` | String | Yes | Part number for this PPAP |
| `partDescription` | String | No | Part description |
| `requiredTemplates` | TemplateId[] | Yes | List of required document templates |
| `workflowSequence` | TemplateId[] | No | Ordered workflow (default: standard order) |
| `assignedTo` | UserId | No | Engineer/team assigned |
| `assignedBy` | UserId | Yes | Coordinator who created PPAP |
| `customerPackageUrl` | String | No | Link to uploaded customer package |
| `status` | PPAPStatus | Yes | Current PPAP status (reuse existing) |
| `createdAt` | Timestamp | Yes | PPAP creation time |
| `metadata` | JSON | No | Additional metadata |

---

### User Roles (Orchestration Layer)

**Coordinator Role:**

**Responsibilities:**
- Create new PPAP definitions
- Upload customer package (zip/folder)
- Select required templates for PPAP
- Assign PPAP to engineer or team
- Monitor PPAP progress
- Approve PPAP acknowledgement (existing)

**Workflow:**
```
Coordinator:
  1. Click "Create New PPAP"
  2. Select customer
  3. Upload customer package (BOM, drawings, etc.)
  4. Enter part number, description
  5. Select required templates (checkboxes)
  6. Assign to engineer
  7. Click "Initialize PPAP"
     ↓
  System creates PPAP definition
  System notifies engineer
```

**Engineer Role:**

**Responsibilities:**
- Execute PPAP workflow (existing)
- Generate required documents (existing)
- Complete validations (existing)
- Submit for approval (existing)

**Workflow:**
```
Engineer:
  1. Receives PPAP assignment notification
  2. Opens PPAP via dashboard
  3. Sees required documents list
  4. Generates documents from BOM
  5. Completes workflow
  6. Submits for approval
```

---

### PPAP Orchestration Phases

**Phase 44: PPAP Definition Model**

**Objective:** Create database schema and API for PPAP definitions

**Deliverables:**
- New table: `ppap_definitions`
- CRUD operations: `createPPAP()`, `getPPAP()`, `updatePPAP()`, `deletePPAP()`
- Relationship to existing `ppaps` table
- Migration strategy (existing PPAPs grandfathered)

---

**Phase 45: Coordinator Workflow UI**

**Objective:** Build UI for coordinator to create and manage PPAP definitions

**Deliverables:**
- "Create PPAP" wizard in coordinator dashboard
- Customer selection dropdown
- Customer package upload
- Template selection (checkboxes, all available templates)
- Engineer assignment dropdown
- PPAP summary preview before creation

---

**Phase 46: PPAP Initialization Engine**

**Objective:** Auto-initialize PPAP session when engineer opens assigned PPAP

**Deliverables:**
- Pre-populate PPAP metadata from definition
- Pre-select required templates
- Display customer package link/files
- Auto-load BOM if included in package
- Show workflow sequence

---

**Phase 47: Engineer Workflow UX Enhancements**

**Objective:** Improve engineer experience with PPAP context

**Deliverables:**
- Display PPAP origin (customer, coordinator, assignment date)
- Show required documents checklist
- Highlight which documents are missing vs complete
- Integration with existing workflow guidance (Phase 38-43)

---

**Phase 48: Template Layout Fidelity**

**Objective:** Support pixel-perfect template rendering (Excel layout preservation)

**Deliverables:**
- Excel layout parser
- Field positioning preservation
- Cell formatting preservation
- Export maintains original layout
- Applies to both PPAP and Wizard systems

**Note:** This is a **long-term** phase requiring significant template engine refactoring.

---

### Relationship: Wizard vs PPAP Orchestration

**Wizard:**
- Use case: Quick, one-off document generation
- No PPAP required
- No approval workflow
- Ephemeral output

**PPAP (with Orchestration):**
- Use case: Formal PPAP program execution
- Coordinator creates PPAP definition
- Engineer executes structured workflow
- Approval gates enforced
- Persistent audit trail

**Key Difference:**
- Wizard = **"I need a Control Plan for this part"**
- PPAP = **"Customer X requires PPAP for part Y, engineer Z must complete by date D"**

---

## TEMPLATE STRATEGY — UNIFIED SYSTEM

**Critical Architectural Rule:**

**ALL templates live in ONE registry.**

**No exceptions.**

---

### Template Registry Rules

1. **Single Source of Truth:**
   - One database table: `dynamic_templates`
   - One in-memory registry: `templateRegistry` (loaded from DB)
   - One API: `getTemplate()`, `registerTemplate()`, `listTemplates()`

2. **Templates are Reusable Across:**
   - PPAP Workflow System
   - Document Wizard System
   - Admin panel
   - Future systems

3. **Templates Support:**
   - Field mappings (`fieldMappings` property)
   - Validation rules (`fieldDefinitions` property)
   - Versioning (stored in `document_versions` table)
   - Layout metadata (future: Phase 48)

4. **Templates Evolve Toward:**
   - **Layout fidelity** (preserve Excel formatting)
   - **Multi-page templates** (multiple tabs/sheets)
   - **Conditional sections** (show/hide fields based on rules)
   - **Custom validation** (beyond built-in rules)

---

### Template Lifecycle

**Creation:**
```
Template Source (code/upload/admin) 
  → Parse template structure
  → Define field mappings
  → Define validation rules
  → Save to dynamic_templates table
  → Register in templateRegistry
```

**Usage:**
```
User selects template (PPAP or Wizard)
  → Load from templateRegistry
  → Apply mappings (BOM → fields)
  → Validate fields
  → Render in DocumentEditor
  → User edits
  → Re-validate
  → Export
```

**Update:**
```
Admin/User uploads new version
  → Check fingerprint (Phase W4)
  → If duplicate, prompt for versioning
  → Save new version or update existing
  → Refresh templateRegistry
```

**Deletion:**
```
Admin/User deletes template
  → Check if template in use (any PPAPs?)
  → If in use, warn and require confirmation
  → Delete from dynamic_templates table
  → Remove from templateRegistry
```

---

### Template Metadata (Future Enhancement)

**Templates should include:**

| Field | Purpose | Phase |
|-------|---------|-------|
| `templateId` | Unique identifier | ✅ Implemented |
| `name` | Human-readable name | ✅ Implemented |
| `version` | Version number | 🔲 Future (Phase W4) |
| `fingerprint` | SHA-256 hash of structure | 🔲 Future (Phase W4) |
| `layoutData` | Excel formatting, positioning | 🔲 Future (Phase 48) |
| `conditionalRules` | Show/hide field logic | 🔲 Future |
| `customValidation` | Custom validation functions | 🔲 Future |
| `tags` | Searchable tags (e.g., "automotive", "OEM-specific") | 🔲 Future |

---

## KNOWN SYSTEM GAPS (POST PHASE 43)

**Updated:** 2026-03-29 19:59 CT

This section explicitly lists known architectural and functional gaps in the current system. These gaps do NOT represent bugs or broken functionality; they represent **missing capabilities** identified for future implementation.

---

### Gap 1: No PPAP Definition Layer

**Description:**
- No coordinator workflow to define PPAPs upfront
- No way to specify required documents before engineer starts
- No customer package upload capability

**Impact:**
- Engineers start PPAPs without clear requirements
- No visibility into what customer originally requested
- Ad-hoc document selection instead of requirement-driven

**Resolution:** Phases 44-47 (PPAP Orchestration Layer)

---

### Gap 2: No Coordinator Workflow UI

**Description:**
- Coordinator role exists but has no dedicated UX
- No "Create PPAP" wizard
- No assignment workflow

**Impact:**
- Coordinators use external systems to manage PPAP intake
- No integration with EMIP-PPAP system until engineer starts work

**Resolution:** Phase 45 (Coordinator Workflow UI)

---

### Gap 3: No Template Layout Fidelity

**Description:**
- Templates are field-based (JSON), not layout-based
- Excel export does not preserve original template formatting
- No support for multi-page templates with complex layouts

**Impact:**
- Generated documents look generic
- OEM-specific templates lose branding/formatting
- Manual reformatting required after export

**Resolution:** Phase 48 (Template Layout Fidelity)

---

### Gap 4: No Automatic Workbook Decomposition

**Description:**
- Large customer packages (e.g., Trane's 50-sheet Excel workbook) cannot be auto-parsed
- No way to detect which sheets map to which templates
- Manual decomposition required

**Impact:**
- Coordinator must manually extract sheets
- Time-consuming setup for large packages
- Error-prone process

**Resolution:** Future phase (Workbook Intelligence)

**Example Use Case:**
```
Customer uploads: Trane_PPAP_Package.xlsx (50 sheets)
  Sheet 1: Part Info
  Sheet 2: Process Flow
  Sheet 3-15: PFMEA rows
  Sheet 16: Control Plan
  etc.

Desired: System auto-detects sheet types, 
         suggests template mappings,
         pre-populates document fields
```

---

### Gap 5: No Template Versioning (Formal)

**Description:**
- Templates can be updated, but no formal version tracking
- No diff view between template versions
- No rollback capability

**Impact:**
- Template changes affect all existing PPAPs
- No audit trail for template evolution
- Cannot compare "old" vs "new" template structure

**Resolution:** Phase W4 + Template Version Control (future)

---

### Gap 6: No Wizard Module

**Description:**
- No unstructured document generation tool
- Users must create PPAP session for one-off documents
- Overhead for simple use cases

**Impact:**
- Engineers create "fake" PPAP sessions for quick docs
- PPAP dashboard cluttered with non-PPAP entries
- Confusion about what is a "real" PPAP

**Resolution:** Phases W1-W5 (Document Wizard)

---

### Gap 7: No Cross-PPAP Analytics

**Description:**
- No visibility into document generation velocity
- No identification of common templates
- No bottleneck analysis across PPAPs

**Impact:**
- Cannot identify process improvements
- Cannot predict resource needs
- No data-driven optimization

**Resolution:** Phase 26+ (Cross-PPAP Dashboard)

---

## FORWARD ROADMAP UPDATE (POST PHASE 43)

**Updated:** 2026-03-29 19:59 CT

This section updates the forward roadmap with newly defined tracks: **Orchestration Track** and **Wizard Track**.

---

### ORCHESTRATION TRACK (Phases 44-48)

**Purpose:** Complete coordinator workflow and PPAP definition management

**Phases:**

**Phase 44: PPAP Definition Model**
- Database schema for PPAP definitions
- CRUD API operations
- Integration with existing `ppaps` table

**Phase 45: Coordinator Workflow UI**
- "Create PPAP" wizard
- Customer package upload
- Template selection
- Engineer assignment

**Phase 46: PPAP Initialization Engine**
- Auto-populate PPAP from definition
- Pre-load BOM if in package
- Display workflow sequence

**Phase 47: Engineer Workflow UX Enhancements**
- PPAP context display (origin, assignment)
- Required documents checklist
- Missing documents highlight

**Phase 48: Template Layout Fidelity**
- Excel layout preservation
- Field positioning
- Cell formatting
- Export maintains original layout

**Timeline:** Phases 44-47 (near-term), Phase 48 (long-term)

---

### WIZARD TRACK (Phases W1-W5)

**Purpose:** Build standalone document wizard for unstructured generation

**Phases:**

**Phase W1: Wizard Foundation**
- Route: `/tools/document-wizard`
- Template selection + BOM upload
- Generation pipeline
- Basic export (PDF)

**Phase W2: Template Memory Integration**
- Upload new templates via wizard
- Save to shared registry
- Template selector with all templates

**Phase W3: Export System**
- PDF + Excel export
- File naming conventions
- Download handling

**Phase W4: Template Fingerprinting**
- Hash-based template identity
- Duplicate detection
- Template reuse prompts

**Phase W5: AI-Assisted Parsing (Optional)**
- AI-assisted field extraction
- Structure detection
- Mapping suggestions

**Timeline:** Phases W1-W3 (near-term), Phase W4 (mid-term), Phase W5 (long-term, optional)

---

### PARALLEL DEVELOPMENT STRATEGY

**Orchestration Track and Wizard Track can be developed in parallel:**

**No Dependencies:**
- Wizard phases do not depend on Orchestration phases
- Orchestration phases do not depend on Wizard phases
- Both tracks reuse same engine components

**Shared Components:**
- Template registry (already implemented)
- Mapping engine (already implemented)
- Validation engine (already implemented)
- DocumentEditor (already implemented)

**Development Priority:**
- **High Priority:** Phases W1-W3 (quick wins, high user value)
- **Medium Priority:** Phases 44-46 (coordinator workflow completion)
- **Low Priority:** Phases 47-48, W4-W5 (enhancements)

---

### EXISTING ROADMAP (Phases 22-26+) PRESERVED

**Note:** The original roadmap (Phases 22-26+) defined in earlier sections remains valid. The Orchestration and Wizard tracks are ADDITIVE, not replacements.

**Original Future Phases (Still Valid):**
- Phase 22: Backend Persistence (✅ Implemented)
- Phase 23: User System (✅ Implemented)
- Phase 24: Version Control (✅ Implemented)
- Phase 25: Additional Templates (future)
- Phase 26+: Cross-PPAP Dashboard (future)

**Updated Roadmap Order:**
```
Completed: Phases 1-43
Near-Term: Phases W1-W3 (Wizard), Phases 44-46 (Orchestration)
Mid-Term: Phase W4, Phase 47, Phase 25 (Additional Templates)
Long-Term: Phase 48, Phase W5, Phase 26+ (Analytics)
```

---

## V3.0A — PPAP Document Copilot Strategic Pivot

**Last Updated:** 2026-03-31  
**Status:** Architecture Planning (Documentation Phase)

### Strategic Decision

**The EMIP-PPAP system is pivoting from direct customer workbook autofill as the primary strategy toward a PPAP Document Copilot architecture.**

This is not a replacement of the existing system. This is a strategic evolution of how the system helps operators create PPAP documentation.

### What Is Preserved

**The existing PPAP workflow system remains the orchestration backbone:**

- ✅ PPAP lifecycle management (Intake → Pre-Ack → Ack → Post-Ack → Submission)
- ✅ State machine architecture and workflow boundaries
- ✅ Role-based authority and validation tracking
- ✅ Document tracking and readiness systems
- ✅ File upload and source document handling
- ✅ Progress visibility and audit trails

**All prior implementation work remains valuable:**

- ✅ Workflow structure and guided validation flow
- ✅ Document action system and requirement tracking
- ✅ Export/template investigations (V2.6-V2.9B phases)
- ✅ BOM parsing and document generation experiments
- ✅ Field-level validation and dependency chains

**This is a strategy pivot, not a reset.**

### What Is Changing

**Primary document creation strategy shifts from:**

❌ **Universal direct workbook autofill** (brittle across customer-specific templates)

TO:

✅ **Document-specific AI copilot workflow** (guided drafting with operator judgment)

### Rationale for Pivot

**Technical Assessment:**

1. **Direct workbook reconstruction is brittle**
   - Customer templates vary significantly (Trane vs Rheem vs others)
   - Excel template structure differences require per-customer mapping
   - Layout variations, merged cells, protection metadata cause instability
   - Phases V2.8B-V2.9B demonstrated high maintenance cost for template fidelity

2. **AI performs better in guided document reasoning workflows**
   - Template + BOM + context → structured draft is more reliable than pixel-perfect workbook injection
   - AI can reason about engineering content, ask clarifying questions, flag missing information
   - Operator-guided drafting aligns with human-in-the-loop best practices

3. **Existing PPAP system provides ideal orchestration layer**
   - Document tracking already exists
   - Source file collection already exists
   - Readiness/status logic already exists
   - System already knows what documents are needed and when

4. **Higher near-term ROI with copilot approach**
   - Faster time-to-value than perfecting universal autofill
   - Scales better across document types and customer variations
   - Operator remains responsible for engineering judgment and final quality
   - Reduces cognitive load while preserving authority

**Prior export/template work remains valuable as:**
- Reference implementations for document structure understanding
- Optional future capability for specific high-volume scenarios
- Foundation for output formatting from copilot-generated drafts

---

### Responsibility Split: Workflow Engine vs Document Copilot

**PPAP Workflow Engine Responsibilities (Existing System):**

- ✅ PPAP creation and lifecycle tracking
- ✅ Required element selection (which documents needed)
- ✅ Ownership and assignment (who is responsible)
- ✅ Source file collection and staging (BOM, drawings, templates)
- ✅ Readiness and status tracking (workflow progression)
- ✅ Document vault and audit logging
- ✅ Progress visibility and reporting
- ✅ Pre-ack/post-ack boundary enforcement
- ✅ Submission gating and package assembly

**Document Copilot Responsibilities (New Layer):**

- 🔲 Gather staged inputs for a specific document type
- 🔲 Assemble document-specific prompt context from available sources
- 🔲 Ask clarifying questions before drafting (missing information detection)
- 🔲 Produce structured draft output with confidence tagging
- 🔲 Distinguish information categories:
  - **Known from files** (high confidence, directly extracted)
  - **Inferred/suggested** (medium confidence, AI reasoning)
  - **Requires operator confirmation** (flagged for review)
  - **Insufficient information** (blocks drafting, requests input)
- 🔲 Support iterative refinement (operator feedback → revised draft)
- 🔲 Maintain draft session state and history

**Clear Boundary:**
- Workflow engine **ORCHESTRATES** (what, when, who)
- Document copilot **ASSISTS** (how to create specific document content)

---

### Initial Rollout Scope

**In Scope for Early Implementation (V3.0B-V3.0E):**

- ✅ Document copilot launcher concept and UI integration
- ✅ Document type profile configuration system
- ✅ Source file staging interface per document
- ✅ Prompt assembly engine for copilot sessions
- ✅ Structured Q&A capture and response handling
- ✅ Structured draft output capture with confidence tagging
- ✅ Draft-to-document handoff workflow
- ✅ Session state persistence and recovery

**Initial Pilot Document Targets:**

1. **Process Flow** (first pilot)
   - Well-defined structure (STEP, Operation, Machine, etc.)
   - BOM-driven process step generation
   - Clear input requirements (BOM, template, routing context)

2. **Control Plan** (second pilot)
   - Depends on Process Flow output
   - Structured characteristic and control method definition
   - Tests cross-document dependency handling

**Out of Scope for Early Implementation:**

- ❌ Full automation of all PPAP deliverables
- ❌ Autonomous engineering decisions without operator oversight
- ❌ Universal direct autofill for all Trane workbook sheets
- ❌ Final submission automation (human approval required)
- ❌ Replacing the existing PPAP workflow engine
- ❌ Copilots for all 9+ document types (start with 2 pilots)

---

### Document Profile Planning Model

**Each document type requires a profile that defines copilot behavior.**

**Document Profile Schema (Planning Specification):**

```typescript
interface DocumentProfile {
  // Identity
  documentType: string;           // e.g., 'process_flow', 'control_plan'
  displayName: string;             // e.g., 'Process Flow Diagram'
  
  // Input Requirements
  requiredInputs: string[];        // Must be present to start copilot
  optionalInputs: string[];        // Helpful but not required
  knownSystemData: string[];       // Data system already has (PPAP context)
  
  // Guidance
  humanJudgmentAreas: string[];    // Where operator expertise critical
  starterPromptTemplate: string;   // Initial prompt structure for AI
  expectedOutputFormat: string;    // Structure of draft output
  
  // Safety
  warnings: string[];              // Important caveats for operators
  completionCriteria: string[];    // What defines a "complete" draft
}
```

**Profile Purpose:**

1. **Configure copilot behavior** per document type
2. **Define input staging requirements** (what files/data needed)
3. **Structure AI prompts** with document-specific context
4. **Guide operator interaction** with document-appropriate questions
5. **Validate completeness** before allowing draft handoff

**Implementation Note:**

Profiles should be:
- Configuration-driven (JSON or TypeScript config files)
- Extensible (easy to add new document types)
- Version-controlled (profiles evolve with learning)

---

### Starter Document Profiles (Planning Level)

#### Profile 1: Process Flow Diagram

**Document Type:** `process_flow`  
**Display Name:** Process Flow Diagram

**Required Inputs:**
- BOM file (CSV or parsed data)
- Customer template (Excel file) or template selection
- Part number and PPAP context

**Optional Inputs:**
- Engineering drawing (for operation reference)
- Prior example Process Flow (for routing pattern)
- Routing notes or manufacturing context
- Process step suggestions from engineer

**Known System Data:**
- PPAP number
- Part number and revision
- Customer name
- Plant/build site
- Engineer and coordinator names
- Parsed BOM components and operations (if available)

**Human Judgment Areas:**
- **Routing sequence** (order of manufacturing operations)
- **Inspection point inclusion** (where to inspect, what to measure)
- **Scrap/rework handling** (when operations are conditional)
- **Process-specific steps** (operations unique to this part/assembly)
- **Symbol assignment** (operation vs inspection vs transport vs storage)

**Starter Prompt Template:**
```
You are assisting an engineer in creating a Process Flow Diagram for a PPAP submission.

CONTEXT:
- Part Number: {partNumber}
- Customer: {customer}
- BOM Components: {bomSummary}

TASK:
Generate a proposed process flow with the following columns:
- STEP (sequential number)
- Routing Number
- Operation Description
- Machine/Equipment
- Notes/Parameters

For each operation, suggest:
1. Operation type (assembly, inspection, transport, etc.)
2. Equipment/tooling needed
3. Key process parameters

FLAG any areas where you need clarification or where engineering judgment is critical.

OUTPUT FORMAT: Structured JSON with step array and open questions array.
```

**Expected Output Format:**
```json
{
  "proposedSteps": [
    {
      "stepNumber": 1,
      "operation": "Receive components",
      "machine": "Receiving dock",
      "notes": "Visual inspection of packaging",
      "confidence": "high",
      "symbol": "inspection"
    }
  ],
  "openQuestions": [
    "Should step 3 include a dimensional inspection point?",
    "What is the scrap/rework routing for failed welds?"
  ],
  "assumptions": [
    "Assumed welding occurs before final assembly based on BOM structure"
  ]
}
```

**Warnings:**
- Copilot suggestions are starting points, not final engineering decisions
- Operator must verify routing sequence matches manufacturing reality
- Symbol assignments (operation/inspection/etc.) require operator confirmation
- Equipment and tooling must be validated against plant capabilities

**Completion Criteria:**
- All process steps have operations defined
- Open questions answered by operator
- Draft approved by operator for export/refinement

---

#### Profile 2: Control Plan

**Document Type:** `control_plan`  
**Display Name:** Control Plan

**Required Inputs:**
- BOM file (or reference to existing)
- Customer template (Excel file) or template selection
- Process Flow (completed or in-progress) for step context
- Part number and PPAP context

**Optional Inputs:**
- Engineering drawing (for critical features/dimensions)
- Prior example Control Plan (for control method patterns)
- Critical feature notes from engineer
- Measurement equipment list

**Known System Data:**
- PPAP number
- Part number and revision
- Customer name
- Plant/build site
- Engineer and coordinator names
- Parsed BOM/process step data (if available from Process Flow)

**Human Judgment Areas:**
- **Characteristic identification** (what to control at each step)
- **Control methods** (how to measure/verify each characteristic)
- **Sample size and frequency** (how often to inspect)
- **Reaction plans** (what to do when out of spec)
- **Critical-to-quality interpretation** (which features are most important)
- **Specification limits** (tolerance ranges from drawing)

**Starter Prompt Template:**
```
You are assisting an engineer in creating a Control Plan for a PPAP submission.

CONTEXT:
- Part Number: {partNumber}
- Customer: {customer}
- Process Steps: {processFlowSummary}

TASK:
For each process step, propose:
1. Characteristics to control (dimensions, visual, functional)
2. Control method (measurement tool, inspection type)
3. Sample size and frequency
4. Specification limits (if available from drawing)
5. Reaction plan (corrective action if out of spec)

FLAG any characteristics that require:
- Drawing reference to determine spec limits
- Special measurement equipment
- Operator judgment on criticality

OUTPUT FORMAT: Structured JSON with control plan rows and flagged items.
```

**Expected Output Format:**
```json
{
  "controlPlanRows": [
    {
      "processStep": 1,
      "characteristic": "Component spacing",
      "controlMethod": "Caliper measurement",
      "sampleSize": "5 per batch",
      "frequency": "First article + every 50 units",
      "specLimits": "NEEDS DRAWING REFERENCE",
      "reactionPlan": "Hold lot, notify supervisor, rework if possible",
      "confidence": "medium"
    }
  ],
  "flaggedItems": [
    "Spec limits for component spacing require drawing reference",
    "Reaction plan for welding defects needs operator input"
  ],
  "assumptions": [
    "Assumed visual inspection sufficient for cosmetic features"
  ]
}
```

**Warnings:**
- Copilot cannot determine spec limits without drawing analysis
- Control methods must match available measurement equipment at plant
- Sample size and frequency require engineering judgment based on risk
- Reaction plans must align with manufacturing procedures

**Completion Criteria:**
- All process steps have control rows defined
- Spec limits filled in (from drawing or operator input)
- Flagged items resolved by operator
- Draft approved by operator for export/refinement

---

### Phase Sequencing (V3.0 Roadmap)

**Phase V3.0A: Strategic Pivot + Document Profile Planning** ✅ (Current Phase)
- Document the copilot pivot in BUILD_PLAN
- Define responsibility split (workflow engine vs copilot)
- Define document profile planning model
- Create starter profiles for Process Flow and Control Plan
- **Deliverable:** Updated BUILD_PLAN and BUILD_LEDGER (documentation only)

**Phase V3.0B: Document Profile Configuration + Copilot Launcher**
- Implement document profile configuration system (JSON/TypeScript)
- Add copilot launcher UI in DocumentWorkspace
- Create "Start Copilot" action alongside Upload/Create
- Profile-driven copilot session initialization
- **Deliverable:** Copilot entry point integrated into existing document UI

**Phase V3.0C: Source File Staging + Prompt Builder**
- Source file staging interface per document profile
- Prompt assembly engine using profile templates
- Context gathering from PPAP record + staged files
- Input validation against profile requirements
- **Deliverable:** Copilot session can gather inputs and build prompts

**Phase V3.0D: Copilot Workspace + Q&A + Draft Capture**
- Copilot chat/workspace UI for operator interaction
- Structured Q&A capture and response handling
- Draft output capture with confidence tagging
- Iterative refinement support (operator feedback → revised draft)
- **Deliverable:** Full copilot session workflow operational

**Phase V3.0E: Document Status Integration + Operator Handoff**
- Draft-to-document handoff workflow
- Update document status when draft captured
- Integration with existing document action system
- Session state persistence and recovery
- **Deliverable:** Copilot drafts integrate seamlessly with PPAP workflow

**Future Phases (V3.0F+):**
- Additional document profiles (DFMEA, MSA, Dimensional Results)
- Cross-document context passing (Process Flow → Control Plan)
- Template output formatting (copilot draft → Excel template)
- Advanced confidence scoring and validation
- Learning/feedback loop for profile improvement

---

### Integration with Existing System

**Copilot integrates with PPAP workflow at document action level:**

```
[Document Card: Process Flow]
├─ Status: Missing
├─ Actions:
│  ├─ Upload (existing)
│  ├─ Create (placeholder - existing)
│  └─ Start Copilot (NEW - V3.0B)
└─ Copilot Session:
   ├─ Stage Inputs (BOM, template, context)
   ├─ Answer Questions (guided Q&A)
   ├─ Review Draft (structured output)
   └─ Accept/Refine (handoff to document system)
```

**Key Integration Points:**

1. **Document Action System** (Phase 3F.14)
   - Add 'copilot' to actions array for supported documents
   - Copilot becomes third creation path alongside upload/create

2. **Document Status Tracking**
   - Copilot draft completion updates document status to 'ready'
   - Draft stored as document session data (JSON)

3. **Source File Staging**
   - Reuse existing file upload infrastructure
   - Copilot sessions reference staged files by PPAP ID + document type

4. **PPAP Context Passing**
   - Copilot prompt builder reads PPAP record (part number, customer, etc.)
   - No duplicate data entry required

**No Breaking Changes:**
- Upload path remains available (external documents, operator preference)
- Existing document generation experiments preserved
- Copilot is additive, not replacement

---

### Success Metrics (Post-Implementation)

**Pilot Phase Success Criteria:**

1. **Operator Adoption**
   - 50%+ of Process Flow documents use copilot in first month
   - Positive operator feedback on time savings

2. **Draft Quality**
   - 80%+ of copilot drafts accepted with minor edits
   - Reduced iteration cycles vs manual creation

3. **Time Savings**
   - 30%+ reduction in time-to-first-draft for Process Flow
   - Measured via session timestamps and operator surveys

4. **Engineering Quality**
   - No increase in PPAP rejections due to copilot-assisted documents
   - Operator retains final approval authority

**System Stability:**
- Copilot sessions do not disrupt existing workflow
- Fallback to upload/manual creation always available
- No impact on PPAP lifecycle tracking or submission gating

---

### Governance Rules for V3.0 Implementation

**MUST Preserve:**
- ✅ PPAP workflow engine as single source of truth for status/lifecycle
- ✅ Pre-ack/post-ack boundary (copilot only available post-ack)
- ✅ Document requirement tracking and submission gating
- ✅ Operator authority for final approval (AI assists, human decides)

**MUST Implement:**
- ✅ Document profiles as configuration (not hardcoded)
- ✅ Confidence tagging on all AI-generated content
- ✅ Clear distinction between known/inferred/uncertain information
- ✅ Session state persistence (copilot sessions survive page reload)

**MUST NOT:**
- ❌ Replace PPAP workflow engine or bypass existing tracking
- ❌ Auto-approve or auto-submit copilot-generated documents
- ❌ Make autonomous engineering decisions without operator input
- ❌ Remove upload or manual creation paths

---

### Technical Architecture Notes

**Copilot Session Model:**

```typescript
interface CopilotSession {
  id: string;
  ppapId: string;
  documentType: string;
  profile: DocumentProfile;
  
  stagedInputs: {
    files: FileReference[];
    systemData: Record<string, any>;
    operatorInputs: Record<string, any>;
  };
  
  conversation: {
    messages: Message[];
    questions: Question[];
    responses: Response[];
  };
  
  draft: {
    content: any; // Profile-specific structured output
    confidence: Record<string, ConfidenceLevel>;
    timestamp: string;
  };
  
  status: 'staging' | 'gathering' | 'drafting' | 'complete';
}
```

**Profile Storage:**

Profiles should live in:
```
src/features/documentCopilot/profiles/
├─ processFlow.profile.ts
├─ controlPlan.profile.ts
└─ index.ts (profile registry)
```

**UI Integration:**

Copilot UI should be:
- Modal or slide-over (non-disruptive)
- Closeable with session state saved
- Resumable from document card

---

## V3.1A — Engineer Command Center Architecture

**Last Updated:** 2026-03-31  
**Status:** Architecture Planning (Documentation Phase)

### Strategic Layer Addition

**The EMIP-PPAP system is introducing a new user-centric "Engineer Command Center" layer as the third conceptual architecture layer alongside the PPAP-centric workflow system and Document Copilot architecture.**

This is not a replacement of the PPAP workspace model. It is a complementary user-centric operating surface that aggregates all of a user's assignments, documents, messages, and work-in-progress across PPAPs into a single, coherent command view.

### The Three-Layer Architecture Model

The future EMIP-PPAP system is architected as three distinct but complementary layers:

#### Layer 1: Global / Organizational PPAP Layer

**Purpose:** System-wide visibility and management

**Scope:**
- All PPAPs in the system
- Management, coordination, and QA visibility
- Organizational workload distribution
- System-wide status dashboards
- Cross-PPAP analytics and reporting

**Primary Users:**
- Coordinators (assigning, monitoring, managing)
- QA (reviewing, approving, auditing)
- Management (workload visibility, capacity planning)

**Entry Points:**
- `/ppap` — PPAP listing/dashboard
- `/ppap/dashboard` — Management dashboard
- Coordinator assignment interfaces

#### Layer 2: PPAP Workspace Layer

**Purpose:** One PPAP at a time — contextual execution

**Scope:**
- Document statuses for a specific PPAP
- PPAP-specific files, actions, notes
- PPAP-bound copilot sessions
- Pre-ack/post-ack workflow execution
- Document creation within PPAP context
- Validation and readiness tracking

**Primary Users:**
- Engineers (working on assigned PPAPs)
- Coordinators (reviewing specific PPAPs)

**Entry Points:**
- `/ppap/[id]` — PPAP detail/workspace
- `/ppap/[id]/documents` — Document workspace for PPAP

**Key Characteristics:**
- Contextual (knows which PPAP you're in)
- Document-action oriented
- Workflow-governed (ack gates, readiness rules)
- Audit-friendly (all actions tied to PPAP)

#### Layer 3: User Command Center Layer (NEW)

**Purpose:** Everything assigned to one user — personal operating cockpit

**Scope:**
- Cross-PPAP view of workload and assignments
- All drafts in progress (regardless of PPAP)
- Active copilot sessions awaiting user attention
- Messages, notifications, and requests
- Recent work history and resumable items
- Quick actions for common workflows

**Primary Users:**
- Engineers (daily work management)
- Coordinators (personal task tracking)
- Any user needing a consolidated operating view

**Entry Point:**
- `/command-center` or `/my-workspace` — Personal command surface

**Key Characteristics:**
- User-centric (my work, my documents, my sessions)
- Cross-PPAP visibility (sees all assigned work)
- Action-oriented (what needs my attention now)
- Resumption-friendly (pick up where I left off)
- Efficient (minimize navigation between PPAPs just to find work)

---

### Purpose of the Engineer Command Center

The Command Center exists to answer these questions for each user:

**Immediate Attention:**
- What do I need to work on right now?
- What is blocked and waiting on me?
- What is ready for my review or action?
- Which items have approaching deadlines?

**Work Management:**
- What documents are still in draft awaiting confirmation?
- Which copilot sessions have unresolved AI questions?
- What have I recently worked on that I might need to resume?
- What PPAPs am I responsible for across the system?

**Communication:**
- What messages, mentions, or feedback require my attention?
- What document review requests are pending?
- What reassignment notices or system alerts do I have?

**Efficiency:**
- Can I resume my last draft without navigating through multiple PPAPs?
- Can I launch a document copilot quickly?
- Can I see everything needing my attention without opening each PPAP individually?

**Strategic Shift:**
This represents a shift from a purely **object-centric workflow model** (navigate to PPAP → find work → do work) to a **user-centric operating model** (see all my work → prioritize → act → context loaded automatically).

---

### Core UX Principles

The Engineer Command Center must be designed according to these principles:

#### 1. One Home Base Per User
- Each user has a primary operating surface
- This is the default landing after login for most daily users
- Users should prefer to start here rather than bypassing the system

#### 2. Cross-PPAP Visibility
- See all assigned work regardless of which PPAP it belongs to
- Documents, drafts, sessions, and messages aggregated across contexts
- No need to open each PPAP individually just to check status

#### 3. Fast Resumption of In-Progress Work
- One-click resume of last draft, session, or document
- Preserve context and state across sessions
- Minimize friction to get back to productive work

#### 4. Strong Visibility Into Blockers and Waiting Items
- Clear indicators of what is blocked and why
- Visibility into what is waiting on the user vs. waiting on others
- Priority and due-date awareness

#### 5. Persistent Awareness of Copilot Sessions
- Active guided sessions always visible
- Unresolved AI questions surfaced prominently
- Draft outputs not yet finalized highlighted for attention

#### 6. Minimal Navigation for Common Actions
- Quick actions for most frequent workflows
- Launch copilot, open PPAP, resume draft without deep navigation
- Surface-level efficiency for daily operations

#### 7. Useful Enough to Become Preferred Entry Point
- **Critical Principle:** The Command Center should be so useful that users prefer to enter here
- Better than checking email for PPAP updates
- Better than browsing SharePoint for documents
- Better than manual status tracking
- The system should become the place users WANT to enter because it is the most efficient place to operate from

#### 8. Complementary, Not Replacement
- PPAP workspaces remain essential for contextual execution
- Command Center provides the launchpad; PPAP workspace provides the workbench
- Both are needed; neither replaces the other

---

### Command Center Information Domains

The Command Center must eventually support the following major information domains/panels:

#### Domain A: My Work

**Purpose:** Aggregated actionable assignments across all PPAPs

**Content:**
- PPAPs assigned to me (with status indicators)
- Documents assigned to me for creation/review
- Actionable work items (things I can act on now)
- Due dates and priority indicators
- Blocked / waiting / ready status for each item

**Key Features:**
- Group by PPAP or group by action type (configurable)
- Filter by status, priority, deadline
- Quick open to PPAP workspace
- One-click to start copilot session

#### Domain B: My Documents

**Purpose:** Cross-PPAP visibility of all my document work

**Content:**
- Drafts in progress (by me or awaiting my input)
- Documents awaiting my answers (copilot questions)
- Documents awaiting my review or finalization
- Recent document outputs (completed)
- Cross-PPAP visibility of document state

**Categorization:**
- **Active Drafts:** Currently being worked
- **Pending Review:** Draft complete, needs my approval
- **Awaiting Input:** Copilot or workflow waiting on me
- **Recently Completed:** Finished but still referenceable

#### Domain C: My Copilot Sessions

**Purpose:** All active and resumable copilot work

**Content:**
- Active guided sessions (by PPAP context or standalone)
- Unresolved AI questions requiring my answers
- Draft outputs not yet finalized
- Resumable document work (sessions I can pick back up)
- Session history by document type and PPAP

**Session Types Visible:**
- PPAP-bound sessions (tied to specific PPAP documents)
- Standalone/freeform sessions (personal workspace work)
- Both surfaced in unified view

#### Domain D: Messages / Notifications / Requests

**Purpose:** All communication requiring my attention

**Content:**
- Direct mentions (@username in comments/notes)
- QA feedback on my documents
- Reassignment notices (new PPAPs assigned to me)
- Document review requests (someone needs my review)
- System alerts (deadlines, status changes)
- Actionable notifications without opening each PPAP

**Priority Indicators:**
- Urgent (blocking, time-sensitive)
- Important (needs attention soon)
- Informational (FYI, no action required)

#### Domain E: Recent Activity / History

**Purpose:** Personal work history and audit trail

**Content:**
- What I worked on recently (timestamped)
- Document completions and submissions
- PPAP actions (acknowledgements, status updates)
- Review and finalization actions
- Session completions

**Utility:**
- "What was I working on yesterday?"
- Time tracking support
- Personal productivity review
- Audit trail for my actions

#### Domain F: Quick Actions

**Purpose:** Fastest path to common workflows

**Actions:**
- Open most recently assigned PPAP
- Resume last draft (pick up exactly where I left off)
- Launch document copilot (guided mode)
- Create document outside PPAP (standalone/freeform)
- Open freeform workspace
- Start common document types quickly (Process Flow, Control Plan)
- Jump to coordinator/admin functions (if applicable)

**Smart Defaults:**
- Surface actions based on my role and recent activity
- Context-aware (suggest what I'm likely to want next)

---

### Integration with V3.0A Document Copilot

The Command Center must surface copilot work from both contexts:

#### Context 1: PPAP-Bound Document Copilot Work

**Characteristics:**
- Tied to a specific PPAP
- Governed by workflow/document requirements
- Audit-friendly (part of PPAP record)
- Follows PPAP lifecycle (pre-ack/post-ack rules)

**Surfaced in Command Center:**
- Appears in "My Documents" with PPAP context
- Appears in "My Copilot Sessions" with PPAP badge
- Actions navigate to `/ppap/[id]/documents` with session restored
- All work tracked in PPAP audit trail

#### Context 2: Standalone Document Workspace / Freeform Work

**Characteristics:**
- Not necessarily tied to an active PPAP
- Accessible directly by user from their Command Center
- Supports guided document starts OR open-ended file-based chat work
- Flexible, personal workspace model

**Modes Supported:**

**A. Guided Mode (launched from Command Center)**
- User selects document type (Process Flow, Control Plan, etc.)
- System loads profile and prompts for inputs
- Prescribed prompting and structured output
- Audit-friendly when later attached to PPAP

**B. Freeform Workspace Mode**
- User uploads any files
- User can use document templates, starter prompts, or fully freeform chat
- Open-ended engineering assistant workspace
- No required PPAP context (can attach later)
- Intentionally flexible for exploration and experimentation

**Key Principle:**
Both guided and freeform modes are powered by the same core copilot engine, but governed differently:
- **Guided mode:** Profile-driven, structured, audit-friendly
- **Freeform mode:** Flexible, exploratory, user-directed

**Command Center Integration:**
- Standalone sessions appear in "My Copilot Sessions"
- No PPAP badge (or "Standalone" indicator)
- Can be resumed independently
- Can be "attached" to a PPAP later if desired

---

### Entry Modes and Navigation Model

Users should be able to enter the system in multiple ways, depending on their needs:

#### Entry Mode 1: Global PPAP Dashboard / System View

**Route:** `/ppap`, `/ppap/dashboard`  
**Use Case:** Management, coordination, seeing all PPAPs  
**Starts At:** Global layer

#### Entry Mode 2: Specific PPAP Workspace

**Route:** `/ppap/[id]`, `/ppap/[id]/documents`  
**Use Case:** Working on one specific PPAP  
**Starts At:** PPAP workspace layer  
**Navigation:** Can jump to Command Center from here

#### Entry Mode 3: User Command Center (Recommended Default)

**Route:** `/command-center` or `/my-workspace`  
**Use Case:** Daily work management, seeing all assignments  
**Starts At:** Command Center layer  
**Should become the default landing for most daily users**

#### Entry Mode 4: Standalone Document Workspace

**Route:** `/workspace` or `/document-workspace`  
**Use Case:** Freeform document work, exploration  
**Starts At:** Standalone workspace  
**Accessible from Command Center "Quick Actions"

#### Navigation Model Principles

**Command Center as Default Home:**
- Most users should land in Command Center after login
- From there, they navigate to specific PPAPs as needed
- Return to Command Center to switch contexts

**Context Preservation:**
- When navigating from Command Center to PPAP, load the PPAP workspace
- When navigating from PPAP to Command Center, return to Command Center
- State preserved in both directions

**Quick Return:**
- Always a way to get back to Command Center from any PPAP workspace
- Breadcrumb: "Command Center > PPAP-1234 > Documents"

---

### Draft / Final / Export Lifecycle Expectations

**Critical Architecture Principle:**

AI/copilot outputs should NOT default to downloading to a user's local Downloads folder as the primary behavior. The system should support a full draft-to-final lifecycle.

#### Stage 1: Draft Output (Internal System State)

**Characteristics:**
- AI-generated output exists first as an internal draft
- Visible, reviewable, editable inside the system
- Tied to PPAP context OR standalone workspace context
- Stored in system (not immediately exported)
- Can be iterated on (revised, refined, rejected)

**System Behavior:**
- Draft appears in user's "My Documents" with status "Draft"
- Draft linked to copilot session history
- Draft editable inline or in document editor
- Draft not yet "finalized" or "committed"

#### Stage 2: Finalized Output (System-Owned)

**Characteristics:**
- After user review and approval
- Stored internally in system/workspace/PPAP record
- Becomes traceable source of truth
- Immutable (versioned if changes needed)
- Linked to PPAP document requirement (if applicable)

**System Behavior:**
- User clicks "Finalize" or "Approve"
- Draft status changes to "Finalized"
- Document now considered "complete" for PPAP tracking
- Appears as completed document in PPAP workspace
- Stored in document vault with metadata

#### Stage 3: Export / Download (Optional, Secondary)

**Characteristics:**
- Manual user action (explicit request)
- Should be secondary, not the primary destination
- Downloads formatted output (Excel, PDF, etc.)
- Local copy for external use
- System retains master copy

**System Behavior:**
- "Export" or "Download" button available on finalized documents
- Triggers export process (V2.6+ template injection, etc.)
- Download occurs but system copy remains authoritative
- Export logged for audit trail

#### Benefits of This Lifecycle

**Auditability:**
- Full history of drafts, revisions, and finalization
- Clear trail of human approval before finalization
- Copilot contributions tracked separately from human edits

**Version Control:**
- Draft iterations visible
- Can revert to previous draft if needed
- Finalized versions immutable

**Reuse:**
- Finalized documents can be referenced, copied, or adapted
- Drafts can be forked for alternative approaches
- Historical work searchable and referenceable

**Collaboration:**
- Multiple users can see drafts (if permissions allow)
- Review and comment before finalization
- Handoff between team members supported

**Traceability:**
- Every document linked to its creation context (PPAP, copilot session, user)
- Clear lineage from AI draft → human review → final output

---

### High-Level Data Model Requirements (Planning Only)

**This is documentation-level architecture only. No DB schemas or implementation code.**

Logical entities and relationships the Command Center will need to aggregate:

#### Per User (Command Center Context)

```typescript
interface UserCommandCenterContext {
  userId: string;
  
  // Assignments
  assignedPPAPs: PPAPReference[];
  assignedDocuments: DocumentReference[];
  
  // Active Work
  activeDocuments: DocumentWorkItem[];
  activeCopilotSessions: CopilotSession[];
  
  // Notifications
  notifications: Notification[];
  unreadCount: number;
  
  // Recent History
  recentActivity: ActivityItem[];
  recentDocuments: DocumentReference[];
  
  // Preferences/State
  quickActionPreferences: QuickActionConfig[];
  defaultView: 'work' | 'documents' | 'sessions' | 'messages';
}
```

#### Per Document Work Item

```typescript
interface DocumentWorkItem {
  id: string;
  documentType: string;
  displayName: string;
  
  // Context (one or both)
  parentPPAP?: PPAPReference;      // PPAP-bound
  standaloneContext?: WorkspaceContext;  // Standalone
  
  // Status
  status: 'draft' | 'review' | 'awaiting_input' | 'finalized';
  
  // Content
  sourceFiles: FileReference[];
  draftOutput?: DraftContent;
  finalOutput?: FinalContent;
  
  // Questions/Blockers
  unresolvedQuestions: Question[];
  
  // Ownership
  assignedOwner: UserReference;
  createdAt: string;
  updatedAt: string;
  
  // Related Session
  copilotSessionId?: string;
}
```

#### Per Copilot Session

```typescript
interface CopilotSession {
  id: string;
  mode: 'guided' | 'freeform';
  
  // Related Context
  relatedDocumentType?: string;
  relatedPPAP?: PPAPReference;
  standaloneContext?: WorkspaceContext;
  
  // Conversation State
  questions: Question[];
  answers: Response[];
  
  // Draft State
  draftState?: DraftState;
  finalizationState?: FinalizationState;
  
  // Timestamps
  startedAt: string;
  lastActivityAt: string;
  
  // Status
  status: 'active' | 'paused' | 'completed' | 'abandoned';
}
```

#### Key Relationships

**User → PPAPs:**
- Many-to-many (user can have multiple assigned PPAPs)
- Role-dependent (engineer assigned, coordinator managing, QA reviewing)

**User → Documents:**
- Many-to-many (user can have documents across multiple PPAPs)
- Ownership-based (assigned owner, creator, reviewer)

**User → Copilot Sessions:**
- One-to-many (user can have multiple active sessions)
- Context-based (PPAP-bound or standalone)

**Documents → Copilot Sessions:**
- One-to-many (document can have multiple session iterations)
- Session creates or updates document draft

**Command Center Aggregation Logic:**
- Query all PPAPs where user is assigned
- Query all documents where user is owner across those PPAPs
- Query all copilot sessions where user is participant
- Query all notifications for user
- Aggregate into unified view with status indicators

---

### Initial Scope Boundaries

#### In Scope for Initial Implementation Wave (V3.1B-V3.1E)

**Core Command Center Surface:**
- User home/command surface concept and route
- Aggregated "My Work" view (assigned PPAPs and documents)
- Cross-PPAP document visibility
- Basic copilot session resumption visibility
- Navigation to PPAP workspaces

**Notification/Messaging Planning:**
- Notification data model planning
- Message types and delivery mechanisms
- Integration points with existing PPAP events

**Quick Actions:**
- Quick action panel concept
- Launch copilot, open PPAP, resume draft
- Relationship to standalone workspace

**Standalone Workspace Relationship:**
- How standalone/freeform work surfaces in Command Center
- Attachment of standalone work to PPAPs
- Context switching between modes

#### Likely Deferred for Later Waves

**Advanced Features:**
- Deep personalization and user preference learning
- Workload analytics and capacity visualization
- Team collaboration features (shared views, handoffs)
- AI-driven prioritization recommendations
- Advanced search and filtering intelligence
- Multi-role custom dashboard composition
- Predictive workload balancing
- External system integration (email, Slack, Teams)

**Rationale:**
- Keep initial implementation tight and focused
- Deliver core value (aggregated work visibility) first
- Advanced features can be added incrementally
- Avoid over-engineering before user feedback

---

### Relationship to Existing Work

**The Engineer Command Center is:**

✅ **Layered on top of existing systems**
- Uses PPAP workflow engine for orchestration
- Uses document engine for document management
- Uses copilot engine for AI assistance
- Does not replace any of these

✅ **An evolution, not a rewrite**
- Builds on existing workflow structure
- Builds on existing document tracking
- Builds on existing readiness systems
- Builds on V3.0A Document Copilot planning

✅ **Complementary to PPAP workspaces**
- PPAP workspaces remain essential for contextual work
- Command Center provides the launchpad
- Both needed; neither replaces the other

**Prior work that remains foundational:**
- ✅ PPAP workflow system (state machine, validation, lifecycle)
- ✅ Document tracking and requirement classification
- ✅ Document action system (upload, create, copilot)
- ✅ Document engine (BOM parsing, field validation)
- ✅ V3.0A Document Copilot architecture
- ✅ Source file collection and staging

**No Code Changes in V3.1A:**
This phase is strictly documentation and architecture planning. No application code, UI components, routes, or database changes are made.

---

### Phase Sequencing (V3.1 Roadmap)

**Phase V3.1A: Engineer Command Center Architecture Planning** ✅ (Current Phase)
- Document 3-layer architecture model
- Define Command Center purpose and UX principles
- Define information domains (My Work, My Documents, My Copilot Sessions, Messages, History, Quick Actions)
- Document integration with V3.0A Document Copilot
- Define entry modes and navigation model
- Define draft/final/export lifecycle expectations
- Define data model requirements (planning level)
- Define scope boundaries for implementation
- **Deliverable:** Updated BUILD_PLAN and BUILD_LEDGER (documentation only)

**Phase V3.1B: Command Center Data Aggregation Model + Route/Shell**
- Implement data aggregation logic (query across PPAPs, documents, sessions)
- Create `/command-center` route and shell layout
- Basic panel structure (My Work, My Documents placeholders)
- User context and permission integration
- **Deliverable:** Command Center route exists with basic structure

**Phase V3.1C: My Work + My Documents First Implementation Wave**
- "My Work" panel: Assigned PPAPs and documents with status
- "My Documents" panel: Cross-PPAP document visibility
- Basic filtering and sorting
- Quick actions (open PPAP, start copilot)
- **Deliverable:** Core work visibility functional

**Phase V3.1D: Copilot Session Integration + Notifications Surface**
- "My Copilot Sessions" panel with session resumption
- Surface active sessions from both PPAP-bound and standalone contexts
- Basic notifications/messages surface (mentions, requests)
- Session state persistence across navigation
- **Deliverable:** Copilot and messaging integrated

**Phase V3.1E: Standalone Workspace Integration + Quick Actions**
- Standalone/freeform workspace route (`/workspace`)
- Relationship to Command Center (launch from quick actions)
- Attachment of standalone work to PPAPs
- Full quick actions panel with smart defaults
- **Deliverable:** Standalone mode and quick actions operational

**Future Phases (V3.1F+):**
- History and activity tracking
- Advanced personalization
- Workload analytics
- Team collaboration features
- AI-driven prioritization
- Advanced search

---

### Governance Rules for V3.1 Implementation

**MUST Preserve:**
- ✅ PPAP workflow engine as single source of truth
- ✅ Document action system (upload, create, copilot)
- ✅ Pre-ack/post-ack boundary
- ✅ PPAP workspace as contextual execution environment
- ✅ V3.0A Document Copilot architecture

**MUST Implement:**
- ✅ Command Center as additive layer (not replacement)
- ✅ Clear navigation between layers
- ✅ State preservation across context switches
- ✅ Draft/final/export lifecycle (not auto-download)

**MUST NOT:**
- ❌ Replace PPAP workspaces or bypass workflow tracking
- ❌ Remove document upload or manual creation paths
- ❌ Auto-export AI drafts to Downloads as primary behavior
- ❌ Break existing PPAP lifecycle or validation rules

---

### Success Metrics (Post-Implementation)

**Adoption Metrics:**
- 70%+ of daily users enter via Command Center (vs. direct PPAP navigation)
- 50%+ reduction in time to find assigned work
- Positive user feedback on "where do I start my day?"

**Efficiency Metrics:**
- Average time to resume in-progress work < 30 seconds
- Average time to find specific document < 60 seconds
- 40%+ reduction in "I didn't know that was assigned to me" issues

**System Stability:**
- No degradation in PPAP workflow functionality
- No impact on document copilot performance
- Seamless context switching between Command Center and PPAP workspaces

**User Satisfaction:**
- Command Center becomes preferred entry point
- Users report feeling "more in control of their workload"
- Reduced email/Slack traffic for status updates (system provides visibility)

---

## V3.2A — System Domain Map

**Last Updated:** 2026-04-01  
**Status:** Execution-Grade Architecture (Enforcement Pass Complete)

### Purpose

**The EMIP-PPAP system requires explicit domain boundaries to prevent architectural drift, overlapping responsibilities, and unclear data ownership as the platform evolves.**

As the system grows to include:
- PPAP workflow system (established)
- Document Copilot system (V3.0A)
- Engineer Command Center (V3.1A)
- EMIP (SKU/component intelligence)
- User Workspace/Vault system

There is increasing risk of:
- **Overlapping responsibilities** — multiple domains trying to control the same data
- **Duplicated data ownership** — confusion about which system is source of truth
- **Unclear system authority** — ambiguous decision-making boundaries
- **Future architectural drift** — gradual erosion of separation of concerns

This domain map establishes clear boundaries, explicit ownership contracts, and anti-drift rules to maintain architectural integrity.

---

### Domain Overview

The EMIP-PPAP platform consists of **six distinct system domains**, each with clearly defined responsibilities and ownership boundaries:

| Domain | Purpose | Primary Concern |
|--------|---------|-----------------|
| **Core Platform** | Foundation layer | Identity, access, storage primitives |
| **PPAP Workflow** | Workflow orchestration | PPAP lifecycle, assignments, status |
| **Document Copilot** | AI-assisted creation | Draft generation, Q&A flows |
| **Command Center** | User operating surface | Aggregated visibility, task management |
| **Workspace/Vault** | File management | Storage, organization, retrieval |
| **EMIP** | Product intelligence | SKUs, components, relationships |

Each domain is a **separate, independent responsibility layer** with explicit contracts for what it owns, what it consumes, and what it produces.

---

## 1. Core Platform Domain

### Purpose

Foundational system layer providing identity, access control, storage primitives, and notification infrastructure used by all other domains.

### Owns (Authoritative Control)

| Entity | Ownership |
|--------|-----------|
| **Users** | User accounts, profiles, credentials |
| **Authentication** | Login sessions, tokens, auth state |
| **Permissions** | Role definitions, access rules, grants |
| **Global Storage Primitives** | Blob storage abstraction, file references |
| **Notification Infrastructure** | Delivery mechanisms, channels, preferences |

**Single Source of Truth For:**
- Who can access the system (users)
- What they can do (permissions)
- How they prove identity (authentication)
- Where files are stored (storage primitives)
- How notifications are delivered (infrastructure)

### Does NOT Own

| Area | Rationale |
|------|-----------|
| **PPAP logic** | Belongs to PPAP Workflow Domain |
| **Documents** | Belongs to Document Copilot/Workspace Domains |
| **SKU/component data** | Belongs to EMIP Domain |
| **Copilot logic** | Belongs to Document Copilot Domain |
| **Business workflow state** | Belongs to appropriate workflow domain |
| **Document meaning** | Belongs to Document Copilot Domain |

### Consumes

- **None** — Core Platform is the root domain

### Produces

| Output | Consumers |
|--------|-----------|
| **Identity** | All domains (who is acting) |
| **Access Control** | All domains (authorization decisions) |
| **Storage Capability** | Workspace/Vault (file storage) |
| **Notification Events** | All domains (event publication) |

---

## 2. PPAP Workflow Domain

### Purpose

Manage PPAP lifecycle, workflow execution, assignment of work, and tracking of required deliverables through the PPAP process.

### Owns (Authoritative Control)

| Entity | Ownership |
|--------|-----------|
| **PPAP Entities** | PPAP records, lifecycle state, metadata |
| **PPAP Status** | Current state, transitions, history |
| **Assignment of Work** | Who is responsible for what |
| **Workflow Progression** | State machine, gates, transitions |
| **Required Document Tracking** | What documents are needed, their status |
| **Readiness State** | PPAP-level readiness, submission gating |
| **Pre-ack/Post-ack Boundaries** | Workflow phase enforcement |

**Single Source of Truth For:**
- What PPAPs exist and their current state
- Who is assigned to each PPAP
- What documents are required for each PPAP
- Workflow progression and gates
- Assignment authority and responsibility

**Exclusive Authority:**

PPAP Workflow is the **ONLY** domain authorized to:
- Determine PPAP status (pending, in-progress, complete, etc.)
- Determine document completeness for workflow purposes
- Determine PPAP readiness for submission
- Determine approval eligibility and workflow gates
- Make assignment decisions and changes
- Progress workflow state based on conditions

**Even when based on cross-domain data**, PPAP Workflow retains exclusive authority to interpret that data for workflow decisions. Other domains provide inputs; PPAP Workflow makes decisions.

### Does NOT Own

| Area | Rationale |
|------|-----------|
| **Document content** | Belongs to Document Copilot (drafts) and Workspace/Vault (files) |
| **Copilot logic** | Belongs to Document Copilot Domain |
| **SKU/component master data** | Belongs to EMIP Domain |
| **File storage implementation** | Belongs to Workspace/Vault Domain |
| **User identity** | Belongs to Core Platform |
| **Final document authority** | User approval required; system tracks status only |

### Consumes

| Input | Source Domain |
|-------|---------------|
| **Users** | Core Platform (who can be assigned) |
| **Document Status** | Document Copilot (draft/final state) |
| **Files** | Workspace/Vault (attached files) |
| **Identity** | Core Platform (authorization) |

### Produces

| Output | Consumers |
|--------|-----------|
| **Assignments** | Command Center (what work is assigned) |
| **Workflow States** | Command Center (PPAP status visibility) |
| **Document Requirements** | Document Copilot (what needs to be created) |
| **PPAP Context** | Document Copilot (context for drafts) |
| **Status Events** | Command Center, notifications |

---

## 3. Document Copilot Domain

### Purpose

Assist in the creation of engineering documents through AI-guided drafting, question/answer flows, and structured document generation.

### Owns (Authoritative Control)

| Entity | Ownership |
|--------|-----------|
| **Copilot Sessions** | Session state, history, configuration |
| **Question/Answer Flows** | Q&A state, pending questions, responses |
| **Draft Document Outputs** | Draft content, versions, confidence levels |
| **Document Generation Logic** | Prompts, templates, generation strategies |
| **Document Profiles** | Profile configurations, document type definitions |
| **Structured Output Schemas** | Output formats, validation rules |

**Single Source of Truth For:**
- Active copilot sessions and their state
- Draft documents and their iterations
- AI-generated content and confidence levels
- Question/answer flows and unresolved questions
- Document generation profiles and schemas

**Strict Constraints:**

Document Copilot **MUST NOT:**
- Determine workflow status or PPAP state
- Approve documents or mark them as final
- Finalize documents or commit them to vault
- Influence assignment or readiness decisions
- Determine document completeness for workflow purposes
- Make workflow progression decisions

Document Copilot **MAY ONLY:**
- Generate draft content based on inputs
- Ask questions to gather information
- Structure information into document formats
- Provide confidence metadata for user review
- Produce outputs requiring explicit user approval

### Does NOT Own

| Area | Rationale |
|------|-----------|
| **PPAP workflow decisions** | Belongs to PPAP Workflow Domain |
| **Final document authority** | User approval required; drafts are proposals only |
| **Storage systems** | Belongs to Workspace/Vault (files) and Core Platform (primitives) |
| **SKU master data** | Belongs to EMIP Domain (consumed as reference) |
| **User identity** | Belongs to Core Platform |
| **Assignment authority** | Belongs to PPAP Workflow Domain |
| **Document vault** | Final storage belongs to Workspace/Vault |

### Consumes

| Input | Source Domain |
|-------|---------------|
| **Source Files** | Workspace/Vault (BOMs, drawings, templates) |
| **PPAP Context** | PPAP Workflow (optional context) |
| **EMIP Data** | EMIP Domain (optional component reference) |
| **User Identity** | Core Platform (who is operating) |
| **Document Requirements** | PPAP Workflow (what needs to be created) |

### Produces

| Output | Consumers |
|--------|-----------|
| **Draft Documents** | User review, Command Center visibility |
| **Structured Outputs** | PPAP Workflow (document completion), Workspace/Vault (storage) |
| **Unresolved Questions** | Command Center (user attention required) |
| **Session State** | Command Center (resumption, history) |
| **Confidence Metadata** | User decision-making support |

---

## 4. Engineer Command Center Domain

### Purpose

Provide a user-centric operational surface that aggregates work, documents, sessions, and messages across all other domains into a single, actionable view.

### Owns (Authoritative Control)

| Entity | Ownership |
|--------|-----------|
| **Aggregated User Work View** | The presentation/organization of cross-domain data |
| **Personal Task Surface** | User's personalized operating interface |
| **Cross-Domain Visibility Layer** | How data from other domains is surfaced to users |
| **Quick Action Configuration** | User's preferred quick actions and shortcuts |
| **View Preferences** | Dashboard layout, filters, default views |

**Single Source of Truth For:**
- How work is presented to each user
- User-specific view configuration
- Aggregation logic and presentation rules
- Cross-domain visibility state

**Critical Note:** Command Center is an **aggregation and presentation domain**, not a data domain. It does not create or store business data—it organizes and presents data owned by other domains.

### Does NOT Own

| Area | Rationale |
|------|-----------|
| **PPAP data** | Belongs to PPAP Workflow Domain (consumed read-only) |
| **Documents** | Belongs to Document Copilot (drafts) and Workspace/Vault (files) |
| **Copilot sessions** | Belongs to Document Copilot Domain (consumed read-only) |
| **Storage** | Belongs to Workspace/Vault and Core Platform |
| **SKU/component data** | Belongs to EMIP Domain (consumed read-only) |
| **User identity** | Belongs to Core Platform (consumed) |
| **Assignment authority** | Belongs to PPAP Workflow Domain |
| **Document meaning** | Belongs to Document Copilot and user |
| **Workflow state** | Belongs to PPAP Workflow Domain |

**Explicit Principle:** Command Center is **read-only aggregation only**. It never modifies data owned by other domains. All actions initiated from Command Center are delegated to the owning domain.

**Strict Constraints:**

Command Center **MUST NOT:**
- Compute, derive, or alter workflow state
- Determine PPAP status, readiness, or completeness
- Approve, finalize, or validate documents
- Modify assignments or workflow progression
- Cache or store authoritative business data
- Perform business logic or decision-making

Command Center **MUST:**
- Display only data originating from owning domains
- Delegate all state-changing actions to owning domains
- Treat all displayed data as read-only references
- Refresh aggregated views from source domains

### Consumes

| Input | Source Domain |
|-------|---------------|
| **PPAP Assignments** | PPAP Workflow (what work is assigned) |
| **Document States** | Document Copilot (draft/final status) |
| **Copilot Session States** | Document Copilot (active sessions) |
| **Notifications** | Core Platform (notification infrastructure) |
| **User Activity** | All domains (activity log aggregation) |
| **Files** | Workspace/Vault (file metadata) |
| **User Identity** | Core Platform (personalization) |

### Produces

| Output | Consumers |
|--------|-----------|
| **User-Facing Consolidated View** | The user (primary consumer) |
| **Actionable Entry Points** | Navigation to owning domains |
| **View Preferences** | Stored for user personalization |
| **Aggregation Queries** | Cross-domain data retrieval patterns |

---

## 5. Workspace / Vault Domain

### Purpose

Manage file storage, organization, and retrieval for user workspaces, PPAP attachments, and document vault.

### Owns (Authoritative Control)

| Entity | Ownership |
|--------|-----------|
| **Uploaded Files** | File content, metadata, organization |
| **Personal Workspace Files** | User's personal file storage |
| **PPAP-Attached Files** | Files attached to specific PPAPs |
| **File Organization** | Folders, structure, naming conventions |
| **File References** | Pointers, URIs, access paths |
| **Document Vault Storage** | Finalized document storage |
| **Storage Quotas** | Per-user, per-PPAP storage limits |

**Single Source of Truth For:**
- Where files are stored
- File metadata and organization
- Access paths and references
- Storage capacity and quotas
- File lifecycle (upload, organize, archive, delete)

### Does NOT Own

| Area | Rationale |
|------|-----------|
| **Document meaning** | Belongs to Document Copilot (content) and user (interpretation) |
| **PPAP workflow logic** | Belongs to PPAP Workflow Domain |
| **Copilot logic** | Belongs to Document Copilot Domain |
| **SKU/component structure** | Belongs to EMIP Domain |
| **User identity** | Belongs to Core Platform (consumed) |
| **Storage primitives** | Belongs to Core Platform (abstraction layer) |
| **Authentication** | Belongs to Core Platform |

**Explicit Principle:** Workspace/Vault stores **files only** — it never defines meaning, workflow, or business logic. A file is a blob of data with metadata; what that file means or how it's used belongs to other domains.

**Strict Storage-Only Boundaries:**

Workspace/Vault **MUST:**
- Store file content and minimal retrieval metadata only
- Provide access paths and references
- Track storage quotas and file lifecycle

Workspace/Vault **MUST NOT:**
- Assign meaning, classification, or semantic tags to files
- Infer relationships between files or documents
- Determine document structure or format
- Apply business logic to file content
- Interpret file content for any purpose
- Make decisions based on file content

### Consumes

| Input | Source Domain |
|-------|---------------|
| **Storage Primitives** | Core Platform (underlying storage) |
| **User Identity** | Core Platform (who owns files) |
| **PPAP References** | PPAP Workflow (PPAP context for attachments) |
| **Document References** | Document Copilot (which drafts to store) |

### Produces

| Output | Consumers |
|--------|-----------|
| **File Access** | All domains (retrieval) |
| **File References** | All domains (pointers to stored files) |
| **File Metadata** | Command Center (file listings), PPAP Workflow (attachments) |
| **Storage Events** | Notifications, quota tracking |

---

## 6. EMIP Domain (SKU / Component Intelligence)

### Purpose

Manage structured product/component intelligence including SKUs, components, part relationships, and product structure.

### Owns (Authoritative Control)

| Entity | Ownership |
|--------|-----------|
| **SKUs** | Stock keeping units, part numbers, revisions |
| **Components** | Component definitions, specifications |
| **Part Relationships** | BOM structure, parent/child relationships |
| **Product Structure** | Assembly hierarchies, product trees |
| **Component Metadata** | Attributes, classifications, properties |
| **EMIP Intelligence** | Parsed insights, derived relationships |

**Single Source of Truth For:**
- What components exist
- How components relate to each other
- SKU definitions and attributes
- Product structure and hierarchy
- Component intelligence and insights

**Exclusive Product Intelligence Authority:**

Only EMIP Domain **MAY:**
- Define SKUs and component identifiers
- Define component specifications and attributes
- Define parent/child relationships in product structure
- Parse and interpret BOM files for component data
- Derive component relationships and hierarchies

Other Domains **MUST NOT:**
- Create or infer product relationships
- Define component structure or hierarchy
- Parse BOMs for component intelligence
- Derive SKU or component metadata

Other Domains **MAY ONLY:**
- Reference EMIP data as read-only inputs
- Request component lookups from EMIP
- Display EMIP-provided data without modification

### Does NOT Own

| Area | Rationale |
|------|-----------|
| **Files** | Belongs to Workspace/Vault (consumed as source) |
| **PPAP workflow** | Belongs to PPAP Workflow Domain (may reference SKUs) |
| **Document drafts** | Belongs to Document Copilot Domain |
| **Copilot sessions** | Belongs to Document Copilot Domain |
| **User identity** | Belongs to Core Platform |
| **Storage implementation** | Belongs to Core Platform and Workspace/Vault |
| **Assignment logic** | Belongs to PPAP Workflow Domain |

### Consumes

| Input | Source Domain |
|-------|---------------|
| **File-Derived Data** | Workspace/Vault (BOM files for parsing) |
| **User Inputs** | Core Platform (who is defining components) |
| **Document References** | Document Copilot (optional context) |

### Produces

| Output | Consumers |
|--------|-----------|
| **Structured Product Data** | Document Copilot (context for drafting) |
| **Relationships** | PPAP Workflow (component references) |
| **Lookup/Reference Data** | All domains (component queries) |
| **EMIP Intelligence** | Command Center (component visibility) |

---

### Domain Interaction Rules

The following rules govern how domains interact:

#### Rule 1: No Direct Modification of Other Domain Data

**No domain MUST directly modify another domain's owned data.**

All modifications **MUST** go through the owning domain's interfaces. If Domain A needs to change data owned by Domain B, it must:
- Call Domain B's API/interface
- Request the change
- Let Domain B perform the modification

**Rationale:** Prevents data corruption, maintains single source of truth, ensures business logic enforcement.

#### Rule 2: Cross-Domain Interactions via Consumption of Outputs

**All cross-domain interactions MUST occur via consumption of outputs.**

Domains communicate by:
- Domain A produces an output
- Domain B consumes that output as input
- Domain B acts on its own owned data based on that input

**Pattern:** Produce → Consume → Act on own data

**Rationale:** Clear data flow, explicit dependencies, testable boundaries.

#### Rule 3: Command Center is Read-Only Aggregation Only

**The Engineer Command Center MUST NEVER modify data owned by other domains.**

Command Center **MUST:**
- Read data from other domains (read-only)
- Aggregate and present data without alteration
- Initiate navigation to other domains
- Store view preferences (its own data only)

Command Center **MUST NOT:**
- Modify PPAP state
- Modify document content
- Modify copilot sessions
- Modify files
- Modify user identity
- Compute or derive workflow state
- Cache authoritative business data

**Rationale:** Command Center is a presentation layer, not a business logic layer.

#### Rule 4: Workspace/Vault Stores Files Only — Never Defines Meaning

**The Workspace/Vault domain MUST store file content and metadata only.**

It **MUST NOT:**
- Interpret file content
- Define document structure
- Enforce document rules
- Understand business meaning
- Infer relationships or classifications
- Apply semantic tags or categories

It **MUST ONLY:**
- Store the file as binary/text data
- Track metadata (name, size, type, owner, timestamps)
- Organize files in folders/structure
- Provide access paths and retrieval

**Rationale:** Separation of storage from semantics.

#### Rule 5: Document Copilot Produces Drafts Only — Never Final Authority

**The Document Copilot domain MUST produce draft outputs only, never final documents.**

Drafts:
- **MUST** be AI-generated proposals only
- **MUST** require user review
- **MUST** require explicit user approval to become final
- **MUST** be tracked with confidence levels
- **MUST NOT** be automatically finalized

Final authority **MUST** belong to:
- The user (human approval required)
- The PPAP Workflow (status tracking authority)
- The Workspace/Vault (final storage authority)

Document Copilot **MUST NOT:**
- Approve its own outputs
- Finalize documents without user action
- Determine document completeness for workflow

**Rationale:** Human-in-the-loop requirement, auditability, quality control.

#### Rule 6: PPAP Workflow Owns Assignment and Status — Not Content

**The PPAP Workflow domain MUST own assignment and status authority exclusively — not the content of deliverables.**

PPAP Workflow **MUST:**
- Track assignments (exclusive authority)
- Manage workflow states (exclusive authority)
- Enforce gates and boundaries (exclusive authority)
- Track document requirements
- Determine completion status (exclusive authority)
- Make all readiness and approval decisions

PPAP Workflow **MUST NOT:**
- Create document content
- Store document files
- Define document structure
- Generate AI drafts
- Interpret file content for meaning

**Rationale:** Separation of workflow orchestration from content creation.

#### Rule 7: Core Platform is Foundation — Never Business Logic

**The Core Platform MUST provide foundational services only — never business logic.**

Core Platform **MUST:**
- Provide identity services
- Provide authentication
- Provide authorization
- Provide storage primitives
- Provide notification infrastructure

Core Platform **MUST NOT:**
- Understand PPAPs
- Understand documents
- Understand components
- Enforce workflow rules
- Generate content
- Contain business domain logic

**Rationale:** Foundation layer must remain agnostic to business domains.

---

### Data Ownership Principles

The following principles govern data ownership across the system:

#### Principle 1: Every Piece of Data Has Exactly One Owning Domain

**No data MUST have multiple owning domains.**

Examples:
- User identity → Core Platform
- PPAP status → PPAP Workflow
- Draft document → Document Copilot
- File content → Workspace/Vault
- SKU definition → EMIP

**Consequence:** If two domains seem to need to "own" the same data, either:
- The data is actually two different concepts (split them)
- One domain is the owner, the other is a consumer

#### Principle 2: No Duplication of Ownership Allowed

**Data ownership MUST NOT be shared or duplicated.**

There is no such thing as "co-ownership" of data across domains.

**Rationale:** Prevents conflicting updates, unclear authority, data inconsistency.

#### Principle 3: Derived Data Must Reference Its Source Domain

**If Domain B derives data from Domain A's data, Domain B MUST reference Domain A as the source.**

Examples:
- Command Center aggregates PPAP status → references PPAP Workflow as source
- Document Copilot drafts reference source files → references Workspace/Vault as source
- PPAP tracks document completion → references Document Copilot draft status

**Rationale:** Traceability, auditability, clear lineage.

#### Principle 4: Aggregation Does Not Equal Ownership

**Aggregating data from multiple domains MUST NOT confer ownership of that data.**

Command Center aggregates data from:
- PPAP Workflow (assignments)
- Document Copilot (sessions)
- Workspace/Vault (files)

Command Center owns:
- The aggregation logic
- The presentation view
- User preferences

Command Center does NOT own:
- The underlying PPAP data
- The underlying document data
- The underlying file data

**Rationale:** Prevents Command Center from becoming a "shadow" system of record.

#### Principle 5: Storage Does Not Equal Ownership

**Storing data MUST NOT confer ownership of that data.**

Examples:
- Workspace/Vault stores files → owns storage, not document meaning
- Core Platform provides storage primitives → owns primitives, not content
- PPAP Workflow references files → owns the reference, not the file

**Rationale:** Clear separation between storage mechanism and semantic ownership.

#### Principle 6: Derived Data MUST NOT Become Authoritative

**Derived or aggregated data MUST NOT become a source of truth.**

Aggregation layers (Command Center, reporting, caching) **MUST:**
- Treat derived data as read-only views
- Reference source domains for authoritative data
- Refresh from source domains, never persist as truth

Aggregation layers **MUST NOT:**
- Store derived data as authoritative
- Make decisions based on cached/derived data
- Allow derived data to diverge from source

**Rationale:** Prevents "shadow" systems of record, ensures single source of truth.

#### Principle 7: Contract Versioning for Domain Outputs

**All domain outputs MUST be treated as versioned contracts.**

When a domain produces outputs consumed by other domains:
- Output structure is a contract
- Breaking changes **MUST** be versioned or use adapters
- Silent structural changes are **PROHIBITED**
- Consumers **MUST** handle version negotiation

**Rationale:** Prevents cascading failures from interface changes.

#### Principle 8: Shared Mutable State is Strictly Prohibited

**Shared mutable state across domains is absolutely forbidden.**

**PROHIBITED:**
- Shared database tables written by multiple domains
- Shared caches modified by multiple domains
- Cross-domain state storage
- Direct database access across domain boundaries

**REQUIRED:**
- All interaction via outputs/consumption pattern
- Each domain owns its own data store
- Cross-domain data flow via APIs/events only

**Rationale:** Prevents coupling, race conditions, unclear ownership.

---

### Anti-Drift Rules

The following rules prevent gradual erosion of domain boundaries:

#### Rule 1: No Domain Expansion Without Explicit BUILD_PLAN Update

**A domain MUST NOT expand its responsibilities without an explicit update to BUILD_PLAN.**

If a team wants Domain A to take on new responsibilities:
- Update BUILD_PLAN domain definition
- Explicitly document new Owns/Does NOT Own
- Get architectural review
- Update domain contracts

**Rationale:** Prevents gradual scope creep.

#### Rule 2: No Cross-Domain Logic Embedding

**Business logic from one domain MUST NOT be embedded in another domain.**

Examples of violations:
- PPAP Workflow logic in Command Center code
- Document generation logic in PPAP Workflow
- User authentication logic in Document Copilot

**Rationale:** Prevents tight coupling, maintains testability.

#### Rule 3: No "Temporary" Shared Ownership

**There MUST NOT be temporary shared ownership.**

If data seems to need shared ownership:
- Split the data into distinct concepts
- Define clear ownership for each
- Document the relationship

"Temporary" solutions become permanent and create technical debt.

**Rationale:** Forces explicit architectural decisions.

#### Rule 4: No Silent Schema Overlap

**Schemas from different domains MUST NOT silently overlap or conflict.**

If Domain A and Domain B both have a "Document" concept:
- They are different concepts with different meanings
- Name them distinctly (DraftDocument vs FinalizedDocument)
- Document the relationship

**Rationale:** Prevents confusion, data corruption.

#### Rule 5: All New Features Must Declare Domain Ownership

**Before implementing any new feature, teams MUST declare which domain owns the data and logic.**

Feature specification must include:
- Which domain owns the new data
- Which domains consume it
- Cross-domain interaction rules
- Data flow diagram

**Rationale:** Forces architectural thinking before coding.

#### Rule 6: Architectural Rules Override Functional Correctness

**Any implementation that violates domain rules MUST be rejected, even if functionally correct.**

**Enforcement:**
- Code reviews **MUST** check domain boundary compliance
- Functional correctness does **NOT** override architectural rules
- "It works" is **NOT** sufficient justification
- Violations **MUST** be refactored to comply with domain map

**Examples of Rejectable Violations:**
- Command Center computing workflow state (even if correct)
- Document Copilot finalizing documents (even if user-approved)
- Workspace/Vault inferring document relationships (even if accurate)
- Cross-domain direct database access (even if performant)

**Rationale:** Architectural integrity is non-negotiable for long-term maintainability.

---

### Domain Map Visualization

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER INTERFACE LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │     ENGINEER COMMAND CENTER (Aggregation/Presentation)  │   │
│   │     - Reads all domains                                   │   │
│   │     - Presents unified view                               │   │
│   │     - Never modifies other domains' data                  │   │
│   └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│           ┌──────────────────┼──────────────────┐                │
│           │                  │                  │                │
│   ┌───────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐         │
│   │   PPAP       │  │   Document   │  │   Workspace  │         │
│   │   Workflow   │  │   Copilot    │  │   /Vault     │         │
│   │              │  │              │  │              │         │
│   │ - PPAPs      │  │ - Sessions   │  │ - Files      │         │
│   │ - Status     │  │ - Drafts     │  │ - Storage    │         │
│   │ - Assignment │  │ - Q&A Flows  │  │ - References │         │
│   └───────┬──────┘  └───────┬──────┘  └───────┬──────┘         │
│           │                  │                  │                │
│           │         ┌────────┴────────┐          │                │
│           │         │                 │          │                │
│           │    ┌────▼────┐     ┌────▼────┐     │                │
│           │    │  EMIP   │     │  Core   │     │                │
│           │    │ Domain  │     │Platform │     │                │
│           │    │         │     │         │     │                │
│           │    │ - SKUs  │     │ - Users │     │                │
│           │    │ - Parts │     │ - Auth  │     │                │
│           │    │ - Rel.  │     │ - Perms │     │                │
│           │    └─────────┘     └─────────┘     │                │
│           │                  │                  │                │
└───────────┼──────────────────┼──────────────────┼────────────────┘
            │                  │                  │
            ▼                  ▼                  ▼
       ┌────────────────────────────────────────────────┐
       │           FOUNDATION LAYER                      │
       │  Core Platform (Identity, Storage, Notifications) │
       └────────────────────────────────────────────────┘
```

**Data Flow Principles:**
- Arrows indicate consumption of outputs
- No domain directly modifies another's data
- Command Center reads from all; writes to none (except own preferences)
- All domains consume Core Platform services

---

### Domain Contract Summary

| Domain | Owns | Never Owns | Primary Role |
|--------|------|------------|--------------|
| **Core Platform** | Users, Auth, Permissions, Storage Primitives, Notifications | Business logic, workflows, documents | Foundation |
| **PPAP Workflow** | PPAPs, Status, Assignments, Workflow State | Document content, files, copilot logic | Orchestration |
| **Document Copilot** | Sessions, Drafts, Q&A Flows, Profiles | Final authority, workflow decisions, storage | AI Assistance |
| **Command Center** | Aggregation view, Preferences | PPAP data, documents, sessions, files | Presentation |
| **Workspace/Vault** | Files, Storage, References | Document meaning, workflow logic | Storage |
| **EMIP** | SKUs, Components, Relationships, Structure | Files, workflows, drafts | Product Intelligence |

---

### Governance for Domain Map

**This domain map is authoritative.** All future implementation must respect these boundaries.

**Changes Require:**
1. BUILD_PLAN update with explicit rationale
2. BUILD_LEDGER entry documenting the change
3. Architectural review
4. Domain contract updates
5. Team notification

**Violations Are:**
- Direct modification of another domain's data
- Logic embedding across domains
- Silent ownership assumption
- "Temporary" workarounds that bypass domains

**Enforcement:**
- Code review checklist includes domain boundary checks
- Architecture review for cross-domain features
- Regular domain map audits

---

## V3.2B — Domain Interface Contracts

**Last Updated:** 2026-04-01  
**Status:** Execution-Grade Architecture (Interface Definition Complete)

### Purpose

**V3.2A defined domain ownership boundaries. V3.2B defines the ONLY allowed communication patterns between those domains.**

Domain ownership and domain interfaces are **separate concerns**:

- **Ownership** (V3.2A): What each domain controls and is authoritative for
- **Interfaces** (V3.2B): How domains may communicate without crossing ownership boundaries

**Critical Principle:**

Domains **MUST** communicate to coordinate work, but communication **MUST NOT** violate ownership boundaries. V3.2B defines the strict contract model that makes coordination safe.

**Without Interface Contracts:**

Implementation teams would invent ad hoc integration patterns that could:
- Create hidden coupling between domains
- Allow shadow ownership to emerge
- Enable contract drift over time
- Introduce implicit dependencies
- Violate architectural boundaries through "convenience" methods

**With Interface Contracts:**

All cross-domain communication follows explicit, versioned, boundary-preserving patterns that maintain architectural integrity.

---

### Core Interface Model

The EMIP-PPAP system supports **five architectural contract types** for cross-domain interaction:

#### 1. Read Contract

**Definition:** One domain reads non-authoritative output from another domain.

**Rules:**
- Reading does **NOT** imply ownership transfer
- Reading does **NOT** grant mutation rights
- Reader **MUST** treat data as read-only reference
- Reader **MUST NOT** cache data as authoritative truth
- Reader **MUST** refresh from source when needed

**Example:** Command Center reads PPAP assignment data from PPAP Workflow

#### 2. Request Contract

**Definition:** One domain requests that another domain perform an action on its own owned data.

**Rules:**
- Requesting domain **MUST NOT** perform the mutation itself
- Owning domain **MUST** decide whether and how to execute
- Owning domain **MUST** maintain authority over the action
- Request **MUST NOT** include instructions on how to implement
- Request may be accepted, rejected, or queued by owning domain

**Example:** Document Copilot requests Workspace/Vault to store a draft file

#### 3. Output Contract

**Definition:** A domain exposes a stable output for other domains to consume.

**Rules:**
- Output **MUST** be versioned and controlled by owning domain
- Output structure is a contract, not an implementation detail
- Breaking changes **MUST** be versioned or use adapters
- Consumers **MUST** rely only on published contract shape
- Owning domain **MUST** maintain backward compatibility or version

**Example:** PPAP Workflow exposes PPAP status and assignment data

#### 4. Event Contract

**Definition:** A domain emits an event describing something that happened in its own scope.

**Rules:**
- Event describes a **past occurrence**, not a command
- Event **MUST NOT** transfer ownership
- Consumers **MAY** react within their own boundaries
- Consumers **MUST NOT** reinterpret event as authoritative state
- Events are informational, not prescriptive

**Example:** Workspace/Vault emits "file uploaded" event; PPAP Workflow may react by updating attachment tracking

#### 5. Reference Contract

**Definition:** One domain holds a foreign reference to an entity owned by another domain.

**Rules:**
- Reference is **NOT** a copy of truth
- Reference **MUST NOT** become authoritative
- Reference **MUST** be treated as a pointer, not ownership
- Reference **MAY** become stale; consuming domain **MUST** handle staleness
- Owning domain controls lifecycle; reference holder does not

**Example:** PPAP Workflow holds a reference to a file ID from Workspace/Vault

---

### Global Interface Rules

The following rules govern **ALL** cross-domain interfaces:

#### Rule 1: No Direct Mutation of Other Domain Data

**No domain MUST directly mutate another domain's owned data.**

All mutations **MUST** use Request Contracts where the owning domain performs the action.

#### Rule 2: Reads Do Not Imply Authority

**Reading data from another domain MUST NOT imply authority over that data.**

Readers consume outputs; they do not control them.

#### Rule 3: References Do Not Imply Ownership

**Holding a reference to another domain's entity MUST NOT imply ownership transfer.**

References are pointers, not truth stores.

#### Rule 4: Outputs MUST Be Treated as Versioned Contracts

**All domain outputs MUST be treated as stable, versioned contracts.**

Breaking changes require versioning or adapters. Silent changes are **PROHIBITED**.

#### Rule 5: Events Trigger Reactions, Not Authority Transfer

**Events MAY trigger workflow or UI reactions but MUST NOT transfer authority.**

An event describing "document draft created" does not make the listener the owner of that draft.

#### Rule 6: Requesting ≠ Performing

**Requesting a change is NOT the same as performing a change.**

The owning domain retains full authority to accept, reject, modify, or delay the request.

#### Rule 7: Cross-Domain Communication MUST Be Explicit

**All cross-domain communication MUST be explicit, never implicit.**

No hidden coupling through shared caches, shared stores, or silent field reuse.

#### Rule 8: No Hidden Coupling

**No domain MUST create hidden coupling through:**
- Shared mutable caches
- Shared data stores written by multiple domains
- Silent field reuse across domain boundaries
- Direct database access to another domain's tables

#### Rule 9: No Interpretation of Private Internal State

**No domain MUST interpret another domain's private internal state beyond its published contract.**

Domains expose outputs; consumers rely only on those outputs.

#### Rule 10: Interface Contracts MUST Be Implementation-Independent

**Interface contracts MUST be stable enough that implementation can depend on them without guessing.**

Contracts define **what** is communicated, not **how** it is implemented.

---

## Per-Domain Interface Contracts

Each domain has explicit inbound contracts (what it accepts), outbound contracts (what it provides), and prohibited behavior (what it must never do).

---

## 1. Core Platform Domain — Interface Contracts

### Allowed Inbound Contracts

Core Platform **MAY** accept:

- **Event subscriptions** — Other domains may subscribe to notifications
- **Identity queries** — Other domains may request user identity verification
- **Access control queries** — Other domains may request authorization decisions
- **Storage requests** — Other domains may request blob storage primitives

Core Platform **MUST NOT** accept:
- Business logic or workflow rules from other domains
- Domain-specific meaning or interpretation

### Allowed Outbound Contracts

Core Platform **MUST** provide:

- **Identity Outputs** — User identity, authentication state
- **Access Control Outputs** — Authorization decisions, role queries
- **Storage Primitive Outputs** — Blob storage capability, file references
- **Notification Events** — Delivery confirmations, channel status

Core Platform **MUST NOT** provide:
- Business domain knowledge
- PPAP-specific logic
- Document-specific logic
- Component-specific logic

### Prohibited Interface Behavior

Core Platform **MUST NOT**:
- Interpret business meaning from other domains
- Store business rules on behalf of other domains
- Become a "smart" orchestration layer
- Expose domain-specific APIs (PPAP, documents, etc.)

**Rationale:** Core Platform is infrastructure, not business logic. It provides primitives; other domains build meaning.

---

## 2. PPAP Workflow Domain — Interface Contracts

### Allowed Inbound Contracts

PPAP Workflow **MAY** accept:

- **Read Contracts** — Read draft/final state indicators from Document Copilot
- **Read Contracts** — Read file references from Workspace/Vault
- **Read Contracts** — Read component structure from EMIP
- **Event Contracts** — Consume events from Document Copilot (draft complete), Workspace/Vault (file uploaded), Core Platform (user actions)
- **Reference Contracts** — Hold references to files, drafts, components

PPAP Workflow **MUST NOT** accept:
- Direct mutations from other domains
- Commands to change status (it decides status itself)

### Allowed Outbound Contracts

PPAP Workflow **MUST** provide:

- **Output Contracts** — PPAP status, assignments, workflow state, document requirements
- **Event Contracts** — Status changes, assignment changes, workflow transitions
- **Request Contracts** — May request document generation from Document Copilot
- **Request Contracts** — May request file storage from Workspace/Vault

PPAP Workflow **MUST NOT** provide:
- Document content
- File storage
- Component intelligence

### Prohibited Interface Behavior

PPAP Workflow **MUST NOT**:
- Directly manipulate draft content in Document Copilot
- Directly mutate files in Workspace/Vault
- Directly mutate component relationships in EMIP
- Compute or cache document meaning
- Interpret file semantics

**Exclusive Authority Maintained:**

Even when consuming cross-domain data, PPAP Workflow retains **exclusive authority** to:
- Determine PPAP status
- Determine document completeness for workflow purposes
- Determine PPAP readiness
- Determine approval eligibility

**Rationale:** PPAP Workflow orchestrates, but does not own content. It reads from other domains and makes workflow decisions based on those inputs.

---

## 3. Document Copilot Domain — Interface Contracts

### Allowed Inbound Contracts

Document Copilot **MAY** accept:

- **Read Contracts** — Read staged files from Workspace/Vault
- **Read Contracts** — Read PPAP context from PPAP Workflow
- **Read Contracts** — Read EMIP reference data (components, SKUs)
- **Request Contracts** — Accept document generation requests from PPAP Workflow or users
- **Event Contracts** — Consume file upload events, PPAP status change events

Document Copilot **MUST NOT** accept:
- Commands to finalize documents (only user approval triggers finalization)
- Workflow state mutations from other domains

### Allowed Outbound Contracts

Document Copilot **MUST** provide:

- **Output Contracts** — Draft documents, session state, unresolved questions, confidence metadata
- **Event Contracts** — Draft created, draft updated, session complete, question raised
- **Request Contracts** — May request file storage from Workspace/Vault
- **Request Contracts** — May request PPAP context from PPAP Workflow
- **Reference Contracts** — May hold references to source files, PPAP IDs, component IDs

Document Copilot **MUST NOT** provide:
- Final authoritative documents (only drafts)
- Workflow status determinations
- File storage authority

### Prohibited Interface Behavior

Document Copilot **MUST NOT**:
- Write PPAP workflow state
- Finalize outputs without explicit user approval
- Store files directly (must request Workspace/Vault)
- Infer authoritative product relationships (must consume from EMIP)
- Determine workflow completeness or readiness
- Approve its own drafts

**Rationale:** Document Copilot assists and proposes; it does not decide or finalize. All outputs are drafts requiring user/workflow approval.

---

## 4. Engineer Command Center Domain — Interface Contracts

### Allowed Inbound Contracts

Command Center **MAY** accept:

- **Read Contracts** — Read aggregated outputs from all domains
- **Event Contracts** — Consume events from all domains for display purposes
- **Reference Contracts** — Hold references to PPAP IDs, document IDs, file IDs, session IDs

Command Center **MUST NOT** accept:
- Mutation requests from users that it would execute directly on other domains
- Business logic or workflow rules

### Allowed Outbound Contracts

Command Center **MUST** provide:

- **Output Contracts** — Aggregated user view, task surface, presentation state
- **Reference Contracts** — Action entry points (navigation to owning domains)
- **Request Contracts** — May request actions from owning domains on behalf of user

Command Center **MUST NOT** provide:
- Computed workflow state (must read from PPAP Workflow)
- Cached authoritative business data
- Shadow orchestration logic

### Prohibited Interface Behavior

Command Center **MUST NOT**:
- Compute authoritative workflow state (must read from PPAP Workflow)
- Mutate PPAP data, documents, sessions, or files directly
- Cache business data as authoritative source
- Become a shadow orchestration layer
- Infer or derive workflow decisions
- Store business logic

**Strict Read-Only Enforcement:**

All Command Center interactions with other domains **MUST** be:
- Read Contracts (consuming outputs)
- Reference Contracts (holding pointers)
- Request Contracts (delegating actions to owning domains)

**NEVER:**
- Direct mutations
- Computed authority
- Cached truth

**Rationale:** Command Center aggregates and presents; it does not compute, decide, or own business state.

---

## 5. Workspace / Vault Domain — Interface Contracts

### Allowed Inbound Contracts

Workspace/Vault **MAY** accept:

- **Request Contracts** — Storage requests from Document Copilot, PPAP Workflow, users
- **Request Contracts** — File retrieval requests from all domains
- **Read Contracts** — User identity from Core Platform (for access control)

Workspace/Vault **MUST NOT** accept:
- Requests to interpret file meaning
- Requests to infer document structure
- Requests to classify or tag files semantically

### Allowed Outbound Contracts

Workspace/Vault **MUST** provide:

- **Output Contracts** — File references, access metadata, storage quotas
- **Event Contracts** — File uploaded, file deleted, quota exceeded
- **Reference Contracts** — File IDs, access URIs

Workspace/Vault **MUST NOT** provide:
- Document meaning or classification
- Inferred relationships between files
- Business logic or workflow implications

### Prohibited Interface Behavior

Workspace/Vault **MUST NOT**:
- Interpret file semantics or document meaning
- Infer relationships between files
- Determine document structure or format
- Apply business logic to file content
- Make decisions based on file content
- Expose file content analysis (only raw storage/retrieval)

**Strict Storage-Only Enforcement:**

Workspace/Vault is a **dumb storage layer**. It:
- Stores bytes
- Provides access
- Tracks metadata (size, type, owner, timestamps)

It **NEVER**:
- Interprets content
- Infers meaning
- Makes business decisions

**Rationale:** Separation of storage from semantics. Workspace/Vault is infrastructure; meaning belongs to consuming domains.

---

## 6. EMIP Domain — Interface Contracts

### Allowed Inbound Contracts

EMIP **MAY** accept:

- **Read Contracts** — File-derived data from Workspace/Vault (for BOM parsing)
- **Request Contracts** — Component lookup requests from Document Copilot, PPAP Workflow, Command Center
- **Event Contracts** — File upload events (to trigger BOM parsing)

EMIP **MUST NOT** accept:
- Product relationship definitions from other domains
- Component structure inferred by other domains
- SKU definitions from external sources without validation

### Allowed Outbound Contracts

EMIP **MUST** provide:

- **Output Contracts** — Structured product data (SKUs, components, relationships)
- **Event Contracts** — Component updated, BOM parsed, relationship changed
- **Reference Contracts** — Component IDs, SKU references

EMIP **MUST NOT** provide:
- File storage
- Workflow control
- Document drafts

### Prohibited Interface Behavior

EMIP **MUST NOT**:
- Absorb file storage responsibility (delegates to Workspace/Vault)
- Control workflow state (delegates to PPAP Workflow)
- Generate draft documents (delegates to Document Copilot)
- Allow other domains to define product intelligence outside EMIP

**Exclusive Product Intelligence Authority:**

Only EMIP **MAY**:
- Define SKUs and component identifiers
- Parse BOMs for component data
- Define parent/child relationships in product structure

Other domains **MUST**:
- Reference EMIP data as read-only
- Request lookups from EMIP
- Never infer product relationships independently

**Rationale:** Product intelligence is centralized in EMIP. Other domains consume but never define.

---

## Cross-Domain Interaction Matrix

The following matrix defines **allowed interaction types** between domains. Implementation **MUST** follow these contracts.

**Legend:**
- **I** = Identity/Auth/Storage/Notifications (Core Platform foundation)
- **R** = Read Contract (consume outputs)
- **Q** = Request Contract (request action from owning domain)
- **E** = Event Contract (consume events)
- **Ref** = Reference Contract (hold foreign reference)
- **—** = No interaction allowed

| **From ↓ / To →** | **Core Platform** | **PPAP Workflow** | **Document Copilot** | **Command Center** | **Workspace/Vault** | **EMIP** |
|-------------------|-------------------|-------------------|----------------------|--------------------|---------------------|----------|
| **Core Platform** | — | I | I | I | I | I |
| **PPAP Workflow** | I, Q | — | R, Q, E, Ref | — | R, Q, E, Ref | R, E, Ref |
| **Document Copilot** | I, Q | R, E, Ref | — | — | R, Q, E, Ref | R, Ref |
| **Command Center** | I | R, E, Ref, Q | R, E, Ref, Q | — | R, E, Ref, Q | R, Ref, Q |
| **Workspace/Vault** | I | E | E | — | — | — |
| **EMIP** | I | E | E | — | R, E | — |

**Matrix Rules:**

1. **Core Platform** provides foundation (I) to all domains
2. **Command Center** reads from all domains but never mutates
3. **Workspace/Vault** and **EMIP** emit events but rarely consume from business domains
4. **PPAP Workflow** and **Document Copilot** coordinate via R, Q, E, Ref patterns
5. No domain has direct mutation access (—) to another domain's data

**Interpretation Examples:**

- **PPAP Workflow → Document Copilot:** R, Q, E, Ref
  - Read draft state (R)
  - Request document generation (Q)
  - Consume draft completion events (E)
  - Hold references to session IDs (Ref)

- **Command Center → PPAP Workflow:** R, E, Ref, Q
  - Read PPAP status (R)
  - Consume status change events (E)
  - Hold PPAP ID references (Ref)
  - Request actions on behalf of user (Q), but PPAP Workflow executes

- **Document Copilot → Workspace/Vault:** R, Q, E, Ref
  - Read source files (R)
  - Request file storage (Q)
  - Consume file upload events (E)
  - Hold file ID references (Ref)

---

## Approved Interface Patterns

The following patterns are **approved** for cross-domain interaction:

### Pattern 1: Publish Output → Consume Read-Only

**Description:** Owning domain publishes stable output; consuming domain reads it without mutation.

**Example:** PPAP Workflow publishes PPAP status; Command Center reads it for display.

**Rules:**
- Consumer **MUST NOT** modify the output
- Consumer **MUST NOT** cache as authoritative truth
- Consumer **MUST** refresh from source as needed

### Pattern 2: Request Action → Owning Domain Decides

**Description:** Requesting domain asks owning domain to perform an action; owning domain decides.

**Example:** Document Copilot requests Workspace/Vault to store a file; Workspace/Vault executes storage.

**Rules:**
- Requester **MUST NOT** perform the action itself
- Owning domain **MUST** retain authority
- Request may be accepted, rejected, or queued

### Pattern 3: Emit Event → Other Domain Reacts Within Own Boundary

**Description:** Domain emits event describing past occurrence; consumers react within their own scope.

**Example:** Workspace/Vault emits "file uploaded"; PPAP Workflow updates attachment tracking (its own data).

**Rules:**
- Event is informational, not prescriptive
- Event **MUST NOT** transfer ownership
- Consumer reacts by modifying its own data only

### Pattern 4: Hold Reference → Never Promote to Authoritative Copy

**Description:** Domain holds reference to entity owned by another domain; reference remains pointer.

**Example:** PPAP Workflow holds file ID reference; Workspace/Vault owns the file.

**Rules:**
- Reference is not a copy of truth
- Reference may become stale
- Owning domain controls lifecycle

### Pattern 5: Aggregate for Display → Source Remains Authoritative

**Description:** Aggregation layer combines data from multiple domains for display; sources remain truth.

**Example:** Command Center aggregates PPAP, documents, and files; owning domains remain authoritative.

**Rules:**
- Aggregation is read-only
- Aggregation **MUST NOT** become source of truth
- Aggregation **MUST** refresh from sources

---

## Prohibited Interface Patterns

The following patterns are **strictly forbidden**:

### Anti-Pattern 1: Direct Cross-Domain Mutation

**Description:** Domain A directly modifies Domain B's owned data.

**Why Prohibited:** Violates ownership boundaries, creates hidden coupling, bypasses business logic.

**Example:** Command Center directly updating PPAP status in database.

**Enforcement:** Code reviews **MUST** reject any direct cross-domain mutation.

### Anti-Pattern 2: Shared Mutable Object/State

**Description:** Multiple domains write to the same data store or cache.

**Why Prohibited:** Creates race conditions, unclear ownership, coupling.

**Example:** PPAP Workflow and Document Copilot both writing to shared "document_state" table.

**Enforcement:** Architecture reviews **MUST** reject shared mutable state.

### Anti-Pattern 3: Duplicated Truth Stores

**Description:** Multiple domains storing their own copies of the same authoritative data.

**Why Prohibited:** Data inconsistency, unclear source of truth.

**Example:** Command Center caching PPAP status locally as authoritative.

**Enforcement:** Data ownership reviews **MUST** identify and eliminate duplication.

### Anti-Pattern 4: Hidden Dependency on Internal Fields

**Description:** Domain A relying on Domain B's internal implementation details beyond published contract.

**Why Prohibited:** Creates fragile coupling, prevents independent evolution.

**Example:** Document Copilot reading PPAP Workflow's internal state machine fields.

**Enforcement:** Interface reviews **MUST** ensure reliance only on published contracts.

### Anti-Pattern 5: UI-Layer Inference Becoming Workflow Truth

**Description:** Command Center computing derived state and treating it as authoritative.

**Why Prohibited:** Aggregation layer must not become source of truth.

**Example:** Command Center calculating "PPAP is complete" based on document counts.

**Enforcement:** Command Center **MUST** read status from PPAP Workflow, not compute it.

### Anti-Pattern 6: File Metadata Becoming Semantic Authority

**Description:** Workspace/Vault inferring document meaning from file metadata.

**Why Prohibited:** Storage layer must not interpret semantics.

**Example:** Workspace/Vault tagging files as "design spec" based on naming convention.

**Enforcement:** Workspace/Vault **MUST** store only; meaning comes from consuming domains.

### Anti-Pattern 7: Copilot Output Treated as Final Without Approval

**Description:** Document Copilot draft automatically becoming final without user/workflow approval.

**Why Prohibited:** Drafts are proposals, not authoritative documents.

**Example:** Copilot-generated draft automatically marked as "approved" in PPAP Workflow.

**Enforcement:** Copilot outputs **MUST** require explicit approval before becoming final.

### Anti-Pattern 8: Temporary Shared Ownership

**Description:** Two domains temporarily sharing ownership "for convenience."

**Why Prohibited:** Temporary becomes permanent; creates technical debt.

**Example:** PPAP Workflow and Document Copilot both allowed to update "draft_status" field.

**Enforcement:** "Temporary" shared ownership is **NEVER** allowed.

---

## Interface Stability Rules

The following rules govern interface contract stability and change control:

### Rule 1: Published Domain Outputs Are Contracts, Not Suggestions

**Published outputs are binding contracts.**

Consuming domains rely on output structure. Changes affect consumers.

### Rule 2: Breaking Changes Require Explicit Versioning or Adapters

**Breaking changes MUST be versioned or use adapters.**

Consumers **MUST** handle version negotiation. Silent breaking changes are **PROHIBITED**.

**Example:** If PPAP Workflow changes status output structure, it must:
- Version the output (v1, v2)
- Provide adapter for v1 consumers
- Notify consumers of deprecation timeline

### Rule 3: Silent Contract Changes Are Prohibited

**Changing output structure without versioning or notification is forbidden.**

Consumers expect stable contracts. Surprises break systems.

### Rule 4: Consuming Domains MUST Rely Only on Published Contract Shape

**Consumers MUST NOT rely on private implementation details.**

If it's not in the published contract, it's not stable.

### Rule 5: Interface Changes Require BUILD_PLAN Update If Architectural

**If an interface change alters architectural assumptions, BUILD_PLAN MUST be updated.**

**Examples requiring BUILD_PLAN update:**
- New interaction type between domains
- Change in ownership boundary
- New prohibited pattern discovered

**Examples NOT requiring BUILD_PLAN update:**
- Adding optional field to existing output (backward compatible)
- Internal implementation optimization

### Rule 6: Interface Contracts Are Immutable Until Explicitly Versioned

**Once published, a contract version is immutable.**

To change, create new version. Deprecate old version over time.

### Rule 7: Deprecation MUST Include Migration Path

**When deprecating an interface, MUST provide migration path and timeline.**

Consumers need time to adapt.

---

## Implementation Guardrails for Future Phases

Before implementing **ANY** feature touching multiple domains, the implementing phase **MUST** declare:

### Required Declaration Checklist

1. **Which domain owns the affected data?**
   - Must reference V3.2A domain ownership

2. **Which domain is consuming outputs?**
   - Must identify consuming domains

3. **What contract type is being used?**
   - Must be one of: Read, Request, Output, Event, Reference
   - Must reference V3.2B contract model

4. **How is ownership preserved?**
   - Must demonstrate no ownership boundary violations
   - Must show owning domain retains authority

5. **Why does this design not violate V3.2A or V3.2B?**
   - Must explicitly confirm compliance
   - Must identify which approved patterns are being used

6. **What prohibited patterns are being avoided?**
   - Must confirm no anti-patterns are present

### Implementation Review Gates

**No cross-domain feature may be implemented without:**

1. Explicit contract type declaration (Read/Request/Output/Event/Reference)
2. Confirmation of owning vs consuming domains
3. Ownership boundary preservation proof
4. Prohibited pattern avoidance confirmation

**Code reviews MUST check:**
- Contract type is explicit
- Ownership boundaries are respected
- No prohibited patterns are present
- Interface follows V3.2B rules

**Architecture reviews MUST verify:**
- Feature does not introduce new anti-patterns
- Feature does not weaken domain boundaries
- Feature follows approved interface patterns

### Implementation Rejection Criteria

**Implementation MUST be rejected if:**

1. Contract type is not declared
2. Ownership boundary is violated
3. Prohibited pattern is present
4. Direct cross-domain mutation detected
5. Shared mutable state introduced
6. Duplicated truth store created
7. Interface relies on private implementation details
8. "Temporary" shared ownership proposed

**Functional correctness does NOT override these rules.**

---

## Governance for Domain Interface Contracts

**This interface contract definition is authoritative.** All future implementation **MUST** follow these contracts.

**Changes Require:**
1. BUILD_PLAN update with explicit rationale
2. BUILD_LEDGER entry documenting the change
3. Architecture review
4. Interface contract updates
5. Consumer impact analysis

**Violations Are:**
- Direct cross-domain mutation
- Use of prohibited patterns
- Unapproved interaction types
- Silent contract changes
- Hidden coupling

**Enforcement:**
- Code reviews check contract type declaration
- Architecture reviews verify pattern compliance
- Regular interface audits
- Consumer notification for contract changes

---

## V3.2C — Domain Interaction Scenarios

**Last Updated:** 2026-04-01  
**Status:** Architecture Validation Complete (Scenario Stress-Test)

### Purpose

**This phase validates that real-world workflows can be executed using ONLY the defined domain ownership rules (V3.2A) and approved interface contract types (V3.2B).**

**Critical Validation Goals:**

1. Confirm all workflows are expressible as contract sequences
2. Verify no ownership violations occur in real scenarios
3. Ensure no prohibited patterns are required
4. Identify architectural gaps before implementation
5. Prove architecture is complete and enforceable

**This is NOT new architecture.** This phase stress-tests existing V3.2A and V3.2B definitions using realistic workflows.

**Validation Method:**

For each scenario:
- Trace step-by-step domain interactions
- Validate contract type usage
- Confirm ownership preservation
- Identify potential violation points
- Document enforcement mechanisms

---

## Scenario 1: Create New PPAP

### A. Scenario Description

**Real-World Use Case:** Engineer creates a new PPAP submission for a component requiring supplier approval.

**User Action:** Navigate to PPAP system, click "Create New PPAP," provide component details, set initial assignments.

### B. Domains Involved

- Core Platform (identity, auth)
- PPAP Workflow (owns PPAP state)
- EMIP (component reference data)
- Command Center (user entry point)

### C. Step-by-Step Interaction Flow

**Step 1: User Initiates from Command Center**
- **Source:** Command Center
- **Contract:** Request
- **Target:** PPAP Workflow
- **Action:** User clicks "Create PPAP" in Command Center; Command Center delegates request to PPAP Workflow

**Step 2: PPAP Workflow Validates User Identity**
- **Source:** PPAP Workflow
- **Contract:** Read
- **Target:** Core Platform
- **Action:** PPAP Workflow reads user identity and authorization from Core Platform

**Step 3: User Provides Component Selection**
- **Source:** Command Center (user input)
- **Contract:** Request
- **Target:** PPAP Workflow
- **Action:** User selects component; Command Center sends component ID to PPAP Workflow

**Step 4: PPAP Workflow Reads Component Data**
- **Source:** PPAP Workflow
- **Contract:** Read
- **Target:** EMIP
- **Action:** PPAP Workflow reads component metadata from EMIP for validation

**Step 5: PPAP Workflow Creates PPAP Record**
- **Source:** PPAP Workflow
- **Contract:** Output
- **Target:** (internal state)
- **Action:** PPAP Workflow creates new PPAP record in its own data store with status "pending"

**Step 6: PPAP Workflow Emits Creation Event**
- **Source:** PPAP Workflow
- **Contract:** Event
- **Target:** Command Center, other subscribers
- **Action:** PPAP Workflow emits "PPAP Created" event

**Step 7: Command Center Refreshes View**
- **Source:** Command Center
- **Contract:** Read
- **Target:** PPAP Workflow
- **Action:** Command Center reads updated PPAP list to display new PPAP

### D. Ownership Validation

✅ **PPAP Workflow** retained exclusive ownership of:
- PPAP record creation
- PPAP status determination ("pending")
- Assignment decisions

✅ **No Cross-Domain Mutation:**
- Command Center did NOT create PPAP directly
- PPAP Workflow did NOT modify EMIP data
- EMIP did NOT modify PPAP state

✅ **Authority Preserved:**
- PPAP Workflow decided whether to create PPAP
- EMIP remained authoritative for component data
- Core Platform remained authoritative for identity

### E. Interface Compliance Check

✅ **All Interactions Used Approved Contract Types:**
- Request (Command Center → PPAP Workflow)
- Read (PPAP Workflow → Core Platform, EMIP)
- Output (PPAP Workflow internal state)
- Event (PPAP Workflow → subscribers)

✅ **No Prohibited Patterns:**
- No shared mutable state
- No duplicated truth stores
- No hidden coupling
- No direct cross-domain mutation

✅ **No Implicit Communication:**
- All interactions explicit via defined contracts
- No hidden database access
- No shared caches

### F. Potential Violation Points

**Violation Risk 1:** Command Center directly creating PPAP record in database
- **Why Tempting:** Faster, fewer hops
- **Why Prohibited:** Command Center is read-only aggregation; PPAP Workflow owns PPAP state

**Violation Risk 2:** PPAP Workflow caching EMIP component data as authoritative
- **Why Tempting:** Avoid repeated reads
- **Why Prohibited:** EMIP is authoritative; PPAP Workflow may only hold references

**Violation Risk 3:** Command Center computing PPAP status instead of reading from PPAP Workflow
- **Why Tempting:** Reduce latency
- **Why Prohibited:** Command Center MUST NOT compute authoritative workflow state

### G. Enforcement Notes

**Rule 1 (V3.2A):** PPAP Workflow is ONLY domain authorized to create PPAP records
- **Prevents:** Command Center creating PPAPs

**Rule 2 (V3.2B):** Read Contract does NOT imply ownership transfer
- **Prevents:** PPAP Workflow caching EMIP data as authoritative

**Rule 3 (V3.2B):** Command Center MUST NOT compute authoritative workflow state
- **Prevents:** Command Center deriving status

**Rule 4 (V3.2B):** All mutations MUST use Request Contracts where owning domain executes
- **Prevents:** Direct cross-domain mutation

---

## Scenario 2: Generate Document via Copilot (PPAP-Bound)

### A. Scenario Description

**Real-World Use Case:** Engineer uses Document Copilot to generate a PPAP document (e.g., FMEA) for an active PPAP submission.

**User Action:** Navigate to PPAP, select document type, launch Copilot session, provide inputs, approve draft.

### B. Domains Involved

- PPAP Workflow (owns PPAP state, document requirements)
- Document Copilot (owns draft generation)
- Workspace/Vault (owns file storage)
- EMIP (component reference data)
- Command Center (user entry point)

### C. Step-by-Step Interaction Flow

**Step 1: User Initiates Document Generation**
- **Source:** Command Center
- **Contract:** Request
- **Target:** PPAP Workflow
- **Action:** User selects "Generate FMEA" for PPAP; Command Center delegates to PPAP Workflow

**Step 2: PPAP Workflow Requests Copilot Session**
- **Source:** PPAP Workflow
- **Contract:** Request
- **Target:** Document Copilot
- **Action:** PPAP Workflow requests Document Copilot to start FMEA generation session

**Step 3: Document Copilot Reads PPAP Context**
- **Source:** Document Copilot
- **Contract:** Read
- **Target:** PPAP Workflow
- **Action:** Document Copilot reads PPAP ID, component ID, submission context

**Step 4: Document Copilot Reads Component Data**
- **Source:** Document Copilot
- **Contract:** Read
- **Target:** EMIP
- **Action:** Document Copilot reads component specifications, relationships from EMIP

**Step 5: Document Copilot Reads Source Files (if any)**
- **Source:** Document Copilot
- **Contract:** Read
- **Target:** Workspace/Vault
- **Action:** Document Copilot reads any staged files referenced by PPAP

**Step 6: Document Copilot Generates Draft**
- **Source:** Document Copilot
- **Contract:** Output
- **Target:** (internal session state)
- **Action:** Document Copilot generates draft FMEA content in its own session store

**Step 7: Document Copilot Emits Draft Ready Event**
- **Source:** Document Copilot
- **Contract:** Event
- **Target:** PPAP Workflow, Command Center
- **Action:** Document Copilot emits "Draft Ready" event with session ID

**Step 8: User Reviews and Approves Draft**
- **Source:** Command Center (user input)
- **Contract:** Request
- **Target:** Document Copilot
- **Action:** User approves draft; Command Center sends approval to Document Copilot

**Step 9: Document Copilot Requests File Storage**
- **Source:** Document Copilot
- **Contract:** Request
- **Target:** Workspace/Vault
- **Action:** Document Copilot requests Workspace/Vault to store finalized document

**Step 10: Workspace/Vault Stores File**
- **Source:** Workspace/Vault
- **Contract:** Output
- **Target:** (internal storage)
- **Action:** Workspace/Vault stores file, returns file ID reference

**Step 11: Workspace/Vault Emits File Stored Event**
- **Source:** Workspace/Vault
- **Contract:** Event
- **Target:** Document Copilot, PPAP Workflow
- **Action:** Workspace/Vault emits "File Uploaded" event

**Step 12: Document Copilot Notifies PPAP Workflow**
- **Source:** Document Copilot
- **Contract:** Event
- **Target:** PPAP Workflow
- **Action:** Document Copilot emits "Session Complete" event with file ID reference

**Step 13: PPAP Workflow Updates Document Tracking**
- **Source:** PPAP Workflow
- **Contract:** Reference
- **Target:** Workspace/Vault (file ID)
- **Action:** PPAP Workflow stores file ID reference in its own PPAP document tracking

**Step 14: PPAP Workflow Re-Evaluates Completeness**
- **Source:** PPAP Workflow
- **Contract:** (internal)
- **Target:** (own state)
- **Action:** PPAP Workflow re-evaluates PPAP completeness based on new document

### D. Ownership Validation

✅ **Document Copilot** retained exclusive ownership of:
- Draft generation logic
- Session state
- Draft content before approval

✅ **PPAP Workflow** retained exclusive ownership of:
- PPAP status
- Document requirement tracking
- Completeness determination

✅ **Workspace/Vault** retained exclusive ownership of:
- File storage
- File lifecycle

✅ **EMIP** retained exclusive ownership of:
- Component data

✅ **No Cross-Domain Mutation:**
- Document Copilot did NOT finalize document without user approval
- Document Copilot did NOT write to Workspace/Vault directly (used Request)
- PPAP Workflow did NOT generate draft content
- Workspace/Vault did NOT interpret document meaning

✅ **Authority Preserved:**
- Document Copilot decided how to generate draft
- PPAP Workflow decided whether document satisfies requirements
- Workspace/Vault decided how to store file
- User approved draft before finalization

### E. Interface Compliance Check

✅ **All Interactions Used Approved Contract Types:**
- Request (PPAP Workflow → Document Copilot, Document Copilot → Workspace/Vault)
- Read (Document Copilot → PPAP Workflow, EMIP, Workspace/Vault)
- Output (Document Copilot session state, Workspace/Vault file storage)
- Event (Document Copilot → PPAP Workflow, Workspace/Vault → subscribers)
- Reference (PPAP Workflow holds file ID)

✅ **No Prohibited Patterns:**
- No shared mutable state between domains
- No duplicated truth (file stored once in Workspace/Vault)
- No hidden coupling
- No direct cross-domain mutation

✅ **No Implicit Communication:**
- All interactions explicit via defined contracts
- Document Copilot did NOT assume PPAP Workflow would auto-accept draft
- PPAP Workflow did NOT assume file content without reading metadata

### F. Potential Violation Points

**Violation Risk 1:** Document Copilot directly writing file to Workspace/Vault database
- **Why Tempting:** Fewer steps, direct access
- **Why Prohibited:** Workspace/Vault owns storage; Document Copilot must use Request Contract

**Violation Risk 2:** PPAP Workflow auto-marking document as "complete" based on Copilot event
- **Why Tempting:** Automation, reduce user steps
- **Why Prohibited:** PPAP Workflow must evaluate completeness itself; event is informational only

**Violation Risk 3:** Document Copilot caching EMIP component data as authoritative
- **Why Tempting:** Performance optimization
- **Why Prohibited:** EMIP is authoritative; Document Copilot may only hold references

**Violation Risk 4:** Shared "document_state" table written by both Document Copilot and PPAP Workflow
- **Why Tempting:** Convenience, single source
- **Why Prohibited:** Shared mutable state is strictly forbidden

### G. Enforcement Notes

**Rule 1 (V3.2B):** Request Contract — owning domain decides execution
- **Prevents:** Document Copilot directly writing to Workspace/Vault

**Rule 2 (V3.2B):** Event Contract — events trigger reactions, not authority transfer
- **Prevents:** PPAP Workflow auto-accepting draft based on event

**Rule 3 (V3.2B):** Reference Contract — reference is not copy of truth
- **Prevents:** Document Copilot caching EMIP data as authoritative

**Rule 4 (V3.2A):** Shared mutable state is strictly prohibited
- **Prevents:** Shared "document_state" table

**Rule 5 (V3.2A):** Document Copilot MUST NOT finalize without user approval
- **Prevents:** Auto-finalization

---

## Scenario 3: Generate Document via Copilot (Standalone Workspace)

### A. Scenario Description

**Real-World Use Case:** Engineer uses Document Copilot to generate a document NOT bound to a PPAP (e.g., internal design note, analysis).

**User Action:** Navigate to Workspace, launch Copilot, provide inputs, approve draft, save to personal vault.

### B. Domains Involved

- Document Copilot (owns draft generation)
- Workspace/Vault (owns file storage)
- EMIP (component reference data, optional)
- Command Center (user entry point)
- Core Platform (identity, auth)

**NOT Involved:** PPAP Workflow (no PPAP context)

### C. Step-by-Step Interaction Flow

**Step 1: User Initiates Standalone Session**
- **Source:** Command Center
- **Contract:** Request
- **Target:** Document Copilot
- **Action:** User selects "Create Document" in Workspace; Command Center delegates to Document Copilot

**Step 2: Document Copilot Validates User Identity**
- **Source:** Document Copilot
- **Contract:** Read
- **Target:** Core Platform
- **Action:** Document Copilot reads user identity for session ownership

**Step 3: Document Copilot Reads Source Files (if provided)**
- **Source:** Document Copilot
- **Contract:** Read
- **Target:** Workspace/Vault
- **Action:** Document Copilot reads any user-provided source files

**Step 4: Document Copilot Reads Component Data (if referenced)**
- **Source:** Document Copilot
- **Contract:** Read
- **Target:** EMIP
- **Action:** Document Copilot reads component data if user references components

**Step 5: Document Copilot Generates Draft**
- **Source:** Document Copilot
- **Contract:** Output
- **Target:** (internal session state)
- **Action:** Document Copilot generates draft in its own session store

**Step 6: User Approves Draft**
- **Source:** Command Center (user input)
- **Contract:** Request
- **Target:** Document Copilot
- **Action:** User approves draft

**Step 7: Document Copilot Requests File Storage**
- **Source:** Document Copilot
- **Contract:** Request
- **Target:** Workspace/Vault
- **Action:** Document Copilot requests Workspace/Vault to store document in user's workspace

**Step 8: Workspace/Vault Stores File**
- **Source:** Workspace/Vault
- **Contract:** Output
- **Target:** (internal storage)
- **Action:** Workspace/Vault stores file, returns file ID

**Step 9: Document Copilot Emits Session Complete Event**
- **Source:** Document Copilot
- **Contract:** Event
- **Target:** Command Center
- **Action:** Document Copilot emits "Session Complete" event

**Step 10: Command Center Refreshes Workspace View**
- **Source:** Command Center
- **Contract:** Read
- **Target:** Workspace/Vault
- **Action:** Command Center reads updated file list to display new document

### D. Ownership Validation

✅ **Document Copilot** retained exclusive ownership of:
- Draft generation
- Session state

✅ **Workspace/Vault** retained exclusive ownership of:
- File storage
- File access control

✅ **EMIP** retained exclusive ownership of:
- Component data (if referenced)

✅ **No Cross-Domain Mutation:**
- Document Copilot did NOT write directly to Workspace/Vault
- Workspace/Vault did NOT interpret document content
- Command Center did NOT store files

✅ **Authority Preserved:**
- Document Copilot decided how to generate draft
- Workspace/Vault decided how to store file
- User approved draft before finalization

### E. Interface Compliance Check

✅ **All Interactions Used Approved Contract Types:**
- Request (Command Center → Document Copilot, Document Copilot → Workspace/Vault)
- Read (Document Copilot → Core Platform, Workspace/Vault, EMIP)
- Output (Document Copilot session state, Workspace/Vault file storage)
- Event (Document Copilot → Command Center)

✅ **No Prohibited Patterns:**
- No shared mutable state
- No duplicated truth
- No hidden coupling

✅ **No Implicit Communication:**
- All interactions explicit via defined contracts

### F. Potential Violation Points

**Violation Risk 1:** Document Copilot storing draft directly in Workspace/Vault database
- **Why Tempting:** Simpler flow, fewer steps
- **Why Prohibited:** Workspace/Vault owns storage; Document Copilot must use Request Contract

**Violation Risk 2:** Workspace/Vault tagging file as "design note" based on content analysis
- **Why Tempting:** Better organization, search
- **Why Prohibited:** Workspace/Vault MUST NOT interpret file semantics

### G. Enforcement Notes

**Rule 1 (V3.2B):** Request Contract — owning domain executes action
- **Prevents:** Document Copilot directly writing to Workspace/Vault

**Rule 2 (V3.2A):** Workspace/Vault MUST NOT interpret file semantics
- **Prevents:** Workspace/Vault tagging files based on content

**Rule 3 (V3.2B):** Document Copilot MUST NOT finalize without user approval
- **Prevents:** Auto-saving without user consent

---

## Scenario 4: Attach Files from Vault to PPAP

### A. Scenario Description

**Real-World Use Case:** Engineer attaches existing files from their workspace vault to a PPAP submission (e.g., test reports, drawings).

**User Action:** Navigate to PPAP, select "Attach Files," browse vault, select files, confirm attachment.

### B. Domains Involved

- PPAP Workflow (owns PPAP state, document tracking)
- Workspace/Vault (owns file storage)
- Command Center (user entry point)
- Core Platform (identity, auth)

### C. Step-by-Step Interaction Flow

**Step 1: User Initiates File Attachment**
- **Source:** Command Center
- **Contract:** Request
- **Target:** PPAP Workflow
- **Action:** User selects "Attach Files" for PPAP; Command Center delegates to PPAP Workflow

**Step 2: PPAP Workflow Requests File List**
- **Source:** PPAP Workflow
- **Contract:** Read
- **Target:** Workspace/Vault
- **Action:** PPAP Workflow reads user's available files from Workspace/Vault

**Step 3: User Selects Files**
- **Source:** Command Center (user input)
- **Contract:** Request
- **Target:** PPAP Workflow
- **Action:** User selects file IDs; Command Center sends selection to PPAP Workflow

**Step 4: PPAP Workflow Validates File Access**
- **Source:** PPAP Workflow
- **Contract:** Read
- **Target:** Workspace/Vault
- **Action:** PPAP Workflow reads file metadata to confirm access rights

**Step 5: PPAP Workflow Stores File References**
- **Source:** PPAP Workflow
- **Contract:** Reference
- **Target:** Workspace/Vault (file IDs)
- **Action:** PPAP Workflow stores file ID references in its own PPAP attachment tracking

**Step 6: PPAP Workflow Re-Evaluates Completeness**
- **Source:** PPAP Workflow
- **Contract:** (internal)
- **Target:** (own state)
- **Action:** PPAP Workflow re-evaluates PPAP completeness based on new attachments

**Step 7: PPAP Workflow Emits Attachment Event**
- **Source:** PPAP Workflow
- **Contract:** Event
- **Target:** Command Center
- **Action:** PPAP Workflow emits "Attachments Updated" event

**Step 8: Command Center Refreshes PPAP View**
- **Source:** Command Center
- **Contract:** Read
- **Target:** PPAP Workflow
- **Action:** Command Center reads updated PPAP attachment list

### D. Ownership Validation

✅ **PPAP Workflow** retained exclusive ownership of:
- PPAP attachment tracking
- PPAP completeness determination

✅ **Workspace/Vault** retained exclusive ownership of:
- File storage
- File access control

✅ **No Cross-Domain Mutation:**
- PPAP Workflow did NOT copy files (only stored references)
- PPAP Workflow did NOT modify file metadata
- Workspace/Vault did NOT infer PPAP relationships

✅ **Authority Preserved:**
- PPAP Workflow decided whether attachments satisfy requirements
- Workspace/Vault controlled file access
- User authorized attachment

### E. Interface Compliance Check

✅ **All Interactions Used Approved Contract Types:**
- Request (Command Center → PPAP Workflow)
- Read (PPAP Workflow → Workspace/Vault)
- Reference (PPAP Workflow holds file IDs)
- Event (PPAP Workflow → Command Center)

✅ **No Prohibited Patterns:**
- No file duplication (PPAP Workflow holds references only)
- No shared mutable state
- No hidden coupling

✅ **No Implicit Communication:**
- All interactions explicit via defined contracts

### F. Potential Violation Points

**Violation Risk 1:** PPAP Workflow copying files into its own storage
- **Why Tempting:** Ensure file availability, avoid broken references
- **Why Prohibited:** Workspace/Vault is authoritative for files; PPAP Workflow may only hold references

**Violation Risk 2:** Workspace/Vault auto-tagging files as "PPAP attachments"
- **Why Tempting:** Better organization
- **Why Prohibited:** Workspace/Vault MUST NOT infer business relationships

**Violation Risk 3:** PPAP Workflow reading file content to determine document type
- **Why Tempting:** Auto-classify attachments
- **Why Prohibited:** PPAP Workflow should rely on user-provided metadata, not interpret file content

### G. Enforcement Notes

**Rule 1 (V3.2B):** Reference Contract — reference is not copy of truth
- **Prevents:** PPAP Workflow duplicating files

**Rule 2 (V3.2A):** Workspace/Vault MUST NOT infer relationships between files
- **Prevents:** Workspace/Vault tagging files based on PPAP association

**Rule 3 (V3.2A):** Workspace/Vault MUST NOT interpret file content
- **Prevents:** Workspace/Vault or PPAP Workflow analyzing file semantics

---

## Scenario 5: Evaluate PPAP Readiness

### A. Scenario Description

**Real-World Use Case:** Engineer checks whether a PPAP submission is ready for approval (all documents complete, all requirements satisfied).

**User Action:** Navigate to PPAP, view status dashboard, check readiness indicator.

### B. Domains Involved

- PPAP Workflow (owns PPAP status, readiness determination)
- Document Copilot (provides document state indicators)
- Workspace/Vault (provides file references)
- Command Center (user entry point)

### C. Step-by-Step Interaction Flow

**Step 1: User Requests PPAP Status**
- **Source:** Command Center
- **Contract:** Read
- **Target:** PPAP Workflow
- **Action:** User views PPAP; Command Center reads PPAP status from PPAP Workflow

**Step 2: PPAP Workflow Reads Document States**
- **Source:** PPAP Workflow
- **Contract:** Read
- **Target:** Document Copilot
- **Action:** PPAP Workflow reads draft/final state indicators for required documents

**Step 3: PPAP Workflow Reads File References**
- **Source:** PPAP Workflow
- **Contract:** Read
- **Target:** Workspace/Vault
- **Action:** PPAP Workflow reads file metadata to confirm attachments exist

**Step 4: PPAP Workflow Evaluates Readiness**
- **Source:** PPAP Workflow
- **Contract:** (internal)
- **Target:** (own state)
- **Action:** PPAP Workflow evaluates readiness based on requirements vs. available documents/files

**Step 5: PPAP Workflow Updates Status**
- **Source:** PPAP Workflow
- **Contract:** Output
- **Target:** (own state)
- **Action:** PPAP Workflow updates PPAP status (e.g., "ready for review" or "incomplete")

**Step 6: Command Center Displays Readiness**
- **Source:** Command Center
- **Contract:** Read
- **Target:** PPAP Workflow
- **Action:** Command Center reads and displays PPAP readiness status

### D. Ownership Validation

✅ **PPAP Workflow** retained exclusive ownership of:
- PPAP readiness determination
- PPAP status
- Completeness evaluation logic

✅ **Document Copilot** retained exclusive ownership of:
- Draft/final state indicators

✅ **Workspace/Vault** retained exclusive ownership of:
- File existence and metadata

✅ **No Cross-Domain Mutation:**
- Command Center did NOT compute readiness (read from PPAP Workflow)
- Document Copilot did NOT determine PPAP completeness
- Workspace/Vault did NOT infer PPAP requirements

✅ **Authority Preserved:**
- PPAP Workflow decided readiness
- Document Copilot provided state indicators only
- Workspace/Vault provided file metadata only

### E. Interface Compliance Check

✅ **All Interactions Used Approved Contract Types:**
- Read (Command Center → PPAP Workflow, PPAP Workflow → Document Copilot, Workspace/Vault)
- Output (PPAP Workflow status update)

✅ **No Prohibited Patterns:**
- No Command Center computing authoritative workflow state
- No duplicated readiness logic
- No hidden coupling

✅ **No Implicit Communication:**
- All interactions explicit via defined contracts

### F. Potential Violation Points

**Violation Risk 1:** Command Center computing readiness based on document counts
- **Why Tempting:** Faster display, reduce backend calls
- **Why Prohibited:** Command Center MUST NOT compute authoritative workflow state; PPAP Workflow is exclusive authority

**Violation Risk 2:** Document Copilot marking PPAP as "complete" based on draft finalization
- **Why Tempting:** Automation
- **Why Prohibited:** Document Copilot MUST NOT determine workflow completeness; PPAP Workflow decides

**Violation Risk 3:** Shared "readiness_cache" table written by both PPAP Workflow and Command Center
- **Why Tempting:** Performance optimization
- **Why Prohibited:** Shared mutable state is strictly forbidden

### G. Enforcement Notes

**Rule 1 (V3.2A):** PPAP Workflow is ONLY domain authorized to determine readiness
- **Prevents:** Command Center or Document Copilot computing readiness

**Rule 2 (V3.2B):** Command Center MUST NOT compute authoritative workflow state
- **Prevents:** Command Center deriving readiness from document counts

**Rule 3 (V3.2A):** Shared mutable state is strictly prohibited
- **Prevents:** Shared readiness cache

**Rule 4 (V3.2B):** Read Contract does NOT imply authority
- **Prevents:** Document Copilot or Workspace/Vault inferring PPAP completeness

---

## Scenario 6: User Works from Command Center

### A. Scenario Description

**Real-World Use Case:** Engineer uses Command Center as primary interface to view all PPAPs, documents, and tasks; initiates actions from unified dashboard.

**User Action:** Open Command Center, view aggregated task list, click action to navigate to PPAP or start document generation.

### B. Domains Involved

- Command Center (aggregation, presentation)
- PPAP Workflow (PPAP data)
- Document Copilot (document session data)
- Workspace/Vault (file data)
- EMIP (component data)
- Core Platform (identity, auth)

### C. Step-by-Step Interaction Flow

**Step 1: User Opens Command Center**
- **Source:** Command Center
- **Contract:** Read
- **Target:** Core Platform
- **Action:** Command Center reads user identity and authorization

**Step 2: Command Center Reads PPAP Data**
- **Source:** Command Center
- **Contract:** Read
- **Target:** PPAP Workflow
- **Action:** Command Center reads user's assigned PPAPs, statuses, assignments

**Step 3: Command Center Reads Document Session Data**
- **Source:** Command Center
- **Contract:** Read
- **Target:** Document Copilot
- **Action:** Command Center reads active document sessions, draft states

**Step 4: Command Center Reads Workspace Files**
- **Source:** Command Center
- **Contract:** Read
- **Target:** Workspace/Vault
- **Action:** Command Center reads recent files, storage usage

**Step 5: Command Center Reads Component Data (optional)**
- **Source:** Command Center
- **Contract:** Read
- **Target:** EMIP
- **Action:** Command Center reads component names for display

**Step 6: Command Center Aggregates View**
- **Source:** Command Center
- **Contract:** Output
- **Target:** (presentation layer)
- **Action:** Command Center aggregates data into unified task surface

**Step 7: User Initiates Action**
- **Source:** Command Center (user input)
- **Contract:** Request
- **Target:** PPAP Workflow or Document Copilot
- **Action:** User clicks action (e.g., "Start Document"); Command Center delegates to owning domain

**Step 8: Owning Domain Executes Action**
- **Source:** PPAP Workflow or Document Copilot
- **Contract:** (varies)
- **Target:** (varies)
- **Action:** Owning domain executes requested action

**Step 9: Owning Domain Emits Event**
- **Source:** PPAP Workflow or Document Copilot
- **Contract:** Event
- **Target:** Command Center
- **Action:** Owning domain emits state change event

**Step 10: Command Center Refreshes View**
- **Source:** Command Center
- **Contract:** Read
- **Target:** PPAP Workflow or Document Copilot
- **Action:** Command Center reads updated state to refresh display

### D. Ownership Validation

✅ **Command Center** retained NO authoritative ownership:
- Command Center is read-only aggregation
- All displayed data sourced from owning domains

✅ **PPAP Workflow** retained exclusive ownership of:
- PPAP state, status, assignments

✅ **Document Copilot** retained exclusive ownership of:
- Document session state

✅ **Workspace/Vault** retained exclusive ownership of:
- File storage

✅ **EMIP** retained exclusive ownership of:
- Component data

✅ **No Cross-Domain Mutation:**
- Command Center did NOT modify any domain's data
- Command Center delegated all actions to owning domains

✅ **Authority Preserved:**
- Command Center presented data only
- Owning domains executed all actions
- Command Center did NOT compute authoritative state

### E. Interface Compliance Check

✅ **All Interactions Used Approved Contract Types:**
- Read (Command Center → all domains)
- Request (Command Center → PPAP Workflow, Document Copilot)
- Event (owning domains → Command Center)
- Reference (Command Center holds IDs for navigation)

✅ **No Prohibited Patterns:**
- No Command Center computing authoritative workflow state
- No cached authoritative business data in Command Center
- No shadow orchestration logic

✅ **No Implicit Communication:**
- All interactions explicit via defined contracts
- Command Center did NOT assume domain behavior

### F. Potential Violation Points

**Violation Risk 1:** Command Center caching PPAP status as authoritative
- **Why Tempting:** Performance, reduce backend calls
- **Why Prohibited:** Command Center MUST NOT cache as authoritative; must refresh from PPAP Workflow

**Violation Risk 2:** Command Center computing "overall progress" metric
- **Why Tempting:** Better UX, unified view
- **Why Prohibited:** Command Center MUST NOT compute authoritative workflow state; must read from PPAP Workflow

**Violation Risk 3:** Command Center directly updating PPAP assignment
- **Why Tempting:** Faster, fewer hops
- **Why Prohibited:** Command Center is read-only; must delegate to PPAP Workflow

**Violation Risk 4:** Command Center becoming orchestration layer
- **Why Tempting:** Centralized control
- **Why Prohibited:** Command Center MUST NOT store business logic or orchestrate workflows

### G. Enforcement Notes

**Rule 1 (V3.2A):** Command Center is read-only aggregation ONLY
- **Prevents:** Command Center caching authoritative data or computing state

**Rule 2 (V3.2B):** Command Center MUST delegate all actions to owning domains
- **Prevents:** Command Center directly mutating domain data

**Rule 3 (V3.2B):** Read Contract does NOT imply authority
- **Prevents:** Command Center treating aggregated data as authoritative

**Rule 4 (V3.2A):** Command Center MUST NOT become shadow orchestration layer
- **Prevents:** Command Center storing business logic

---

## Scenario 7: EMIP Data Referenced in Document Creation

### A. Scenario Description

**Real-World Use Case:** Engineer generates a document that requires component specifications from EMIP (e.g., Control Plan referencing component tolerances).

**User Action:** Start document generation, Copilot automatically pulls component data from EMIP, user reviews and approves.

### B. Domains Involved

- Document Copilot (owns draft generation)
- EMIP (owns component data)
- PPAP Workflow (owns PPAP context, optional)
- Workspace/Vault (owns file storage)
- Command Center (user entry point)

### C. Step-by-Step Interaction Flow

**Step 1: User Initiates Document Generation**
- **Source:** Command Center
- **Contract:** Request
- **Target:** Document Copilot
- **Action:** User starts Control Plan generation

**Step 2: Document Copilot Reads PPAP Context (if PPAP-bound)**
- **Source:** Document Copilot
- **Contract:** Read
- **Target:** PPAP Workflow
- **Action:** Document Copilot reads PPAP component ID

**Step 3: Document Copilot Reads Component Data**
- **Source:** Document Copilot
- **Contract:** Read
- **Target:** EMIP
- **Action:** Document Copilot reads component specifications, tolerances, relationships from EMIP

**Step 4: Document Copilot Generates Draft with Component Data**
- **Source:** Document Copilot
- **Contract:** Output
- **Target:** (internal session state)
- **Action:** Document Copilot generates draft incorporating EMIP component data

**Step 5: User Approves Draft**
- **Source:** Command Center (user input)
- **Contract:** Request
- **Target:** Document Copilot
- **Action:** User approves draft

**Step 6: Document Copilot Requests File Storage**
- **Source:** Document Copilot
- **Contract:** Request
- **Target:** Workspace/Vault
- **Action:** Document Copilot requests file storage

**Step 7: Workspace/Vault Stores File**
- **Source:** Workspace/Vault
- **Contract:** Output
- **Target:** (internal storage)
- **Action:** Workspace/Vault stores file with embedded component data

### D. Ownership Validation

✅ **EMIP** retained exclusive ownership of:
- Component specifications
- Component relationships
- Product structure

✅ **Document Copilot** retained exclusive ownership of:
- Draft generation logic
- How component data is incorporated into document

✅ **Workspace/Vault** retained exclusive ownership of:
- File storage

✅ **No Cross-Domain Mutation:**
- Document Copilot did NOT modify EMIP data
- Document Copilot did NOT infer component relationships (read from EMIP)
- Workspace/Vault did NOT interpret component data in file

✅ **Authority Preserved:**
- EMIP remained authoritative for component data
- Document Copilot decided how to present data in document
- Workspace/Vault stored file without interpretation

### E. Interface Compliance Check

✅ **All Interactions Used Approved Contract Types:**
- Request (Command Center → Document Copilot, Document Copilot → Workspace/Vault)
- Read (Document Copilot → EMIP, PPAP Workflow)
- Output (Document Copilot session state, Workspace/Vault file storage)

✅ **No Prohibited Patterns:**
- No Document Copilot caching EMIP data as authoritative
- No Document Copilot inferring component relationships
- No duplicated component data

✅ **No Implicit Communication:**
- All interactions explicit via defined contracts

### F. Potential Violation Points

**Violation Risk 1:** Document Copilot caching EMIP component data as authoritative
- **Why Tempting:** Performance, avoid repeated reads
- **Why Prohibited:** EMIP is authoritative; Document Copilot may only hold references

**Violation Risk 2:** Document Copilot inferring component relationships not provided by EMIP
- **Why Tempting:** Fill gaps, improve document quality
- **Why Prohibited:** Only EMIP MAY define component relationships

**Violation Risk 3:** Workspace/Vault extracting component data from stored file for indexing
- **Why Tempting:** Better search, organization
- **Why Prohibited:** Workspace/Vault MUST NOT interpret file content

### G. Enforcement Notes

**Rule 1 (V3.2B):** Reference Contract — reference is not copy of truth
- **Prevents:** Document Copilot caching EMIP data as authoritative

**Rule 2 (V3.2A):** Only EMIP MAY define component relationships
- **Prevents:** Document Copilot inferring relationships

**Rule 3 (V3.2A):** Workspace/Vault MUST NOT interpret file content
- **Prevents:** Workspace/Vault extracting component data

**Rule 4 (V3.2B):** Read Contract does NOT imply authority
- **Prevents:** Document Copilot treating read data as owned

---

## Scenario 8: Resume Interrupted Copilot Session

### A. Scenario Description

**Real-World Use Case:** Engineer starts document generation, session is interrupted (browser crash, network issue), engineer returns later to resume.

**User Action:** Navigate to document sessions, select interrupted session, resume from last state.

### B. Domains Involved

- Document Copilot (owns session state)
- PPAP Workflow (owns PPAP context, optional)
- Workspace/Vault (owns source files)
- EMIP (owns component data)
- Command Center (user entry point)
- Core Platform (identity, auth)

### C. Step-by-Step Interaction Flow

**Step 1: User Requests Session List**
- **Source:** Command Center
- **Contract:** Read
- **Target:** Document Copilot
- **Action:** User views active sessions; Command Center reads session list from Document Copilot

**Step 2: User Selects Interrupted Session**
- **Source:** Command Center (user input)
- **Contract:** Request
- **Target:** Document Copilot
- **Action:** User selects session ID; Command Center sends resume request to Document Copilot

**Step 3: Document Copilot Validates User Identity**
- **Source:** Document Copilot
- **Contract:** Read
- **Target:** Core Platform
- **Action:** Document Copilot confirms user owns session

**Step 4: Document Copilot Reads Session State**
- **Source:** Document Copilot
- **Contract:** (internal)
- **Target:** (own session store)
- **Action:** Document Copilot loads session state (draft content, unresolved questions, context)

**Step 5: Document Copilot Re-Reads PPAP Context (if stale)**
- **Source:** Document Copilot
- **Contract:** Read
- **Target:** PPAP Workflow
- **Action:** Document Copilot refreshes PPAP context if needed

**Step 6: Document Copilot Re-Reads Source Files (if stale)**
- **Source:** Document Copilot
- **Contract:** Read
- **Target:** Workspace/Vault
- **Action:** Document Copilot refreshes file references if needed

**Step 7: Document Copilot Re-Reads Component Data (if stale)**
- **Source:** Document Copilot
- **Contract:** Read
- **Target:** EMIP
- **Action:** Document Copilot refreshes component data if needed

**Step 8: Document Copilot Resumes Session**
- **Source:** Document Copilot
- **Contract:** Output
- **Target:** (session state)
- **Action:** Document Copilot presents resumed session to user

**Step 9: User Continues and Approves**
- **Source:** Command Center (user input)
- **Contract:** Request
- **Target:** Document Copilot
- **Action:** User completes session and approves draft

**Step 10: Document Copilot Requests File Storage**
- **Source:** Document Copilot
- **Contract:** Request
- **Target:** Workspace/Vault
- **Action:** Document Copilot requests file storage

### D. Ownership Validation

✅ **Document Copilot** retained exclusive ownership of:
- Session state
- Draft content
- Session lifecycle

✅ **PPAP Workflow** retained exclusive ownership of:
- PPAP context

✅ **Workspace/Vault** retained exclusive ownership of:
- Source files

✅ **EMIP** retained exclusive ownership of:
- Component data

✅ **No Cross-Domain Mutation:**
- Document Copilot did NOT cache stale PPAP/EMIP/Vault data as authoritative
- Document Copilot refreshed from source domains

✅ **Authority Preserved:**
- Document Copilot owned session state
- Source domains remained authoritative for context data
- Document Copilot handled staleness by re-reading

### E. Interface Compliance Check

✅ **All Interactions Used Approved Contract Types:**
- Read (Command Center → Document Copilot, Document Copilot → PPAP Workflow, Workspace/Vault, EMIP, Core Platform)
- Request (Command Center → Document Copilot, Document Copilot → Workspace/Vault)
- Output (Document Copilot session state)

✅ **No Prohibited Patterns:**
- No Document Copilot caching stale data as authoritative
- No duplicated truth stores
- No hidden coupling

✅ **No Implicit Communication:**
- All interactions explicit via defined contracts
- Document Copilot explicitly refreshed stale references

### F. Potential Violation Points

**Violation Risk 1:** Document Copilot caching PPAP/EMIP/Vault data in session state as authoritative
- **Why Tempting:** Avoid re-reading, faster resume
- **Why Prohibited:** Source domains are authoritative; Document Copilot must refresh stale references

**Violation Risk 2:** Document Copilot assuming cached data is still valid
- **Why Tempting:** Simpler logic, performance
- **Why Prohibited:** References may become stale; Document Copilot must handle staleness

**Violation Risk 3:** Shared session state table written by both Document Copilot and PPAP Workflow
- **Why Tempting:** Keep session in sync with PPAP changes
- **Why Prohibited:** Shared mutable state is strictly forbidden

### G. Enforcement Notes

**Rule 1 (V3.2B):** Reference Contract — reference may become stale; consuming domain must handle staleness
- **Prevents:** Document Copilot assuming cached data is valid

**Rule 2 (V3.2B):** Read Contract — reader must refresh from source when needed
- **Prevents:** Document Copilot caching stale data as authoritative

**Rule 3 (V3.2A):** Shared mutable state is strictly prohibited
- **Prevents:** Shared session state table

**Rule 4 (V3.2B):** Owning domain controls lifecycle
- **Prevents:** Other domains modifying Document Copilot session state

---

## Cross-Scenario Integrity Check

**Validation Across All 8 Scenarios:**

### 1. Contract Type Coverage

✅ **All scenarios executed using ONLY the five defined contract types:**
- **Read Contract:** Used in all scenarios for consuming outputs
- **Request Contract:** Used for delegating actions to owning domains
- **Output Contract:** Used for exposing stable domain outputs
- **Event Contract:** Used for informational notifications
- **Reference Contract:** Used for holding foreign entity pointers

✅ **No new contract types required**

### 2. Ownership Boundary Preservation

✅ **No ownership violations occurred:**
- PPAP Workflow retained exclusive authority for PPAP state, status, readiness
- Document Copilot retained exclusive authority for draft generation, session state
- Workspace/Vault retained exclusive authority for file storage
- EMIP retained exclusive authority for component data
- Command Center remained read-only aggregation
- Core Platform remained infrastructure foundation

✅ **No cross-domain mutation detected**

### 3. Prohibited Pattern Avoidance

✅ **No prohibited patterns were required:**
- No direct cross-domain mutation
- No shared mutable state
- No duplicated truth stores
- No hidden dependency on internal fields
- No UI-layer inference becoming workflow truth
- No file metadata becoming semantic authority
- No Copilot output treated as final without approval
- No temporary shared ownership

✅ **All scenarios followed approved patterns**

### 4. Interface Compliance

✅ **All interactions used approved contract types:**
- Every domain interaction explicitly declared contract type
- No implicit or hidden communication
- No undocumented behavior required

✅ **No silent coupling introduced**

### 5. Workflow Decomposability

✅ **All multi-step flows remained decomposable into discrete contract interactions:**
- Each step clearly identified source, target, contract type, action
- No hidden workflow state outside domain ownership
- All workflows traceable and auditable

✅ **No implicit orchestration required**

### 6. Authority Preservation

✅ **Exclusive authority remained with correct domains:**
- PPAP Workflow decided status, readiness, completeness
- Document Copilot decided draft generation logic
- Workspace/Vault decided file storage
- EMIP decided component relationships
- Users approved drafts before finalization

✅ **No authority leakage detected**

### 7. Reference Handling

✅ **All references handled correctly:**
- References treated as pointers, not truth copies
- Owning domains controlled lifecycle
- Consuming domains handled staleness
- No references promoted to authoritative copies

✅ **No reference ownership confusion**

### 8. Event Handling

✅ **All events handled correctly:**
- Events described past occurrences, not commands
- Events did NOT transfer ownership
- Consumers reacted within their own boundaries
- Events were informational, not prescriptive

✅ **No event authority transfer**

---

## Architectural Gaps Discovered

**Gap Analysis Result:** ✅ **NO ARCHITECTURAL GAPS FOUND**

All eight scenarios executed successfully using only:
- V3.2A domain ownership rules
- V3.2B interface contract types
- Existing anti-drift rules

**No scenarios required:**
- New contract types
- Ownership changes
- Shared state
- Interpretation outside contracts
- Undocumented behavior

**Conclusion:** V3.2A and V3.2B are **architecturally complete** for real-world workflows.

---

## Scenario Enforcement Rules

The following rules govern scenario validation and future workflow design:

### Rule 1: All Workflows MUST Be Expressible as Contract Sequences

**Every workflow MUST be decomposable into a sequence of explicit contract interactions.**

If a workflow cannot be expressed using Read, Request, Output, Event, or Reference contracts, the workflow design is invalid.

### Rule 2: No Workflow May Require Implicit State Sharing

**No workflow MUST require shared mutable state across domains.**

All coordination MUST occur via explicit contracts. Implicit state sharing is prohibited.

### Rule 3: All Multi-Step Flows MUST Remain Decomposable

**Every multi-step workflow MUST be traceable as discrete contract interactions.**

Each step MUST clearly identify:
- Source domain
- Target domain
- Contract type
- Action description

Hidden or implicit steps are prohibited.

### Rule 4: No Domain May Retain Hidden Workflow State Outside Its Ownership

**All workflow state MUST reside in the owning domain.**

No domain may cache or store workflow state that belongs to another domain. References are allowed; authoritative copies are not.

### Rule 5: Workflows MUST Preserve Exclusive Authority

**Every workflow MUST preserve exclusive authority with the correct domain.**

Even when consuming cross-domain data, the owning domain retains exclusive authority to make decisions within its scope.

### Rule 6: Workflows MUST Handle Reference Staleness

**All workflows using Reference Contracts MUST handle potential staleness.**

References may become stale. Consuming domains MUST refresh from source when needed.

### Rule 7: Workflows MUST NOT Assume Event Implies Authority Transfer

**No workflow MUST treat events as authority transfer.**

Events are informational. Consumers react within their own boundaries; they do not assume ownership.

### Rule 8: Workflows MUST Delegate Actions to Owning Domains

**All state-changing actions MUST be delegated to the owning domain.**

No domain may perform actions on another domain's data. Request Contracts MUST be used.

### Rule 9: Workflows MUST Be Auditable

**Every workflow MUST be auditable via contract trace.**

Implementation MUST log contract interactions for debugging and compliance verification.

### Rule 10: Workflow Design MUST Declare Contract Types Before Implementation

**Before implementing any workflow, designers MUST declare:**
- Domains involved
- Contract types used
- Ownership preservation proof
- Prohibited pattern avoidance confirmation

Workflows without explicit contract declarations are prohibited.

---

## Governance for Scenario Validation

**This scenario validation is authoritative.** All future workflows **MUST** follow these patterns.

**New Workflows Require:**
1. Scenario definition (as per V3.2C format)
2. Step-by-step contract trace
3. Ownership validation
4. Interface compliance check
5. Potential violation point identification
6. Enforcement note documentation

**Workflow Rejection Criteria:**
- Cannot be expressed as contract sequence
- Requires shared mutable state
- Violates ownership boundaries
- Uses prohibited patterns
- Requires undocumented behavior
- Cannot be decomposed into discrete steps

**Workflow Approval Criteria:**
- All steps use approved contract types
- Ownership preserved throughout
- No prohibited patterns required
- Fully decomposable and auditable
- Enforcement mechanisms clear

---

## V3.2D — Failure & Edge Case Scenario Validation

**Status:** 🔲 Not Started  
**Phase:** Pre-Implementation Validation  
**Objective:** Stress test the contract-based architecture under failure conditions and edge cases to identify architectural gaps before implementation.

**Validation Approach:**
This section tests the system's behavior when normal conditions are violated—interrupted sessions, stale data, concurrent modifications, and partial failures. Each scenario traces how the contract system handles degraded states and whether ownership boundaries remain enforceable.

**Success Criteria:**
- All failure modes map to explicit contract violations or recovery paths
- Ownership boundaries remain clear even during failures
- No architectural gaps that would force prohibited patterns
- Recovery paths align with governance model

---

### Scenario 1: Copilot Session Interrupted Mid-Generation

**Trigger Condition:**
User is actively engaged with Copilot to generate PPAP documentation using the Document Engine. Mid-generation, the browser crashes, network disconnects, or the Copilot service times out.

**Failure Mode:**
- Partial document content may exist in memory but not committed to vault
- User's session state (context, conversation history) is lost
- PPAP state may have been read but not locked
- Copilot may have queued operations that never completed

**Contract Trace Under Failure:**

1. **Session Initiation (Pre-Failure):**
   - User requests document generation via `/ppap/[id]/documents`
   - Frontend queries `DocumentEngine` for PPAP context
   - `DocumentEngine` reads PPAP state via `PPAPRepository`
   - Copilot begins streaming response with document content

2. **Interruption Point:**
   - Connection severed during streaming response
   - No explicit transaction boundary exists for Copilot session
   - PPAP state was read but not modified
   - No vault write has occurred

3. **System State After Failure:**
   - PPAP state: **unchanged** (read-only operation)
   - Vault: **unchanged** (no commit occurred)
   - User context: **lost** (ephemeral session data)
   - Copilot conversation: **lost** (not persisted)

**Ownership Boundary Behavior:**

- **PPAP Ownership:** Remains with supplier (no change attempted)
- **Document Ownership:** No document created, no ownership established
- **Copilot Session Ownership:** User session is ephemeral; no ownership violation on loss

**Recovery Path:**

1. User reopens `/ppap/[id]/documents` route
2. System re-reads current PPAP state (no stale data risk since nothing was modified)
3. User restarts Copilot session from scratch
4. Previous partial work is lost, but system state is consistent
5. User regenerates document with fresh context

**Architectural Gap Verdict:**

**✅ NO GAP IDENTIFIED**

- Session interruption is handled gracefully by architecture
- Read-only PPAP queries have no side effects
- Vault atomicity ensures no partial document states
- Recovery requires user to restart session, which is acceptable UX trade-off
- No ownership boundaries are violated during failure or recovery

**Failure Handling Rule:**
Copilot sessions are **ephemeral and stateless** from the contract system's perspective. Interruptions result in clean rollback with no side effects. The system does not attempt to preserve or resume Copilot context.

---

### Scenario 2: User Resumes Session After PPAP State Changed

**Trigger Condition:**
User initiates Copilot session to generate documentation for PPAP X. While Copilot is idle (conversation paused, browser tab backgrounded), another user or automated workflow modifies PPAP X's state (e.g., status change, part number update, approval submission). User then resumes Copilot conversation and requests to finalize the document.

**Failure Mode:**
- Copilot's understanding of PPAP state may be stale
- Document content generated earlier may reference obsolete data
- User may attempt to commit document based on outdated assumptions
- No explicit version check exists in Copilot session

**Contract Trace Under Failure:**

1. **Session Start (T0):**
   - User queries `/ppap/[id]/documents` at time T0
   - `DocumentEngine` reads PPAP state: `{ status: "In Progress", partNumber: "P-1001" }`
   - Copilot generates draft content based on this snapshot

2. **Background Change (T1):**
   - Another user updates PPAP X via `/ppap/[id]/edit`
   - PPAP state becomes: `{ status: "Submitted", partNumber: "P-1001-Rev2" }`
   - This update follows `PPAPOwnershipContract` (ownership verified)

3. **Session Resume (T2):**
   - User resumes Copilot conversation
   - User says: "Finalize this document and save it"
   - Copilot has stale context from T0
   - Copilot may generate content referencing obsolete `status: "In Progress"`

4. **Commit Attempt (T3):**
   - User triggers save operation
   - `DocumentEngine` writes document to vault via `VaultService`
   - Vault write succeeds (no version check on PPAP state)
   - Document now references PPAP data that was accurate at T0 but stale at T3

**Ownership Boundary Behavior:**

- **PPAP Ownership:** Correctly transferred to second user at T1 (no issue)
- **Document Ownership:** User retains ownership of document they're creating
- **Data Consistency:** Document contains stale reference to PPAP state, but no ownership violation

**Recovery Path:**

1. **Detection:** System does not automatically detect staleness (no version tracking in Copilot session)
2. **Manual Detection:** User or reviewer notices document references incorrect PPAP state
3. **Correction:** User must manually regenerate document with current PPAP state
4. **Prevention:** User should re-query PPAP state before final commit

**Architectural Gap Verdict:**

**🚨 CONFIRMED GAP**

**Gap Analysis Against V3.2A/V3.2B:**

**Contract Trace:**
1. **Document Copilot reads PPAP state:** Uses **Read Contract** (V3.2B allowed per line 6748)
2. **PPAP Workflow owns PPAP state:** Single source of truth (V3.2A line 5682-5696)
3. **PPAP Workflow emits state change events:** Uses **Event Contract** (V3.2B line 6711)
4. **Document Copilot may consume events:** Allowed (V3.2B line 6751)

**The Gap:**

V3.2B Read Contract rules state (line 6516): *"Reader MUST refresh from source when needed"*

**But no contract type defines HOW Document Copilot knows refresh is needed.**

Three approaches exist, none are defined in V3.2B:

**Approach 1: Event-based staleness detection**
- Document Copilot subscribes to PPAP status change events during active session
- Updates internal session state when PPAP changes
- **Gap:** No requirement that Document Copilot MUST subscribe to events
- **Gap:** Event Contract is informational (line 6555), not prescriptive
- **Gap:** No contract type for "session invalidation" or "staleness notification"

**Approach 2: Pre-commit validation**
- Document Copilot re-reads PPAP state from PPAP Workflow before vault commit
- Compares to cached state, warns on mismatch
- **Gap:** No contract type for "version token" or "change detection"
- **Gap:** No defined pattern for atomic read-compare-commit

**Approach 3: Version token in Read Contract**
- Read Contract includes version/timestamp metadata
- Commit operation validates version token
- **Gap:** Read Contract (V3.2B) does not include versioning semantics
- **Gap:** No contract type for conditional commits based on version

**Who Detects Staleness?**

Per V3.2A/V3.2B ownership:
- **Document Copilot owns:** Session state (V3.2A line 5750)
- **PPAP Workflow owns:** PPAP state (V3.2A line 5682)

Document Copilot is responsible for detecting staleness in its own session state, BUT:
- No contract type supports staleness detection
- No pattern exists for Document Copilot to validate PPAP state freshness before commit

**Which Contract Communicates Staleness?**

**NONE.** The existing contract types cannot express this:
- **Read Contract:** One-time read, no version tracking
- **Event Contract:** Informational, no guarantee of delivery or subscription
- **Reference Contract:** Acknowledges staleness possibility but provides no detection mechanism
- **Request Contract:** Not applicable (no action being requested)
- **Output Contract:** Not applicable (data structure, not validation)

**Gap Confirmed Because:**

The V3.2A/V3.2B model provides no contract type for:
1. **Versioned reads** with staleness detection
2. **Conditional commits** based on source data version
3. **Staleness notification** from owning domain to consuming domain
4. **Session invalidation** when referenced data changes

**Required New Pattern:**

A **Versioned Read Contract** or **Conditional Commit Contract** that includes:
- Version token or timestamp with every read
- Validation mechanism before dependent operations
- Explicit contract for staleness detection and handling

**Failure Handling Rule:**
Document Copilot MUST implement pre-commit PPAP state validation, but this requires a contract pattern not defined in V3.2B. This is an architectural gap that must be closed before implementation.

---

### Scenario 3: File Referenced by Copilot is Deleted or Replaced

**Trigger Condition:**
User is using Copilot to generate a document that references specific vault files (e.g., "include data from Drawing-Rev3.pdf"). During the Copilot session, another user deletes Drawing-Rev3.pdf or replaces it with Drawing-Rev4.pdf. User then asks Copilot to finalize the document.

**Failure Mode:**
- Copilot may have cached metadata or content from the deleted file
- Document may contain links or references to files that no longer exist
- File replacement may go unnoticed, causing version mismatch
- No referential integrity check exists between documents and vault files

**Contract Trace Under Failure:**

1. **Session Start with File Reference (T0):**
   - User: "Generate PPAP summary including Drawing-Rev3.pdf"
   - Copilot queries `VaultService.getFile("Drawing-Rev3.pdf")`
   - `VaultService` returns file metadata and presigned URL
   - Copilot reads file content or metadata for inclusion in document

2. **File Deleted (T1):**
   - Another user deletes Drawing-Rev3.pdf via `/vault/delete`
   - `VaultService` removes file from storage
   - Deletion follows vault ownership rules (user had delete permission)

3. **Session Continues (T2):**
   - User: "Add a section referencing the drawing details"
   - Copilot may still have Drawing-Rev3.pdf content in conversation memory
   - Copilot generates text: "Refer to Drawing-Rev3.pdf for dimensional specs"

4. **Commit Attempt (T3):**
   - User saves generated document to vault
   - Document contains reference to "Drawing-Rev3.pdf"
   - No validation that referenced file still exists
   - Document is saved with broken reference

**Ownership Boundary Behavior:**

- **Vault File Ownership:** Correctly enforced during deletion at T1
- **Document Ownership:** User creating document retains ownership
- **Referential Integrity:** Not enforced (no ownership contract for references)

**Recovery Path:**

1. **Detection:** User or system discovers broken reference when attempting to access Drawing-Rev3.pdf
2. **Manual Fix:** User updates document to reference correct file (Drawing-Rev4.pdf) or removes reference
3. **Prevention:** No automatic mechanism to prevent this scenario

**Architectural Gap Verdict:**

**🚨 CONFIRMED GAP**

**Gap Analysis Against V3.2A/V3.2B:**

**Contract Trace:**
1. **Document Copilot reads files:** Uses **Read Contract** (V3.2B line 6747)
2. **Document Copilot holds file references:** Uses **Reference Contract** (V3.2B line 6765)
3. **Workspace/Vault owns files:** Single source of truth for file lifecycle (V3.2A line 5956)
4. **Workspace/Vault emits file deletion events:** Uses **Event Contract** (V3.2B line 6859)

**The Gap:**

V3.2B Reference Contract rules state (line 6567): *"Reference MAY become stale; consuming domain MUST handle staleness"*

**But no contract type defines HOW to handle staleness or validate reference integrity.**

**Who Owns Reference Validation?**

Per V3.2A ownership:
- **Workspace/Vault owns:** File lifecycle, deletion authority (V3.2A line 5956)
- **Document Copilot owns:** Session state, draft content, file references (V3.2A line 5750-5753)

Per V3.2B Reference Contract (line 6567): *"consuming domain MUST handle staleness"*

**Document Copilot is responsible for handling stale references.**

**The Problem: No Contract Type Supports This**

**Scenario: Workspace/Vault Deletes File**

1. **Event Contract Notification:**
   - Workspace/Vault emits "file deleted" event (V3.2B line 6859)
   - Event Contract is informational (line 6555): "describes past occurrence, not a command"
   - **Gap:** No guarantee Document Copilot is subscribed to these events during active session
   - **Gap:** No contract pattern for "interested party notification" before deletion

2. **Reference Validation:**
   - Document Copilot must validate references before committing document
   - Validation requires Read Contract to Workspace/Vault: "Does file X exist?"
   - **Gap:** No explicit contract type for "reference existence check"
   - **Gap:** Validation is point-in-time; file could be deleted immediately after check

3. **Referential Integrity Tracking:**
   - Option: Workspace/Vault tracks "who references what" before allowing deletion
   - **Gap:** This requires Workspace/Vault to hold semantic knowledge of document structure
   - **Violation:** V3.2B prohibits Workspace/Vault from interpreting file meaning (line 6850-6852)
   - **Gap:** No contract type for "register reference" or "reference tracking"

**What Happens If Vault Deletes File With No Active Notification Contract?**

Per V3.2B:
- Workspace/Vault emits "file deleted" event (line 6859)
- Event Contract does not require subscribers (informational only)
- Document Copilot may or may not be subscribed

Result:
- **If Document Copilot is subscribed:** Receives event, but has no contract pattern to invalidate session or warn user
- **If Document Copilot is NOT subscribed:** No notification occurs
- **Either way:** Document Copilot must poll Vault before commit to validate references

**Polling Requirement = Confirmed Gap**

If Document Copilot must poll Workspace/Vault to validate reference existence:
- **Gap:** No contract type for "reference validation query"
- **Gap:** No atomic "check-and-commit" operation
- **Gap:** No guarantee of referential consistency (file could be deleted between check and commit)

**Alternative: Vault Holds Reference Knowledge = Confirmed Gap**

If Workspace/Vault must track "which documents reference which files":
- **Gap:** Requires Workspace/Vault to understand document semantics
- **Violation:** V3.2B prohibits Workspace/Vault from semantic knowledge (line 6850-6852)
- **Gap:** No contract type for "register reference interest" or "reference counting"

**Gap Confirmed Because:**

The V3.2A/V3.2B model provides no contract type for:
1. **Reference integrity validation** before commit
2. **Reference tracking** across domain boundaries
3. **Interested party notification** before deletion
4. **Atomic reference checks** with commit guarantees
5. **Reference registration** without violating semantic ownership

**Required New Patterns:**

Either:
- **A) Reference Validation Contract:** Document Copilot can query Workspace/Vault for reference existence with atomic guarantees
- **B) Reference Interest Contract:** Document Copilot registers reference interest; Workspace/Vault notifies before deletion
- **C) Immutable Reference Contract:** Vault files are versioned; references never break (all versions retained)

None of these patterns exist in V3.2B.

**Failure Handling Rule:**
Document Copilot MUST validate vault file references before commit, but no contract type supports atomic validation or referential integrity enforcement. This is an architectural gap that must be closed before implementation.

---

### Scenario 4: EMIP Data Becomes Stale During Workflow

**Trigger Condition:**
PPAP workflow references EMIP data (component relationships, SKU specifications, BOM structure) at workflow initiation. During PPAP execution, EMIP data is updated externally (e.g., engineering change order modifies component spec, BOM is revised). PPAP workflow continues using cached or stale EMIP data.

**Failure Mode:**
- PPAP workflow decisions based on obsolete component relationships
- Document generation references outdated SKU specifications
- Workflow gates evaluate against stale BOM structure
- No synchronization mechanism between EMIP updates and active PPAP workflows

**Contract Trace Under Failure:**

1. **Workflow Start (T0):**
   - PPAP Workflow queries EMIP for component structure via Read Contract
   - EMIP returns: `{ componentID: "C-5001", spec: "Rev A", bomVersion: "v1.2" }`
   - PPAP Workflow caches this data for workflow decision-making

2. **EMIP Update (T1):**
   - External system updates EMIP: `{ componentID: "C-5001", spec: "Rev B", bomVersion: "v1.3" }`
   - EMIP owns this data (V3.2A line 5982-5993)
   - EMIP may emit "component updated" event (Event Contract)

3. **Workflow Continues (T2):**
   - PPAP Workflow uses cached Rev A data for workflow gate evaluation
   - Determines document requirements based on obsolete BOM v1.2
   - Document Copilot generates content referencing stale component spec

4. **State Inconsistency (T3):**
   - PPAP completes using Rev A assumptions
   - EMIP now reflects Rev B reality
   - Submitted PPAP references components that no longer match current engineering state

**Ownership Boundary Behavior:**

- **EMIP Ownership:** EMIP owns component data, correctly updated (V3.2A line 5982-5993)
- **PPAP Workflow Ownership:** PPAP owns workflow state and decisions (V3.2A line 5682-5696)
- **Data Consistency:** No ownership violation, but cross-domain data consistency not enforced

**Recovery Path:**

1. **Detection:** Post-submission review discovers PPAP references obsolete component specs
2. **Manual Correction:** PPAP must be revised or resubmitted with current EMIP data
3. **Prevention:** No automatic mechanism to detect EMIP staleness in active workflows

**Architectural Gap Verdict:**

**🚨 CONFIRMED GAP**

**Gap Analysis Against V3.2A/V3.2B:**

**Contract Trace:**
1. **PPAP Workflow reads EMIP data:** Uses **Read Contract** (V3.2B line 6698)
2. **EMIP owns component data:** Single source of truth (V3.2A line 5982-5993)
3. **EMIP may emit update events:** Uses **Event Contract** (V3.2B)
4. **PPAP Workflow may consume events:** Allowed (V3.2B line 6699)

**The Gap:**

V3.2B Read Contract rules state (line 6516): *"Reader MUST refresh from source when needed"*

**But PPAP Workflow has no mechanism to know WHEN refresh is needed.**

**Who Detects EMIP Staleness?**

Per V3.2A/V3.2B ownership:
- **EMIP owns:** Component data, SKU specifications (V3.2A line 5982-5993)
- **PPAP Workflow owns:** Workflow state, decision-making (V3.2A line 5682-5696)

PPAP Workflow is responsible for refreshing EMIP data, BUT:
- No contract type defines when refresh is required
- No pattern for EMIP to signal "dependent workflows must re-validate"
- No contract for PPAP to declare "I depend on EMIP version X"

**Which Contract Communicates Staleness?**

**NONE.** Same gap as Scenario 2:

**Event Contract Approach:**
- EMIP emits "component updated" events
- Event Contract is informational (line 6555), not prescriptive
- **Gap:** No guarantee PPAP Workflow is subscribed
- **Gap:** No contract pattern for "invalidate dependent workflows"
- **Gap:** PPAP Workflow may not know which EMIP entities it depends on

**Versioned Read Approach:**
- PPAP Workflow could re-read EMIP data before critical decisions
- **Gap:** No contract type for versioned reads
- **Gap:** No pattern for conditional workflow progression based on EMIP version

**Dependency Declaration Approach:**
- PPAP Workflow declares dependency on specific EMIP entities/versions
- EMIP notifies when those dependencies change
- **Gap:** No contract type for "dependency registration"
- **Gap:** No pattern for cross-domain dependency tracking

**Gap Confirmed Because:**

The V3.2A/V3.2B model provides no contract type for:
1. **Dependency declaration** between domains
2. **Version-aware reads** with staleness detection
3. **Invalidation notifications** for dependent workflows
4. **Cross-domain consistency validation**

**This is the SAME architectural gap as Scenario 2** (versioned reads/conditional operations).

**Failure Handling Rule:**
PPAP Workflow MUST re-validate EMIP dependencies before critical workflow gates, but no contract type supports dependency tracking or staleness detection. This is an architectural gap that must be closed before implementation.

---

### Scenario 5: Two Users Modify Same PPAP Simultaneously

**Trigger Condition:**
User A and User B both load PPAP X's edit interface simultaneously. User A modifies the PPAP status field and saves. User B, still viewing the pre-update state, modifies a different field (e.g., part number) and saves. User B's save overwrites User A's changes.

**Failure Mode:**
- Classic lost update problem (optimistic concurrency failure)
- Last write wins, earlier changes are silently lost
- No conflict detection or resolution mechanism
- Users not notified of concurrent modifications

**Contract Trace Under Failure:**

1. **Concurrent Read (T0):**
   - User A requests PPAP X via `/ppap/[id]`
   - User B requests PPAP X via `/ppap/[id]`
   - Both receive: `{ status: "In Progress", partNumber: "P-1001", version: 5 }`

2. **User A Modifies (T1):**
   - User A changes status to "Submitted"
   - Saves via PPAP Workflow domain
   - PPAP state becomes: `{ status: "Submitted", partNumber: "P-1001", version: 6 }`
   - PPAP Workflow emits "status changed" event (Event Contract)

3. **User B Modifies (T2):**
   - User B still has stale view (version 5)
   - User B changes partNumber to "P-1001-Rev2"
   - User B saves, overwrites entire PPAP entity
   - PPAP state becomes: `{ status: "In Progress", partNumber: "P-1001-Rev2", version: 7 }`
   - User A's status change is lost

4. **Result:**
   - User A's "Submitted" status silently reverted to "In Progress"
   - No conflict warning issued
   - Event stream shows: status changed → status reverted (appears as intentional reversal)

**Ownership Boundary Behavior:**

- **PPAP Ownership:** PPAP Workflow owns PPAP state (V3.2A line 5682)
- **User Authority:** Both users had legitimate edit permissions
- **Concurrency Control:** Not defined in V3.2A/V3.2B

**Recovery Path:**

1. **Detection:** User A notices status reverted to "In Progress" unexpectedly
2. **Manual Correction:** User A re-applies status change
3. **Prevention:** No optimistic concurrency control mechanism defined

**Architectural Gap Verdict:**

**🚨 CONFIRMED GAP — Same Root Cause as Scenarios 2, 4, 6**

**Gap Analysis Against V3.2A/V3.2B:**

**Contract Trace:**
1. **Users read PPAP state:** Uses **Read Contract** via frontend (V3.2A line 5724)
2. **Users request PPAP modification:** Uses **Request Contract** to PPAP Workflow
3. **PPAP Workflow owns mutation authority:** Exclusive (V3.2A line 5697-5707)

**Initial Analysis:**

This appears to be an internal PPAP Workflow concern: PPAP Workflow has exclusive authority to reject stale writes per Request Contract (V3.2B line 6527).

**Critical Question: HOW Does PPAP Workflow Detect Staleness?**

For PPAP Workflow to detect that User B's write is stale, it must:
1. Include version tokens in its **Output Contract** (when users read PPAP state)
2. Require version tokens in **Request Contract** (when users request mutations)
3. Compare version tokens to detect conflicts

**The Gap:**

V3.2B Output Contract (line 6538): *"Output MUST be versioned and controlled by owning domain"*

This refers to **API versioning** (v1, v2 of contract shape), NOT **entity versioning** (version tokens for optimistic concurrency).

**V3.2B provides no pattern for:**
- Including version/timestamp metadata in Output Contracts
- Requiring version tokens in Request Contracts
- Compare-and-swap semantics for mutation requests
- Conditional mutation based on entity version

**Why This IS the Same Gap as Scenarios 2, 4, 6:**

All four scenarios require the same pattern:
- **Scenario 2:** Document Copilot reads PPAP state, needs to detect if it changed before commit
- **Scenario 4:** PPAP Workflow reads EMIP data, needs to detect if it changed before workflow progression
- **Scenario 5:** Users read PPAP state, need to include version token for conflict detection
- **Scenario 6:** Document Copilot reads PPAP state, needs to detect if it changed before attachment

**The root cause is identical:** V3.2B lacks a contract pattern for version-aware reads and conditional operations.

**Scenario 5 is NOT special just because it's intra-domain:**
- Users consume PPAP state via Output Contract (read)
- Users request mutations via Request Contract (write)
- This is the same read-then-write pattern as cross-domain cases

**Gap Confirmed Because:**

To implement optimistic concurrency control, PPAP Workflow needs:
1. **Versioned Output Contract:** Include version metadata in outputs
2. **Versioned Request Contract:** Accept version tokens in mutation requests
3. **Compare-and-swap semantics:** Validate version before applying mutation

**None of these patterns are defined in V3.2B.**

While PPAP Workflow has authority to define these contracts however it wants, V3.2B provides:
- No guidance on version token patterns
- No contract semantics for conditional operations
- No standard approach to optimistic concurrency across the system

**This creates inconsistency risk:**
- Different domains may implement version tokens differently
- No standard version token format (ETag? Timestamp? Sequence number?)
- No guidance on version token validation semantics

**Verdict Clarification:**

**Initial verdict was wrong.** This is NOT an implementation detail. This is the **same architectural gap** as Scenarios 2, 4, and 6.

PPAP Workflow's authority to reject requests doesn't help if it has no contract pattern to detect which requests are stale.

**Failure Handling Rule:**
PPAP Workflow MUST implement optimistic concurrency control using the versioned read/conditional commit contract pattern identified as missing in Scenarios 2, 4, and 6. This is the same architectural gap.

---

### Scenario 6: PPAP Status Changes During Document Generation

**Trigger Condition:**
User initiates long-running document generation workflow (e.g., multi-document PPAP package generation). During generation, PPAP status changes (e.g., from "In Progress" to "Submitted" by another user or automated workflow). Document generation completes and attempts to attach documents to PPAP in new state.

**Failure Mode:**
- Documents generated for "In Progress" PPAP
- PPAP now in "Submitted" state (may be locked/immutable)
- Document attachment may fail due to workflow state restrictions
- Generated documents may be orphaned or rejected

**Contract Trace Under Failure:**

1. **Generation Start (T0):**
   - User initiates document generation for PPAP X
   - Document Copilot reads PPAP state: `{ status: "In Progress", locked: false }`
   - Copilot begins multi-step generation process

2. **Status Change (T1):**
   - Another user submits PPAP X via PPAP Workflow
   - PPAP state becomes: `{ status: "Submitted", locked: true }`
   - PPAP Workflow emits "status changed" event

3. **Generation Complete (T2):**
   - Document Copilot completes generation
   - Attempts to attach documents to PPAP via Request Contract
   - Requests Workspace/Vault to store files

4. **Attachment Attempt (T3):**
   - Document Copilot requests PPAP Workflow to record document completion
   - PPAP Workflow evaluates: PPAP is now "Submitted" and locked
   - May reject attachment due to workflow state restrictions
   - Documents are generated but cannot be associated with PPAP

**Ownership Boundary Behavior:**

- **PPAP Workflow Ownership:** Correctly enforces workflow state rules (V3.2A line 5697-5707)
- **Document Copilot Ownership:** Generated documents as requested (V3.2A line 5750-5763)
- **Request Contract Behavior:** PPAP Workflow has authority to reject (V3.2B line 6527)

**Recovery Path:**

1. **Detection:** Document attachment request is rejected
2. **User Decision:** User must decide whether to unlock PPAP or discard generated documents
3. **Manual Intervention:** Administrator unlocks PPAP, user re-attaches documents
4. **Prevention:** No mechanism to prevent or warn about status changes during generation

**Architectural Gap Verdict:**

**❓ NOT A CONTRACT GAP — WORKING AS DESIGNED**

**Gap Analysis Against V3.2A/V3.2B:**

**Contract Trace:**
1. **Document Copilot reads PPAP state:** Uses **Read Contract** (V3.2B line 6748)
2. **Document Copilot generates documents:** Internal process (V3.2A line 5750-5763)
3. **Document Copilot requests attachment:** Uses **Request Contract** (V3.2B line 6764)
4. **PPAP Workflow evaluates request:** Exercises exclusive authority (V3.2A line 5697-5707)

**The Analysis:**

This scenario demonstrates **Request Contract working as intended**.

**Why This Is NOT a Gap:**

Per V3.2B Request Contract (line 6527): *"Owning domain MUST decide whether and how to execute"*

PPAP Workflow has full authority to:
- Reject document attachment if workflow state prohibits it
- Enforce workflow gates and state restrictions
- Protect PPAP integrity even if work was already performed

**This is the correct behavior:**
- Document Copilot performed work based on stale PPAP state
- PPAP Workflow correctly rejected incompatible operation
- User receives clear error: "Cannot attach documents to submitted PPAP"

**The Real Issue: Same as Scenario 2**

This is another manifestation of the **versioned read gap** from Scenario 2:
- Document Copilot read PPAP state at T0
- PPAP state changed at T1
- No mechanism to detect staleness before committing work

**Verdict:**

**✅ NO NEW GAP — Same versioned read gap as Scenario 2**

- Request Contract is working correctly (rejection is valid)
- PPAP Workflow correctly enforces workflow state rules
- The staleness detection gap is already identified in Scenario 2

**Failure Handling Rule:**
Document Copilot MUST validate PPAP state before committing work, using the versioned read contract pattern identified as missing in Scenario 2. PPAP Workflow MUST reject incompatible requests with clear error messages.

---

### Scenario 7: Event Arrives Out-of-Order or Delayed

**Trigger Condition:**
PPAP Workflow emits sequence of events: (1) "PPAP created", (2) "status changed to In Progress", (3) "document attached". Due to network delays, message broker issues, or distributed system timing, Command Center receives events out of order: (2), (3), (1). Command Center processes events in received order, resulting in incorrect aggregated view.

**Failure Mode:**
- Command Center displays status change before PPAP exists
- Document attachment shown for non-existent PPAP
- Aggregated view is inconsistent with actual PPAP state
- Event replay or late-arriving events cause view corruption

**Contract Trace Under Failure:**

1. **Event Emission (T0-T2):**
   - T0: PPAP Workflow emits `PPAPCreated` (sequenceID: 1)
   - T1: PPAP Workflow emits `StatusChanged` (sequenceID: 2)
   - T2: PPAP Workflow emits `DocumentAttached` (sequenceID: 3)

2. **Event Delivery (T3-T5):**
   - T3: Command Center receives `StatusChanged` (sequenceID: 2)
   - T4: Command Center receives `DocumentAttached` (sequenceID: 3)
   - T5: Command Center receives `PPAPCreated` (sequenceID: 1) — delayed

3. **Command Center Processing:**
   - Processes sequenceID 2: Update status for PPAP X (PPAP not in local view yet → error or orphaned state)
   - Processes sequenceID 3: Attach document to PPAP X (PPAP still not in local view → error)
   - Processes sequenceID 1: Create PPAP X (now view shows PPAP without status updates or documents)

4. **Result:**
   - Command Center view is inconsistent
   - User sees PPAP in wrong state
   - Must manually refresh to reconcile

**Ownership Boundary Behavior:**

- **PPAP Workflow Ownership:** PPAP state is correct (V3.2A line 5682)
- **Command Center Ownership:** Aggregated view is corrupted (V3.2A line 5823-5837)
- **Event Contract:** Events were emitted correctly (V3.2B line 6547-6557)

**Recovery Path:**

1. **Detection:** Command Center detects orphaned events (references non-existent PPAP)
2. **Reconciliation:** Command Center re-queries PPAP Workflow for authoritative state
3. **Refresh:** User manually refreshes view to sync with source
4. **Prevention:** No event ordering guarantees defined

**Architectural Gap Verdict:**

**🚨 CONFIRMED GAP**

**Gap Analysis Against V3.2A/V3.2B:**

**Contract Trace:**
1. **PPAP Workflow emits events:** Uses **Event Contract** (V3.2B line 6711)
2. **Command Center consumes events:** Uses **Event Contract** (V3.2B line 6793)
3. **Command Center aggregates data:** Read-only aggregation (V3.2A line 5854)

**The Gap:**

V3.2B Event Contract (line 6551-6556):
- "Event describes a past occurrence, not a command"
- "Consumers MAY react within their own boundaries"
- "Consumers MUST NOT reinterpret event as authoritative state"

**But Event Contract provides no guarantees about:**
- Event ordering
- Event delivery timing
- Event deduplication
- Event sequence integrity

**Who Handles Event Ordering?**

Per V3.2A/V3.2B:
- **PPAP Workflow owns:** Event emission (V3.2B line 6711)
- **Command Center owns:** Event consumption and aggregation (V3.2A line 5823-5837)

**Command Center is responsible for handling out-of-order events, BUT:**
- No contract type defines event ordering semantics
- No pattern for sequence validation
- No mechanism for Command Center to request missing events

**Which Contract Provides Ordering Guarantees?**

**NONE.** Event Contract (V3.2B line 6547-6557) is silent on:
- Ordering guarantees (FIFO, causal, total order?)
- Sequence numbers or vector clocks
- Gap detection and recovery
- Idempotency requirements

**Failure Modes the Contract Model Cannot Handle:**

1. **Out-of-Order Events:**
   - Event Contract does not specify ordering guarantees
   - Command Center cannot know if events are out of order
   - No sequence number requirement in Event Contract

2. **Duplicate Events:**
   - Event Contract does not specify idempotency requirements
   - Command Center may process same event twice
   - No event ID or deduplication mechanism required

3. **Missing Events:**
   - Event Contract does not guarantee delivery
   - Command Center cannot detect gaps in event sequence
   - No pattern for requesting event replay

**Gap Confirmed Because:**

The V3.2A/V3.2B model provides no contract type for:
1. **Event ordering semantics** (FIFO, causal, or total order)
2. **Event sequence validation** (gap detection)
3. **Event replay mechanisms** (recovery from missing events)
4. **Idempotency contracts** (duplicate event handling)
5. **Causality tracking** (event dependencies)

**Required New Patterns:**

Event Contract MUST be extended with:
- **Sequence semantics:** Events include sequence numbers or vector clocks
- **Ordering guarantees:** Define required ordering (per-entity FIFO minimum)
- **Idempotency requirements:** Events include unique IDs for deduplication
- **Gap detection:** Consumers can detect missing sequence numbers
- **Replay mechanism:** Event sources provide event history query capability

**Mitigation Strategies:**

**Strategy A: Event Sourcing Pattern**
- All events include sequence numbers and entity IDs
- Command Center detects gaps and requests replay
- Requires new contract: **Event Replay Request Contract**

**Strategy B: Reconciliation Read Contract**
- Command Center periodically re-reads authoritative state from PPAP Workflow
- Events are hints, not truth; Read Contract is validation
- Already supported, but requires explicit reconciliation pattern

**Strategy C: Causal Ordering Contract**
- Events include causal dependencies (vector clocks, Lamport timestamps)
- Command Center buffers out-of-order events until dependencies satisfied
- Requires event contract extension

**Recommendation:** **Strategy B** (reconciliation via Read Contract) is already supported by V3.2B but needs explicit guidance. **Strategy A** requires new contract type.

**Failure Handling Rule:**
Command Center MUST treat events as hints and periodically reconcile aggregated views via Read Contract to PPAP Workflow. Event Contract must be extended with ordering and idempotency semantics. This is an architectural gap that must be closed before implementation.

---

### Scenario 8: Command Center Displays Stale Aggregated Data

**Trigger Condition:**
Command Center aggregates PPAP data from PPAP Workflow at time T0 and caches it for display performance. PPAP Workflow updates PPAP state at T1. Command Center continues displaying cached T0 data to users for minutes/hours until cache expires or user manually refreshes.

**Failure Mode:**
- Users make decisions based on stale aggregated view
- Command Center shows PPAP as "In Progress" when it's actually "Submitted"
- Assignments shown in Command Center don't match current PPAP Workflow state
- No automatic cache invalidation when source data changes

**Contract Trace Under Failure:**

1. **Initial Aggregation (T0):**
   - Command Center queries PPAP Workflow for user's assigned PPAPs
   - Receives: `[{ id: "PPAP-1", status: "In Progress", assignedTo: "User A" }]`
   - Caches data locally for performance

2. **Source Update (T1):**
   - PPAP Workflow changes PPAP-1 status to "Submitted"
   - PPAP Workflow emits "status changed" event
   - Command Center may or may not receive event (event delivery not guaranteed)

3. **Stale Display (T2):**
   - User views Command Center dashboard
   - Sees PPAP-1 as "In Progress" (cached from T0)
   - Actual state is "Submitted" (changed at T1)
   - User attempts to edit PPAP-1, receives error: "Cannot edit submitted PPAP"

4. **User Confusion:**
   - Dashboard shows "In Progress" but edit fails
   - No indication that view is stale
   - User must manually refresh to see current state

**Ownership Boundary Behavior:**

- **PPAP Workflow Ownership:** PPAP state is correct and authoritative (V3.2A line 5682)
- **Command Center Ownership:** Aggregated view is its own presentation (V3.2A line 5823-5837)
- **Caching Violation:** Command Center is treating cached data as authoritative truth

**Recovery Path:**

1. **Detection:** User discovers mismatch when action fails
2. **Manual Refresh:** User refreshes Command Center view
3. **Reconciliation:** Command Center re-queries PPAP Workflow for current state
4. **Prevention:** No automatic cache invalidation mechanism

**Architectural Gap Verdict:**

**❓ NOT A GAP — VIOLATES EXISTING RULE**

**Gap Analysis Against V3.2A/V3.2B:**

**Contract Trace:**
1. **Command Center reads PPAP data:** Uses **Read Contract** (V3.2B line 6792)
2. **PPAP Workflow owns PPAP state:** Single source of truth (V3.2A line 5682)
3. **Command Center caches data:** Presentation optimization

**The Analysis:**

V3.2B Read Contract rules state (line 6516):
- *"Reader MUST NOT cache data as authoritative truth"*
- *"Reader MUST refresh from source when needed"*

V3.2A Command Center rules state (line 5863):
- *"Cache or store authoritative business data"* is **PROHIBITED**

**Command Center is violating existing rules.**

**Why This Is NOT a New Gap:**

The architecture already prohibits this behavior:
- Command Center is explicitly read-only aggregation (V3.2A line 5854)
- Read Contract forbids caching as authoritative truth (V3.2B line 6516)
- Command Center may cache for performance, but must treat cache as hint, not truth

**The Correct Pattern:**

Command Center MAY cache for performance, but:
1. **Cache is not authoritative:** Always secondary to source data
2. **Stale cache is acceptable:** If clearly indicated to user
3. **Refresh on conflict:** Re-query source when cached data causes errors
4. **Event-based invalidation:** Use events as cache invalidation hints (optional)

**Alternatively, don't cache at all:**
- Query PPAP Workflow on every page load
- Accept performance cost for guaranteed freshness
- This is fully supported by Read Contract

**Verdict:**

**✅ NO ARCHITECTURAL GAP**

Command Center's caching issue is a **violation of existing V3.2B rules**, not a gap in the contract model.

**Correct implementation:**
- Either don't cache (always fresh reads)
- Or cache with clear staleness indicators and refresh-on-error behavior
- Use events as cache invalidation hints (Scenario 7 gap applies here)

**Failure Handling Rule:**
Command Center MUST NOT treat cached data as authoritative. Caching is permitted for performance optimization only if staleness is clearly indicated to users and cache is invalidated on conflicts. Preferably, rely on Read Contract for fresh data on every access.

---

### Scenario 9: Vault File Updated While Referenced Elsewhere

**Trigger Condition:**
User A uploads "Drawing-Rev1.pdf" to vault. Document Copilot references this file in a PPAP document. User B then uploads "Drawing-Rev2.pdf" and deletes "Drawing-Rev1.pdf". PPAP document now contains broken reference, or worse, reference silently resolves to Rev2 content when user expects Rev1.

**Failure Mode:**
- Document references file by name: "Drawing-Rev1.pdf"
- File is replaced with different content (Rev2)
- Document user expects Rev1 but gets Rev2
- Or file is deleted and reference breaks
- No versioning or immutability in vault

**Contract Trace Under Failure:**

1. **File Upload and Reference (T0):**
   - User A uploads Drawing-Rev1.pdf via Workspace/Vault
   - Vault assigns file ID: `file-abc123`
   - Document Copilot generates PPAP document referencing `file-abc123`
   - Document content: "See Drawing-Rev1.pdf for specifications"

2. **File Replacement (T1):**
   - User B uploads Drawing-Rev2.pdf to same location
   - Depending on vault implementation:
     - **Option A:** Overwrites file-abc123 with new content (ID reused)
     - **Option B:** Creates new file ID file-xyz789, deletes file-abc123

3. **Document Access (T2):**
   - User views PPAP document created at T0
   - Clicks reference to Drawing-Rev1.pdf
   - **Option A:** Gets Rev2 content (silent data corruption)
   - **Option B:** Gets 404 error (broken reference)

**Ownership Boundary Behavior:**

- **Workspace/Vault Ownership:** Correctly manages file lifecycle (V3.2A line 5956)
- **Document Copilot Ownership:** Correctly created reference at T0 (V3.2A line 5765)
- **File Versioning:** Not specified in V3.2A/V3.2B

**Recovery Path:**

1. **Option A (Overwrite):** User discovers they're viewing wrong file revision, must track down correct version
2. **Option B (Delete):** User discovers broken reference, must find and re-link correct file
3. **Prevention:** No versioning or immutability enforcement

**Architectural Gap Verdict:**

**❓ NOT A GAP — WORKSPACE/VAULT IMPLEMENTATION DETAIL**

**Gap Analysis Against V3.2A/V3.2B:**

**Contract Trace:**
1. **Document Copilot holds file reference:** Uses **Reference Contract** (V3.2B line 6765)
2. **Workspace/Vault owns file lifecycle:** Single source of truth (V3.2A line 5956)

**The Analysis:**

V3.2B Reference Contract states (line 6567-6568):
- *"Reference MAY become stale; consuming domain MUST handle staleness"*
- *"Owning domain controls lifecycle; reference holder does not"*

**This scenario has two distinct issues:**

**Issue 1: File Deletion (Broken Reference)**
- Already covered in **Scenario 3**
- Identified as CONFIRMED GAP (reference integrity)
- Requires new contract pattern for reference validation or interest registration

**Issue 2: File Replacement (Content Mutation)**
- This is a **Workspace/Vault internal design decision**
- Not a cross-domain contract concern

**Workspace/Vault Authority:**

Per V3.2A (line 5956), Workspace/Vault owns file lifecycle and can choose:

**Option A: Mutable files** (file IDs are stable, content can change)
- File ID `file-abc123` always refers to "Drawing.pdf"
- Content of "Drawing.pdf" can be updated
- References remain valid but point to latest content
- Responsibility: Document creators must understand files are mutable

**Option B: Immutable files** (file IDs are version-specific)
- File ID `file-abc123` refers to specific content snapshot
- Uploading new version creates new ID `file-xyz789`
- References remain valid and point to exact content
- Old versions remain accessible

**Option C: Versioned files** (file names are stable, versions tracked)
- File name "Drawing.pdf" has versions: v1, v2, v3
- References can specify version or use "latest"
- Old versions remain accessible

**Verdict:**

**✅ NO ARCHITECTURAL GAP**

- File mutability vs. immutability is a Workspace/Vault internal design decision
- Reference Contract acknowledges references may become stale (V3.2B line 6567)
- Document Copilot is responsible for handling stale references (already covered in Scenario 3)

**This is related to Scenario 3's reference integrity gap, but file versioning is not a contract concern—it's an implementation detail of Workspace/Vault.**

**Recommendation:**

Workspace/Vault SHOULD implement **immutable file versioning** to prevent silent content changes, but this is an implementation best practice, not a contract requirement.

**Failure Handling Rule:**
Workspace/Vault SHOULD implement immutable file storage or explicit versioning to prevent reference content from silently changing. Document Copilot MUST handle stale references per Scenario 3 gap resolution.

---

### Scenario 10: Partial Failure in Multi-Step Workflow

**Trigger Condition:**
User initiates multi-step PPAP workflow: (1) Generate 5 documents via Document Copilot, (2) Upload each to Vault, (3) Attach each to PPAP. Step 2 succeeds for documents 1-3, then fails (network error, storage quota exceeded, service timeout) for documents 4-5. User is left with partial completion: 3 documents attached, 2 missing.

**Failure Mode:**
- Multi-step workflow has no transaction boundary
- Partial completion leaves PPAP in inconsistent state
- No automatic rollback or retry mechanism
- User must manually identify and retry failed steps

**Contract Trace Under Failure:**

1. **Workflow Initiation (T0):**
   - User triggers PPAP document package generation
   - Document Copilot generates 5 documents (all succeed)
   - Documents stored in memory, ready for vault upload

2. **Partial Upload Success (T1-T3):**
   - T1: Document 1 uploaded to Vault (Request Contract to Workspace/Vault) → Success
   - T2: Document 2 uploaded to Vault → Success
   - T3: Document 3 uploaded to Vault → Success
   - Vault returns file IDs: `file-001`, `file-002`, `file-003`

3. **Upload Failure (T4-T5):**
   - T4: Document 4 upload to Vault → **FAILURE** (storage quota exceeded)
   - T5: Document 5 upload attempt → **ABORTED** (previous failure halts workflow)

4. **Partial PPAP Attachment (T6):**
   - Document Copilot requests PPAP Workflow to attach documents 1-3
   - PPAP Workflow records 3 of 5 expected documents attached
   - Documents 4-5 are not attached (not in vault)
   - PPAP shows as "incomplete" but no clear indication which documents are missing

**Ownership Boundary Behavior:**

- **Document Copilot Ownership:** Successfully generated all 5 documents (V3.2A line 5750)
- **Workspace/Vault Ownership:** Correctly accepted 3 uploads, correctly rejected 2 (quota enforcement)
- **PPAP Workflow Ownership:** Correctly recorded 3 attachments (V3.2A line 5686)
- **No domain violated ownership boundaries**

**Recovery Path:**

1. **Detection:** User notices only 3 of 5 documents attached
2. **Diagnosis:** User must determine which documents failed and why
3. **Retry:** User must manually re-generate documents 4-5 and retry upload
4. **Prevention:** No automatic retry or transaction boundary

**Architectural Gap Verdict:**

**✅ NO ARCHITECTURAL GAP — WORKING AS DESIGNED**

**Gap Analysis Against V3.2A/V3.2B:**

**Contract Trace:**
1. **Document Copilot generates documents:** Internal process (V3.2A line 5750-5763)
2. **Document Copilot requests vault storage:** Uses **Request Contract** (V3.2B line 6764)
3. **Workspace/Vault accepts or rejects:** Per Request Contract authority (V3.2B line 6527)
4. **Document Copilot requests PPAP attachment:** Uses **Request Contract** to PPAP Workflow

**The Analysis:**

V3.2B Request Contract states (line 6529):
- *"Request may be accepted, rejected, or queued by owning domain"*

**Each step is an independent Request Contract:**
- Document Copilot requests vault storage → Workspace/Vault decides
- Document Copilot requests PPAP attachment → PPAP Workflow decides

**There is no concept of "multi-step transaction" across domains in V3.2B.**

**Why This Is NOT a Gap:**

The architecture is working as designed:
- Request Contract is atomic per-request, not multi-request
- Each domain exercises its authority independently
- Partial failures are expected and valid

**Multi-step workflows are the CALLER's responsibility:**
- Document Copilot initiated multi-step workflow
- Document Copilot must handle partial failures
- Document Copilot must implement retry logic

**The Correct Pattern:**

Document Copilot SHOULD implement:
1. **Idempotent operations:** Each upload can be safely retried
2. **Failure tracking:** Track which steps succeeded/failed
3. **Retry logic:** Automatically retry failed steps
4. **User notification:** Clearly indicate partial completion state
5. **Compensation logic:** Option to rollback successful steps if workflow cannot complete

**None of this requires new contract types.** This is caller responsibility.

**Alternative: Saga Pattern**

For complex multi-step workflows:
- Define compensating actions for each step
- If step N fails, execute compensations for steps 1..N-1
- Document Copilot orchestrates saga, domains respond to requests

**Already supported by Request Contract:** Requests can be compensating actions (e.g., "delete file-001").

**Verdict:**

**✅ NO ARCHITECTURAL GAP**

- Request Contract is per-request atomic, not multi-request transactional
- Multi-step workflow coordination is caller's responsibility
- Saga pattern or retry logic can be implemented without new contracts
- Partial failures are expected behavior, not architectural defect

**Failure Handling Rule:**
Multi-step workflows across domains MUST implement failure handling, retry logic, and compensation patterns at the caller level. Request Contract does not provide transactional guarantees across multiple requests. This is caller responsibility, not an architectural gap.

---

## Cross-Scenario Failure Pattern Analysis

### Confirmed Architectural Gaps Summary

Across Scenarios 1-10, **three architectural gaps** were identified. These gaps share a **common root cause**.

#### Gap 1: Versioned Read / Conditional Operation Pattern

**Affected Scenarios:**
- Scenario 2: User resumes Copilot session after PPAP state changed
- Scenario 4: EMIP data becomes stale during workflow
- Scenario 5: Two users modify same PPAP simultaneously
- Scenario 6: PPAP status changes during document generation

**Symptom:**
Consuming domain reads data from owning domain, then performs operations based on that read. Source data changes between read and operation, causing stale data usage or lost updates.

**V3.2B Contract Types Involved:**
- **Read Contract** (V3.2B line 6507-6518): Allows reading data but provides no version/timestamp mechanism
- **Output Contract** (V3.2B line 6533-6543): "Versioned" refers to API versioning, not entity versioning
- **Request Contract** (V3.2B line 6520-6530): Accepts requests but has no conditional semantics

**What's Missing:**
- No pattern for including version/timestamp metadata in outputs
- No pattern for conditional requests (e.g., "update if version matches")
- No pattern for detecting staleness before committing dependent operations
- No guidance on version token format or semantics

#### Gap 2: Reference Integrity / Lifecycle Coordination Pattern

**Affected Scenarios:**
- Scenario 3: File referenced by Copilot is deleted or replaced

**Symptom:**
Consuming domain holds references to entities owned by another domain. Owning domain modifies or deletes entity without notifying reference holders, causing broken references or stale reference metadata.

**V3.2B Contract Types Involved:**
- **Reference Contract** (V3.2B line 6559-6570): Acknowledges staleness but provides no validation mechanism
- **Event Contract** (V3.2B line 6546-6557): Informational only, no guaranteed delivery

**What's Missing:**
- No pattern for validating reference existence before commit
- No pattern for registering "reference interest" (notify before deletion)
- No atomic check-and-commit for operations dependent on referenced entities
- No guidance on reference tracking without violating semantic ownership boundaries

#### Gap 3: Event Ordering / Sequence Integrity Pattern

**Affected Scenarios:**
- Scenario 7: Event arrives out-of-order or delayed

**Symptom:**
Event-consuming domain receives events out of order, duplicated, or with gaps, causing aggregated view inconsistency.

**V3.2B Contract Types Involved:**
- **Event Contract** (V3.2B line 6546-6557): Describes past occurrences but silent on ordering, deduplication, gaps

**What's Missing:**
- No ordering guarantees (FIFO, causal, total order)
- No sequence number or event ID requirement
- No idempotency contract (duplicate detection)
- No gap detection or event replay mechanism

---

### Root Cause Analysis

**All three gaps share a common architectural deficiency:**

**V3.2B defines WHAT is communicated between domains but not WHEN, HOW FRESH, or IN WHAT ORDER.**

**Temporal Context is Missing:**

- **Read/Output/Request Contracts:** No temporal semantics (version, timestamp, freshness)
- **Reference Contract:** No lifecycle coordination (notification, validation timing)
- **Event Contract:** No ordering semantics (sequence, causality, delivery guarantees)

**The V3.2B contract model is fundamentally STATELESS and TIMELESS:**
- Contracts describe data shape and ownership transfer rules
- Contracts do not describe temporal relationships between operations
- Contracts do not provide mechanisms for detecting or handling staleness, ordering, or consistency

**This is not a failure of V3.2B design—it's an incomplete specification.**

V3.2B successfully defines:
- ✅ Ownership boundaries (who controls what)
- ✅ Communication patterns (read, request, event, output, reference)
- ✅ Anti-patterns (no hidden coupling, no shadow ownership)

V3.2B does NOT define:
- ❌ Temporal coordination (version tokens, timestamps, sequence numbers)
- ❌ Consistency semantics (staleness detection, conditional operations)
- ❌ Ordering guarantees (event sequencing, causal dependencies)

**These are not separate gaps—they are all manifestations of missing temporal semantics in V3.2B.**

---

## Failure Handling Rules

The following rules address the **root causes** identified in the Cross-Scenario Analysis:

### Rule 1: Temporal Context MUST Be Explicit

**Applies to:** All scenarios involving read-then-operate patterns (Scenarios 2, 4, 5, 6)

**Principle:**
When a domain reads data from another domain and performs operations based on that read, the operation MUST validate that the source data has not changed since the read.

**Implementation Requirement:**
- All Output Contracts MUST include temporal metadata (version token, timestamp, or ETag)
- All Request Contracts that depend on read data MUST accept conditional parameters
- Owning domains MUST validate temporal conditions before executing requests
- Rejections due to stale conditions MUST return clear error messages

**V3.2B Extension Required:**
Define **Versioned Read Contract** and **Conditional Request Contract** patterns.

---

### Rule 2: Reference Lifecycle Coordination MUST Be Explicit

**Applies to:** All scenarios involving cross-domain references (Scenario 3)

**Principle:**
When a domain holds references to entities owned by another domain, the system MUST provide a mechanism to validate reference integrity or prevent reference breakage.

**Implementation Requirement:**
Choose one of three patterns:
- **A) Immutable References:** Owning domain never deletes, only deprecates (versioned files)
- **B) Pre-Commit Validation:** Consuming domain validates references before committing work
- **C) Reference Interest Registration:** Consuming domain registers interest, owning domain notifies before deletion

**V3.2B Extension Required:**
Define **Reference Validation Contract** or **Reference Interest Contract** patterns.

---

### Rule 3: Event Ordering MUST Be Explicit

**Applies to:** All scenarios involving event-driven aggregation (Scenario 7)

**Principle:**
When a domain consumes events from another domain for aggregation or reactive behavior, events MUST include sufficient metadata for ordering, deduplication, and gap detection.

**Implementation Requirement:**
- All events MUST include unique event ID (for deduplication)
- All events MUST include sequence number or timestamp (for ordering)
- All events MUST include entity ID (for per-entity ordering)
- Event-consuming domains MUST implement idempotent event handling
- Event-consuming domains SHOULD periodically reconcile via Read Contract

**V3.2B Extension Required:**
Define **Event Sequence Contract** with ordering and idempotency semantics.

---

### Rule 4: Multi-Step Workflows MUST Handle Partial Failure

**Applies to:** All scenarios involving multi-request workflows (Scenario 10)

**Principle:**
When a domain orchestrates multi-step workflows across other domains, the orchestrator MUST handle partial failures gracefully.

**Implementation Requirement:**
- Orchestrating domain MUST track success/failure of each step
- Orchestrating domain MUST implement retry logic for failed steps
- Orchestrating domain MUST provide clear failure feedback to users
- Orchestrating domain SHOULD implement compensation logic (saga pattern) for critical workflows

**No V3.2B Extension Required:**
Request Contract already supports this pattern. This is orchestrator responsibility.

---

### Rule 5: Cached Data MUST NOT Be Treated as Authoritative

**Applies to:** All scenarios involving cached reads (Scenario 8)

**Principle:**
When a domain caches data read from another domain for performance, the cache MUST NOT be treated as authoritative truth.

**Implementation Requirement:**
- Caching domains MUST clearly indicate staleness to users
- Caching domains MUST refresh on conflict (when cached data causes operation failure)
- Caching domains SHOULD use events as cache invalidation hints
- Preferably, avoid caching and rely on Read Contract for fresh data

**No V3.2B Extension Required:**
V3.2B already prohibits this (line 6516). This is rule enforcement, not gap closure.

---

## Architectural Gap Verdict

### V3.2B Requires Extension: Temporal Semantics

**Status:** 🚨 **CONFIRMED — V3.2B INCOMPLETE**

**Finding:**

V3.2B successfully defines **spatial boundaries** (ownership, communication patterns) but lacks **temporal semantics** (version, ordering, freshness).

**Required Extensions:**

#### Extension 1: Versioned Read Contract

**Purpose:** Enable staleness detection and conditional operations

**Pattern:**
```
Output Contract Extension:
- Include version token or timestamp in all outputs
- Version token format: ETag, sequence number, or timestamp

Request Contract Extension:
- Accept conditional parameters: "if-match", "if-none-match", "if-modified-since"
- Validate conditions before executing mutation
- Reject with 412 Precondition Failed if condition not met
```

**Applies to:** Scenarios 2, 4, 5, 6

---

#### Extension 2: Reference Integrity Contract

**Purpose:** Enable reference validation and lifecycle coordination

**Pattern Options:**

**Option A: Reference Validation Contract**
```
New contract type:
- Consuming domain queries: "Does reference X still exist?"
- Owning domain responds with existence + version metadata
- Consuming domain validates before commit
```

**Option B: Reference Interest Contract**
```
New contract type:
- Consuming domain registers: "I reference entity X"
- Owning domain tracks reference count
- Owning domain notifies before deletion or rejects deletion
```

**Option C: Immutable Reference Contract**
```
Implementation requirement (not new contract):
- Owning domain never deletes, only versions
- References are immutable and always resolve
```

**Applies to:** Scenario 3

---

#### Extension 3: Event Sequence Contract

**Purpose:** Enable ordered, idempotent event processing

**Pattern:**
```
Event Contract Extension:
- Include event ID (UUID) for deduplication
- Include sequence number (per-entity monotonic counter)
- Include entity ID for grouping
- Include timestamp for ordering fallback

Consuming domain requirements:
- Implement idempotent event handling (same event ID processed once)
- Buffer out-of-order events or process with gap tolerance
- Periodically reconcile via Read Contract (events are hints, not truth)
```

**Applies to:** Scenario 7

---

### Implementation Guidance

**V3.2B is NOT broken—it's foundational.**

V3.2B defines ownership and communication patterns successfully. The gaps identified are **extensions** to handle temporal concerns, not replacements.

**Recommended Approach:**

1. **Accept V3.2B as-is** for ownership and basic contracts
2. **Add V3.2B-Extension section** defining temporal patterns
3. **Apply extensions consistently** across all domains
4. **Treat extensions as required**, not optional

**V3.2B-Extension becomes the complete contract specification.**

---

This document is the **implementation-grade source of truth** for EMIP-PPAP.

**Future implementation MUST:**
- Bootstrap against this plan
- Follow governance rules
- Preserve core architecture
- Update this plan as system evolves

---

## V3.2E-1 — Workspace/Vault Domain Definition and Extraction Plan

**Last Updated:** 2026-04-01  
**Status:** Extraction-Ready Architecture (Pre-Implementation Definition)  
**Type:** Documentation Only (No Code Changes)

### Purpose

**V3.2E-1 defines the complete Workspace/Vault domain extraction from PPAP Workflow to establish independent file storage ownership.**

**Context from V3.2D:**
- REPO-SCAN-01 confirmed Workspace/Vault is **STUB ONLY** with file storage embedded in PPAP Workflow
- V3.2A defines Workspace/Vault as independent domain but implementation violates ownership rules
- File storage logic currently lives in `src/features/documents/` and `src/features/ppap/utils/uploadFile.ts`
- `ppap_documents` table mixes PPAP workflow concerns with file storage concerns

**Objective:**
Define every architectural decision required for V3.2E-2 to extract Workspace/Vault as an independent domain without making any implementation decisions during extraction.

---

### 1. DOMAIN DEFINITION

**Workspace/Vault Domain** (Complete V3.2A Specification)

#### Purpose

Manage file storage, organization, retrieval, and lifecycle for all files in the EMIP-PPAP system, independent of business context or workflow state.

#### Owns (Authoritative Control)

| Entity | Ownership |
|--------|-----------|
| **File Storage** | Physical file storage, blob references, storage paths |
| **File Metadata** | File name, size, MIME type, upload timestamp, uploader |
| **File Organization** | Folder structure, file hierarchy, organization rules |
| **File Versions** | Version history, version metadata, version retrieval |
| **File References** | Stable file identifiers, access URLs, signed URLs |
| **File Lifecycle** | Upload, retrieval, deletion, archival, retention |
| **Storage Quotas** | Space usage tracking, quota enforcement |
| **File Access Paths** | URL generation, access token management |

**Single Source of Truth For:**
- What files exist in the system
- Where files are physically stored
- File metadata (name, size, type, timestamps)
- File version history
- File access paths and references
- Storage usage and quotas

**Exclusive File Storage Authority:**

Workspace/Vault is the **ONLY** domain authorized to:
- Store files to physical storage (Supabase Storage, S3, etc.)
- Generate file access URLs or signed URLs
- Track file metadata (size, MIME type, upload time)
- Manage file versions and version history
- Delete or archive files from storage
- Enforce storage quotas and limits

**Even when files are associated with business entities (PPAPs, documents, etc.)**, Workspace/Vault retains exclusive authority over file storage operations. Other domains provide context; Workspace/Vault manages storage.

#### Does NOT Own

| Area | Rationale |
|------|-----------|
| **File Meaning** | Belongs to consuming domains (PPAP, Document Copilot) |
| **File Classification** | Belongs to consuming domains (document type, category) |
| **Business Context** | Belongs to PPAP Workflow (which PPAP, which phase) |
| **Document Semantics** | Belongs to Document Copilot (draft vs final, confidence) |
| **Workflow State** | Belongs to PPAP Workflow (approval, completeness) |
| **File Relationships** | Belongs to consuming domains (which files are required) |
| **File Validation** | Belongs to consuming domains (content validation) |

**Strict Constraints:**

Workspace/Vault **MUST NOT:**
- Assign document types or categories to files (e.g., "DRAWING", "FMEA")
- Determine which files are required for a PPAP
- Validate file content for business rules
- Make workflow decisions based on file presence
- Infer relationships between files
- Apply business logic to file metadata
- Determine file completeness or approval status

Workspace/Vault **MUST ONLY:**
- Store files and return stable references
- Provide file metadata (size, type, timestamps)
- Manage file lifecycle (upload, retrieve, delete)
- Track storage usage and enforce quotas
- Generate access paths and signed URLs

#### Consumes

| Input | Source Domain | Contract Type |
|-------|---------------|---------------|
| **Storage Primitives** | Core Platform | Infrastructure (Supabase Storage) |
| **User Identity** | Core Platform | Read Contract (who is uploading) |
| **Storage Requests** | All Domains | Request Contract (store this file) |

#### Produces

| Output | Consumers | Contract Type |
|--------|-----------|---------------|
| **File References** | All Domains | Output Contract (stable file ID + URL) |
| **File Metadata** | All Domains | Read Contract (file properties) |
| **Storage Events** | All Domains | Event Contract (file uploaded, deleted) |
| **File Access URLs** | All Domains | Output Contract (signed URLs for retrieval) |

---

### 2. CURRENT VIOLATION ANALYSIS

**Files That Violate V3.2A Ownership Rules:**

#### Violation 1: File Storage Logic in PPAP Workflow Domain

**File:** `src/features/ppap/utils/uploadFile.ts`

**Violation:**
- PPAP Workflow domain owns file upload logic
- Direct Supabase Storage calls from PPAP domain
- File path generation logic (`${ppapId}/${Date.now()}-${file.name}`)
- Storage bucket hardcoded (`ppap-documents`)

**Should Be:** Workspace/Vault domain owns all storage operations

**Evidence:**
```typescript
// src/features/ppap/utils/uploadFile.ts (lines 1-22)
export async function uploadPPAPDocument(file: File, ppapId: string): Promise<string> {
  const filePath = `${ppapId}/${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from('ppap-documents')
    .upload(filePath, file);
  // ...
}
```

#### Violation 2: File Storage Logic in Documents Feature

**File:** `src/features/documents/components/UploadDocumentForm.tsx`

**Violation:**
- UI component directly calls Supabase Storage
- File path generation logic in UI layer (`ppap/${ppapId}/${file.name}`)
- Storage bucket hardcoded in component
- No domain separation between UI and storage

**Should Be:** UI calls Workspace/Vault domain via Request Contract

**Evidence:**
```typescript
// src/features/documents/components/UploadDocumentForm.tsx (lines 33-54)
const filePath = `ppap/${ppapId}/${file.name}`;
const { data: uploadData, error: uploadError } = await supabase
  .storage
  .from('ppap-documents')
  .upload(filePath, file, { ... });
```

#### Violation 3: Mixed Ownership in ppap_documents Table

**Table:** `ppap_documents` (supabase/schema.sql lines 86-123)

**Violation:**
- Table mixes PPAP Workflow concerns with Workspace/Vault concerns
- PPAP-specific fields: `ppap_id`, `document_type` (PPAP workflow context)
- Vault-specific fields: `storage_path`, `storage_bucket`, `file_size_bytes`, `mime_type`
- No clear ownership boundary

**Should Be:** Split into two tables:
- `ppap_document_requirements` (PPAP Workflow domain) — which files are required for which PPAP
- `vault_files` (Workspace/Vault domain) — file storage metadata

**Evidence:**
```sql
CREATE TABLE ppap_documents (
  id UUID PRIMARY KEY,
  ppap_id UUID NOT NULL REFERENCES ppap_records(id),  -- PPAP Workflow concern
  document_type VARCHAR(100),                          -- PPAP Workflow concern
  storage_path VARCHAR(500),                           -- Vault concern
  storage_bucket VARCHAR(100),                         -- Vault concern
  file_size_bytes BIGINT,                              -- Vault concern
  mime_type VARCHAR(100),                              -- Vault concern
  -- ...
);
```

#### Violation 4: Document Mutations in Documents Feature

**File:** `src/features/documents/mutations.ts`

**Violation:**
- `createDocument()` writes to `ppap_documents` table
- Mixes PPAP context (`ppap_id`, `category`) with file metadata
- No separation between "attach file to PPAP" (PPAP Workflow) and "store file" (Vault)

**Should Be:** Two separate operations:
- Vault: `storeFile()` → returns file reference
- PPAP Workflow: `attachFileToPPAP(ppapId, fileRef, documentType)` → creates requirement record

**Evidence:**
```typescript
// src/features/documents/mutations.ts (lines 5-34)
export async function createDocument(input: CreateDocumentInput): Promise<PPAPDocument> {
  const { data, error } = await supabase
    .from('ppap_documents')  // Mixed ownership table
    .insert({
      ppap_id: input.ppap_id,      // PPAP context
      file_name: input.file_name,  // Vault metadata
      category: input.category,    // PPAP context
      file_url: input.file_url,    // Vault metadata
      // ...
    });
}
```

#### Violation 5: Cross-Domain Imports

**Files Importing Storage Logic:**
- `src/features/ppap/components/CreatePPAPForm.tsx` imports `uploadFile`
- `src/features/ppap/components/DocumentationForm.tsx` imports `uploadFile`
- `src/features/ppap/components/MarkupTool.tsx` imports `uploadFile`
- `src/features/ppap/components/PPAPControlPanel.tsx` imports `uploadFile`

**Violation:** PPAP UI components directly import file storage utilities, bypassing domain boundaries

**Should Be:** PPAP components call Workspace/Vault domain via Request Contract

---

### 3. TARGET FOLDER STRUCTURE

**Workspace/Vault Domain Location:**

```
src/features/vault/
├── mutations.ts              # Vault write operations (store, delete, version)
├── queries.ts                # Vault read operations (get file, list files)
├── types.ts                  # Vault-specific types (FileReference, FileMetadata)
├── services/
│   ├── storageService.ts     # Core storage operations (upload, download, delete)
│   ├── versionService.ts     # File versioning logic
│   └── quotaService.ts       # Storage quota tracking and enforcement
├── utils/
│   ├── filePathGenerator.ts  # Generate storage paths (isolated logic)
│   └── mimeTypeDetector.ts   # MIME type detection and validation
└── components/
    ├── FileUploadForm.tsx    # Generic file upload UI (domain-agnostic)
    ├── FileList.tsx          # Generic file list UI
    └── FilePreview.tsx       # Generic file preview UI
```

**No app/ Route:**
Workspace/Vault has no dedicated UI route. It is a **service domain** consumed by other domains via contracts.

**Rationale:**
- Users don't interact with "the vault" directly
- Users upload files in context (PPAP documents, Copilot inputs, etc.)
- Vault provides storage services, not user-facing workflows

---

### 4. EXTRACTION PLAN

**V3.2E-2 MUST execute these steps in order:**

#### Step 1: Create Vault Domain Structure

**Action:** Create new domain folder and files

**Files to Create:**
1. `src/features/vault/types.ts` — Define `FileReference`, `FileMetadata`, `StorageRequest`, `StorageResponse`
2. `src/features/vault/services/storageService.ts` — Core storage operations
3. `src/features/vault/mutations.ts` — Public Vault API (storeFile, deleteFile)
4. `src/features/vault/queries.ts` — Public Vault API (getFile, listFiles)

**No Code Migration Yet:** Just create empty structure with type definitions

#### Step 2: Implement Core Vault Storage Service

**Action:** Move storage logic from PPAP domain to Vault domain

**Extract From:**
- `src/features/ppap/utils/uploadFile.ts` → `src/features/vault/services/storageService.ts`
- `src/features/documents/components/UploadDocumentForm.tsx` (lines 33-54) → `src/features/vault/services/storageService.ts`

**New Vault API:**
```typescript
// src/features/vault/mutations.ts
export async function storeFile(
  file: File,
  context?: { ownerId?: string; ownerType?: string }
): Promise<FileReference> {
  // Generate storage path (no business logic, just unique path)
  // Upload to Supabase Storage
  // Return FileReference { id, url, metadata }
}

export async function deleteFile(fileId: string): Promise<void> {
  // Delete from storage
  // Emit deletion event
}
```

**Key Changes:**
- Remove `ppapId` parameter (business context, not Vault concern)
- Return `FileReference` type (stable ID + URL + metadata)
- No document type classification (Vault doesn't know what files mean)

#### Step 3: Update PPAP Workflow to Use Vault Contracts

**Action:** Replace direct storage calls with Vault domain calls

**Files to Update:**
- `src/features/ppap/components/CreatePPAPForm.tsx`
- `src/features/ppap/components/DocumentationForm.tsx`
- `src/features/ppap/components/MarkupTool.tsx`
- `src/features/ppap/components/PPAPControlPanel.tsx`

**Change Pattern:**
```typescript
// BEFORE (Violation):
import { uploadPPAPDocument } from '@/src/features/ppap/utils/uploadFile';
const filePath = await uploadPPAPDocument(file, ppapId);

// AFTER (Compliant):
import { storeFile } from '@/src/features/vault/mutations';
const fileRef = await storeFile(file);
await attachFileToP PAP(ppapId, fileRef.id, documentType);
```

#### Step 4: Update Documents Feature to Use Vault Contracts

**Action:** Separate file storage from PPAP attachment

**File to Update:**
- `src/features/documents/components/UploadDocumentForm.tsx`

**Change Pattern:**
```typescript
// BEFORE (Violation):
const filePath = `ppap/${ppapId}/${file.name}`;
const { data } = await supabase.storage.from('ppap-documents').upload(filePath, file);
await createDocument({ ppap_id, file_name, file_url, ... });

// AFTER (Compliant):
const fileRef = await storeFile(file);  // Vault domain
await attachFileToP PAP(ppapId, fileRef.id, documentType);  // PPAP domain
```

#### Step 5: Split ppap_documents Table (Documentation Only)

**Action:** Document table split plan (no schema changes in V3.2E-2)

**Current Table:** `ppap_documents` (mixed ownership)

**Target Tables:**

**Table 1: `vault_files` (Workspace/Vault Domain)**
```sql
CREATE TABLE vault_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- File metadata (Vault owns)
  file_name VARCHAR(255) NOT NULL,
  file_size_bytes BIGINT,
  mime_type VARCHAR(100),
  
  -- Storage (Vault owns)
  storage_path VARCHAR(500) NOT NULL,
  storage_bucket VARCHAR(100) NOT NULL,
  
  -- Lifecycle (Vault owns)
  uploaded_by VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Version tracking (Vault owns)
  version INTEGER DEFAULT 1,
  parent_version_id UUID REFERENCES vault_files(id)
);
```

**Table 2: `ppap_document_requirements` (PPAP Workflow Domain)**
```sql
CREATE TABLE ppap_document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ppap_id UUID NOT NULL REFERENCES ppap_records(id) ON DELETE CASCADE,
  
  -- File reference (Reference Contract to Vault)
  file_id UUID NOT NULL REFERENCES vault_files(id),
  
  -- PPAP context (PPAP Workflow owns)
  document_type VARCHAR(100) NOT NULL,  -- DRAWING, FMEA, etc.
  is_required BOOLEAN DEFAULT true,
  is_complete BOOLEAN DEFAULT false,
  
  -- Workflow metadata (PPAP Workflow owns)
  attached_at TIMESTAMPTZ DEFAULT NOW(),
  attached_by VARCHAR(255),
  notes TEXT,
  
  CONSTRAINT valid_document_type CHECK (document_type IN (...))
);
```

**Migration Strategy (Future Phase):**
1. Create `vault_files` table
2. Create `ppap_document_requirements` table
3. Migrate data from `ppap_documents` to both tables
4. Update code to use new tables
5. Drop `ppap_documents` table

**V3.2E-2 Does NOT Execute Migration:** Only update code to use Vault domain. Schema migration is separate phase.

#### Step 6: Delete Obsolete Files

**Files to Delete:**
- `src/features/ppap/utils/uploadFile.ts` (logic moved to Vault)
- `src/features/documents/mutations.ts` (split into Vault + PPAP operations)

**Files to Keep (Updated):**
- `src/features/documents/components/UploadDocumentForm.tsx` (updated to use Vault)
- `src/features/documents/components/DocumentList.tsx` (updated to read from Vault)

#### Step 7: Create Vault-PPAP Contract Definitions

**Action:** Document explicit contracts (no code, just documentation)

**File to Create:** `src/features/vault/CONTRACTS.md`

**Content:** Define Request/Output/Event contracts between Vault and PPAP Workflow (see Section 5)

---

### 5. CONTRACT DEFINITIONS

**Workspace/Vault ↔ Other Domains Contracts** (V3.2B Compliance)

#### Contract 1: Store File (Request Contract)

**Direction:** Any Domain → Workspace/Vault

**Pattern:** Request Contract (domain requests storage service)

**Request:**
```typescript
interface StoreFileRequest {
  file: File;                    // File blob to store
  context?: {                    // Optional business context (Vault ignores)
    ownerId?: string;            // For logging/audit only
    ownerType?: string;          // For logging/audit only
  };
}
```

**Response (Output Contract):**
```typescript
interface FileReference {
  id: string;                    // Stable file identifier (UUID)
  url: string;                   // Access URL (public or signed)
  metadata: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;          // ISO timestamp
    uploadedBy: string;
  };
}
```

**Ownership:**
- Vault owns file storage and returns stable reference
- Calling domain owns business context (what file means, why it's stored)

**Example Usage:**
```typescript
// PPAP Workflow calls Vault
const fileRef = await storeFile(file, { ownerId: ppapId, ownerType: 'PPAP' });

// PPAP Workflow then creates its own record
await createPPAPDocumentRequirement({
  ppap_id: ppapId,
  file_id: fileRef.id,           // Reference to Vault file
  document_type: 'DRAWING',      // PPAP's classification
});
```

#### Contract 2: Retrieve File (Read Contract)

**Direction:** Any Domain → Workspace/Vault

**Pattern:** Read Contract (domain reads file metadata)

**Request:**
```typescript
interface GetFileRequest {
  fileId: string;                // Stable file ID from FileReference
}
```

**Response:**
```typescript
interface FileMetadata {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  url: string;                   // Access URL
  version: number;               // File version
}
```

**Ownership:**
- Vault provides file metadata and access URL
- Calling domain interprets metadata for business purposes

#### Contract 3: Delete File (Request Contract)

**Direction:** Any Domain → Workspace/Vault

**Pattern:** Request Contract (domain requests file deletion)

**Request:**
```typescript
interface DeleteFileRequest {
  fileId: string;
  deletedBy: string;
}
```

**Response:**
```typescript
interface DeleteFileResponse {
  success: boolean;
  deletedAt: string;
}
```

**Event (Event Contract):**
```typescript
interface FileDeletedEvent {
  eventType: 'FILE_DELETED';
  fileId: string;
  deletedAt: string;
  deletedBy: string;
}
```

**Ownership:**
- Vault executes deletion and emits event
- Consuming domains listen for event and clean up references

**V3.2D Gap 2 Resolution (Reference Integrity):**

**Problem:** Consuming domain holds reference to Vault file. Vault deletes file without notification, causing broken reference.

**Solution (Reference Integrity Pattern):**

**Option A: Validate Before Commit (Atomic Check)**
```typescript
// PPAP Workflow validates reference before committing operation
const fileExists = await vault.checkFileExists(fileId);
if (!fileExists) {
  throw new Error('Referenced file no longer exists');
}
await commitPPAPOperation();
```

**Option B: Register Interest (Notification Before Deletion)**
```typescript
// PPAP Workflow registers interest in file
await vault.registerReferenceInterest(fileId, 'PPAP', ppapId);

// Vault checks for interests before deletion
const interests = await vault.getFileInterests(fileId);
if (interests.length > 0) {
  throw new Error('File is referenced by other entities');
}
// OR: Notify interested parties before deletion
await vault.notifyInterestedParties(fileId, 'FILE_WILL_BE_DELETED');
```

**Option C: Immutable Files (No Deletion After Reference)**
```typescript
// Once file is referenced, it cannot be deleted
// Only soft delete (mark as deleted but keep storage)
await vault.softDeleteFile(fileId);  // Sets deleted_at, keeps storage
```

**V3.2E-2 Decision:** Implement **Option A (Validate Before Commit)** as minimum viable solution. Options B and C are future enhancements.

#### Contract 4: File Storage Event (Event Contract)

**Direction:** Workspace/Vault → All Domains

**Pattern:** Event Contract (Vault publishes storage events)

**Events:**
```typescript
interface FileUploadedEvent {
  eventType: 'FILE_UPLOADED';
  fileId: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
  context?: { ownerId?: string; ownerType?: string };
}

interface FileDeletedEvent {
  eventType: 'FILE_DELETED';
  fileId: string;
  deletedBy: string;
  deletedAt: string;
}

interface FileReplacedEvent {
  eventType: 'FILE_REPLACED';
  fileId: string;
  oldVersion: number;
  newVersion: number;
  replacedBy: string;
  replacedAt: string;
}
```

**Ownership:**
- Vault emits events for all storage operations
- Consuming domains listen and react (update UI, invalidate cache, etc.)

---

### 6. MIGRATION RISKS

**Risk 1: Breaking Existing File Upload Flows**

**Symptom:** Users cannot upload files to PPAPs after extraction

**Cause:** PPAP UI components still call old `uploadPPAPDocument()` function

**Mitigation:**
- Update all PPAP components to use Vault API before deleting old functions
- Test file upload in PPAP workflow before committing
- Keep old functions temporarily with deprecation warnings

**Validation:**
- Upload file to PPAP via UI
- Verify file appears in PPAP documents list
- Verify file is retrievable via URL

---

**Risk 2: Broken File References in Existing PPAPs**

**Symptom:** Existing PPAP documents show broken file links

**Cause:** `ppap_documents` table still exists but code expects new `vault_files` table

**Mitigation:**
- V3.2E-2 does NOT migrate database schema
- Code continues to use `ppap_documents` table
- Vault domain abstracts table access (code calls Vault API, Vault reads `ppap_documents`)

**Validation:**
- Load existing PPAP with documents
- Verify all files are visible and downloadable
- Verify no broken links or 404 errors

---

**Risk 3: File Path Generation Conflicts**

**Symptom:** Duplicate file paths or overwritten files

**Cause:** Multiple domains generating file paths independently

**Mitigation:**
- Vault domain owns ALL file path generation
- Use UUID-based paths instead of business-context paths
- Old path: `ppap/${ppapId}/${fileName}` (business context)
- New path: `vault/${year}/${month}/${uuid}` (storage-only context)

**Validation:**
- Upload multiple files with same name to different PPAPs
- Verify each file has unique storage path
- Verify no file overwrites

---

**Risk 4: Missing File Metadata**

**Symptom:** File size, MIME type, or upload timestamp missing

**Cause:** Vault API doesn't capture all metadata during upload

**Mitigation:**
- Vault `storeFile()` MUST capture: file name, size, MIME type, uploader, timestamp
- Return complete `FileReference` with all metadata
- Test metadata completeness before deployment

**Validation:**
- Upload file via Vault API
- Verify `FileReference` contains all metadata fields
- Verify metadata is persisted to database

---

**Risk 5: Performance Degradation**

**Symptom:** File uploads slower after extraction

**Cause:** Additional abstraction layer (Vault API) adds overhead

**Mitigation:**
- Vault API should be thin wrapper around Supabase Storage
- No unnecessary database writes during upload
- Batch metadata writes if possible

**Validation:**
- Measure upload time before extraction
- Measure upload time after extraction
- Verify <10% performance degradation

---

**Risk 6: Untested Vault Domain**

**Symptom:** Vault API has bugs or edge cases not covered

**Cause:** New domain created without existing test coverage

**Mitigation:**
- V3.2E-2 MUST include manual testing checklist
- Test file upload, download, delete operations
- Test error handling (file too large, invalid MIME type, etc.)

**Validation Checklist:**
- ✅ Upload file < 10MB
- ✅ Upload file > 10MB (should fail gracefully)
- ✅ Upload file with special characters in name
- ✅ Upload file with no extension
- ✅ Download file via URL
- ✅ Delete file
- ✅ Attempt to download deleted file (should 404)

---

### 7. V3.2E-2 READINESS CRITERIA

**V3.2E-2 MUST confirm these preconditions before starting:**

#### Precondition 1: V3.2A-D Locked

**Check:**
- V3.2A domain ownership rules are finalized
- V3.2B interface contracts are finalized
- V3.2D gap analysis is complete
- No pending changes to domain definitions

**Validation:** Read BUILD_PLAN.md V3.2A-D sections, confirm no "DRAFT" or "TODO" markers

---

#### Precondition 2: app/ is Canonical Directory

**Check:**
- `app/` directory exists and contains all routes
- `src/app/` directory does NOT exist
- DIAG-01-CLEANUP commit exists

**Validation:** Verify `src/app/` does not exist, verify `app/` contains admin, dashboard, ppap routes

---

#### Precondition 3: Current File Storage Implementation Identified

**Check:**
- All files that handle file storage are identified
- All database fields related to file storage are identified
- All cross-domain imports are identified

**Validation:** Confirm Section 2 (Current Violation Analysis) is accurate

---

#### Precondition 4: Vault Domain Structure Defined

**Check:**
- Target folder structure is defined (Section 3)
- All files to create are listed
- All files to move are listed
- All files to delete are listed

**Validation:** Confirm Section 3 and Section 4 are complete and unambiguous

---

#### Precondition 5: Contracts Defined

**Check:**
- All Vault contracts are defined (Section 5)
- Request/Output/Event patterns are specified
- V3.2D Gap 2 resolution is specified

**Validation:** Confirm Section 5 defines all contracts with TypeScript interfaces

---

#### Precondition 6: Migration Risks Documented

**Check:**
- All known risks are documented (Section 6)
- Mitigation strategies are defined
- Validation steps are defined

**Validation:** Confirm Section 6 lists at least 5 risks with mitigations

---

#### Precondition 7: No Code Changes in V3.2E-1

**Check:**
- V3.2E-1 commit contains ONLY documentation changes
- No files in `src/` are modified
- No database schema changes

**Validation:** `git diff` shows only `docs/BUILD_PLAN.md` and `docs/BUILD_LEDGER.md` changes

---

**If ALL preconditions are met, V3.2E-2 may proceed with extraction.**

**If ANY precondition fails, V3.2E-2 MUST STOP and report which precondition failed.**

---

**This plan is a living document.**
As the system evolves, this plan MUST be updated to reflect current state and future direction.

**As of Phase 21 (2026-03-28):**
- ✅ Core PPAP workflow system fully operational (Phase 3F–3K)
- ✅ Document Engine system fully operational (Phases 9–21)
- ✅ Systems integrated via `/ppap/[id]/documents` route
- ✅ Single unified document system enforced
- 🔲 Future enhancements planned (Phases 22–26+)

---

## V3.2F-1 — Document Copilot Domain Definition

**Last Updated:** 2026-04-01  
**Status:** Execution-Grade Architecture (Pre-Implementation Definition)  
**Type:** Documentation Only (No Code Changes)

### Purpose

**V3.2F-1 defines the complete Document Copilot domain architecture to enable V3.2F-2 and V3.2F-3 implementation without making architectural decisions during execution.**

**Context from DIAG-02:**
- Document Engine Deep Scan identified 16 files in `src/features/documentEngine/`
- Verdict: 9 files KEEP AS-IS, 3 files REPURPOSE, 2 files REMOVE
- Core finding: Excellent separation of concerns enables surgical pivot to AI orchestration
- Key insight: Parsing, normalization, persistence, export, and validation layers are orthogonal to generation method

**Objective:**
Define every architectural decision required for Document Copilot domain extraction and Claude API integration. V3.2F-2 and V3.2F-3 MUST execute without making design choices.

---

### 1. DOMAIN DEFINITION

**Document Copilot Domain** (Complete V3.2A Specification)

#### Purpose

Orchestrate AI-assisted document generation through Claude API integration, managing copilot sessions, prompt construction, draft document state, conversation history, and AI provenance tracking.

#### Owns (Authoritative Control)

| Entity | Ownership |
|--------|-----------|
| **Copilot Sessions** | Session lifecycle, state, configuration, history |
| **Claude API Integration** | Prompt construction, API calls, response handling |
| **Draft Document State** | Generated drafts, iterations, confidence metadata |
| **Conversation History** | User questions, Claude responses, context accumulation |
| **Prompt Templates** | Document-type-specific prompts, instructions, schemas |
| **AI Provenance Metadata** | Which prompt generated which field, token costs, model version |
| **Input Package Assembly** | BOM + template + context packaging for Claude |

**Single Source of Truth For:**
- Active copilot sessions and their state
- Draft documents generated by Claude
- Conversation history within sessions
- Prompt templates for each document type
- AI provenance and generation metadata
- Claude API interaction state

**Exclusive Copilot Authority:**

Document Copilot is the **ONLY** domain authorized to:
- Call Claude API for document generation
- Construct prompts from templates and inputs
- Manage conversation state with Claude
- Track AI provenance (which AI generated what)
- Store draft documents before user approval
- Package inputs for AI consumption

**Even when operating in PPAP-Bound mode**, Document Copilot retains exclusive authority over AI orchestration. PPAP Workflow provides context; Document Copilot manages AI interaction.

#### Does NOT Own

| Area | Rationale |
|------|-----------|
| **PPAP Status or Readiness** | Belongs to PPAP Workflow Domain |
| **File Storage** | Belongs to Workspace/Vault Domain |
| **Component/BOM Master Data** | Belongs to EMIP Domain (consumed via stub) |
| **Workflow Authority** | Belongs to PPAP Workflow Domain |
| **Document Finalization** | User approval required; Copilot produces drafts only |
| **Document Approval** | Belongs to PPAP Workflow Domain |
| **Template File Storage** | Belongs to Workspace/Vault Domain |

**Strict Constraints:**

Document Copilot **MUST NOT:**
- Finalize PPAP decisions or determine PPAP status
- Determine workflow status or progression
- Directly mutate PPAP state or assignment
- Approve documents or mark them as final
- Store files directly (must use Vault contracts)
- Make workflow decisions based on draft quality
- Determine document completeness for workflow purposes

Document Copilot **MUST ONLY:**
- Generate draft content via Claude API
- Ask clarifying questions through UI
- Structure information into document formats
- Provide confidence metadata for user review
- Store drafts in Vault via storeFile() contract
- Notify PPAP Workflow via Event Contract (PPAP-Bound mode only)

#### Consumes

| Input | Source Domain | Contract Type |
|-------|---------------|---------------|
| **Source Files** | Workspace/Vault | Read Contract (BOM PDFs, templates, drawings) |
| **PPAP Context** | PPAP Workflow | Read Contract (PPAP-Bound mode only) |
| **EMIP Data** | EMIP Domain | Read Contract (STUBBED - returns mock data) |
| **User Identity** | Core Platform | Read Contract (who is operating) |
| **Document Requirements** | PPAP Workflow | Read Contract (what needs to be created) |

#### Produces

| Output | Consumers | Contract Type |
|--------|-----------|---------------|
| **Draft Documents** | Workspace/Vault | Output Contract (via storeFile) |
| **Document Drafts Created** | PPAP Workflow | Event Contract (PPAP-Bound mode only) |
| **Session State** | Command Center | Read Contract (session visibility) |
| **Conversation History** | User (via UI) | Read Contract (chat history) |
| **AI Provenance Metadata** | Version Service | Output Contract (stored with versions) |

---

### 2. TWO-MODE ARCHITECTURE

Document Copilot operates in two distinct modes with explicit differences in entry point, source loading, context, output routing, and completion tracking.

#### Mode 1: PPAP-Bound

**Entry Point:**
- Launched from within active PPAP record
- Route: `/ppap/[id]/copilot` or `/ppap/[id]/documents` with "Generate with AI" action
- User is already in PPAP context

**Source Document Loading: AUTOMATIC**

Template Loading:
- Loaded automatically from PPAP requirements
- PPAP Workflow provides required document types (PFMEA, Control Plan, etc.)
- Copilot retrieves template from prompt template registry

BOM Loading:
- Loaded via `getEmipContext(ppapId)` — **STUBBED for now, returns mock data**
- Future: queries EMIP domain for real component/BOM data
- User upload fallback: available if auto-load fails or data is missing

**Context Provided to Claude:**
- PPAP record context (part number, customer, revision, supplier)
- EMIP stub data (component list, operations, BOM structure)
- Template (document type, required fields, output format)
- Optional: engineering drawings (if uploaded by user)

**Output Routing:**
- Draft stored in Vault via `storeFile()` contract
- PPAP Workflow notified via `DocumentDraftCreatedEvent`
- Event payload: `{ ppapId, documentType, vaultFileId, sessionId }`
- PPAP Workflow updates document requirement status

**Completion Tracking:**
- PPAP Workflow owns completion status
- Copilot emits event; PPAP decides if requirement is satisfied
- User can iterate on draft (Copilot maintains session state)
- Final approval happens in PPAP Workflow domain

**User Experience:**
1. User clicks "Generate PFMEA with AI" in PPAP workspace
2. Copilot launches with PPAP context pre-loaded
3. Claude generates draft based on PPAP + BOM + template
4. Draft appears in PPAP documents list (via Event Contract)
5. User reviews, iterates, or approves
6. PPAP Workflow tracks document requirement as satisfied

#### Mode 2: Standalone

**Entry Point:**
- Document workspace (independent of any PPAP)
- Route: `/document-workspace` or `/copilot/standalone`
- User is NOT in PPAP context

**Source Document Loading: MANUAL**

Template Loading:
- User selects document type from dropdown (PFMEA, Control Plan, etc.)
- Copilot retrieves template from prompt template registry

BOM Loading:
- User uploads BOM PDF manually
- Copilot parses BOM using `bomParser.ts` and `bomNormalizer.ts`
- No EMIP context available (no PPAP to query)

**Context Provided to Claude:**
- Only what user provides (BOM PDF, template selection)
- No PPAP context (no part number, customer, etc.)
- Optional: engineering drawings (if uploaded by user)

**Output Routing:**
- Draft stored in Vault via `storeFile()` contract
- NO Event Contract emitted (no PPAP to notify)
- Draft exists as standalone file in Vault
- May be attached to PPAP later (user action)

**Completion Tracking:**
- None (user-driven)
- Copilot maintains session state for iteration
- User can download, export, or attach to PPAP
- No workflow tracking

**User Experience:**
1. User navigates to `/document-workspace`
2. User uploads BOM PDF
3. User selects "PFMEA" from template dropdown
4. Claude generates draft based on BOM + template only
5. Draft stored in Vault (no PPAP association)
6. User can download, iterate, or attach to PPAP later

#### Mode Comparison Table

| Aspect | PPAP-Bound | Standalone |
|--------|------------|------------|
| **Entry Point** | `/ppap/[id]/copilot` | `/document-workspace` |
| **Template Loading** | Automatic (from PPAP requirements) | Manual (user selects) |
| **BOM Loading** | Automatic (via `getEmipContext`) + fallback | Manual (user uploads) |
| **PPAP Context** | Yes (part number, customer, etc.) | No |
| **EMIP Context** | Yes (stubbed, returns mock data) | No |
| **Output Routing** | Vault + Event to PPAP Workflow | Vault only |
| **Completion Tracking** | PPAP Workflow owns status | None (user-driven) |
| **Event Emission** | Yes (`DocumentDraftCreatedEvent`) | No |
| **Attachment to PPAP** | Automatic | Manual (user action) |

---

### 3. CLAUDE API INTEGRATION ARCHITECTURE

#### Input Package Sent to Claude

**Document Package Structure:**

```typescript
interface ClaudeInputPackage {
  // Core inputs (always present)
  bomData: {
    raw: string;              // Raw BOM text from PDF
    parsed: ParsedBOM;        // Structured data from bomParser.ts
    normalized: NormalizedBOM; // Business entities from bomNormalizer.ts
  };
  
  template: {
    documentType: string;     // 'PFMEA' | 'ControlPlan' | 'ProcessFlow' | 'PSW'
    requiredFields: FieldDefinition[];
    outputFormat: OutputSchema;
    validationRules: ValidationRule[];
  };
  
  systemPrompt: string;       // Claude's role and output format instructions
  documentInstructions: string; // Document-type-specific instructions
  
  // Optional inputs (context-dependent)
  excelTemplate?: File;       // Excel template for reference
  engineeringDrawing?: File;  // Engineering drawing for context
  ppapContext?: {             // PPAP-Bound mode only
    partNumber: string;
    customerName: string;
    revision: string;
    supplierName: string;
  };
  emipContext?: EmipContext;  // PPAP-Bound mode only (stubbed)
}
```

**Input Assembly Process:**

1. **BOM Processing:**
   - User uploads BOM PDF (or auto-loaded in PPAP-Bound mode)
   - `pdfToText.ts` extracts raw text
   - `bomParser.ts` parses structured data (operations, components, quantities)
   - `bomNormalizer.ts` applies business logic (classification, categorization)
   - All three representations sent to Claude (raw + parsed + normalized)

2. **Template Selection:**
   - User selects document type (or auto-selected in PPAP-Bound mode)
   - Prompt template registry provides template definition
   - Template includes: required fields, output format, validation rules

3. **Context Enrichment:**
   - PPAP-Bound mode: add PPAP context + EMIP stub data
   - Standalone mode: no additional context
   - Optional: user uploads engineering drawing

4. **Prompt Construction:**
   - System prompt defines Claude's role and output format
   - Document-specific instructions from prompt template
   - Input package serialized to JSON for Claude

#### Claude Interaction Model

**Initial Call:**

```typescript
interface ClaudeRequest {
  model: 'claude-sonnet-4-20250514';
  max_tokens: 8000;           // For initial generation
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: systemPrompt },
        { type: 'text', text: documentInstructions },
        { type: 'document', source: bomPDF },
        { type: 'document', source: excelTemplate },
        { type: 'text', text: JSON.stringify(inputPackage) }
      ]
    }
  ];
}
```

**Conversation Flow:**

1. **Initial Generation:**
   - Send full input package to Claude
   - Claude returns first response (draft or question)
   - Max tokens: 8000

2. **If Claude Needs More Information:**
   - Claude returns structured question
   - User receives question in chat UI
   - User responds via text input
   - Response added to conversation history

3. **Follow-Up Exchanges:**
   - User response sent to Claude with conversation history
   - Claude continues generation or asks another question
   - Max tokens: 2000 per follow-up exchange
   - Conversation history maintained in session state

4. **Final Output:**
   - Claude returns completed document data
   - Structured JSON matching output schema
   - System validates against template schema

**Model Configuration:**

- **Model:** `claude-sonnet-4-20250514` (Sonnet 4, May 2025 release)
- **Max Tokens (Initial):** 8000 tokens
- **Max Tokens (Follow-Up):** 2000 tokens per exchange
- **Temperature:** 0.3 (deterministic, consistent output)
- **Top-P:** 0.9 (balanced creativity)

**Error Handling:**

- API timeout: Retry with exponential backoff (3 attempts)
- Rate limit: Queue request, retry after delay
- Invalid response: Ask Claude to reformat
- Schema validation failure: Ask Claude to correct output

#### Output Handling

**Claude Response Structure:**

```typescript
interface ClaudeResponse {
  type: 'draft' | 'question' | 'error';
  
  // If type === 'draft'
  documentData?: {
    fields: Record<string, any>;
    metadata: {
      confidence: 'high' | 'medium' | 'low';
      uncertainFields: string[];
      assumptions: string[];
    };
  };
  
  // If type === 'question'
  question?: {
    text: string;
    context: string;
    suggestedAnswers?: string[];
  };
  
  // If type === 'error'
  error?: {
    message: string;
    recoverable: boolean;
  };
}
```

**Output Processing:**

1. **Receive Claude Response:**
   - Parse JSON response from Claude
   - Validate against expected schema
   - Check response type (draft, question, error)

2. **If Draft Received:**
   - Validate document data against template schema
   - Extract confidence metadata
   - Store draft in Vault via `storeFile()` contract
   - Record AI provenance metadata

3. **Store in Vault:**
   - Convert document data to file format (JSON or Excel)
   - Call `storeFile(file, uploadedBy, context)`
   - Receive `FileReference { id, url, metadata }`

4. **Record AI Provenance:**
   - Store with version metadata:
     - Prompt template used
     - Model version (`claude-sonnet-4-20250514`)
     - Token count (input + output)
     - Generation timestamp
     - Confidence level
     - Uncertain fields list

5. **Notify PPAP Workflow (PPAP-Bound Only):**
   - Emit `DocumentDraftCreatedEvent`
   - Payload: `{ ppapId, documentType, vaultFileId, sessionId }`
   - PPAP Workflow updates document requirement status

6. **Update Session State:**
   - Mark session as complete (or awaiting user review)
   - Store conversation history
   - Enable iteration (user can refine draft)

---

### 4. PROMPT TEMPLATE SYSTEM

#### Prompt Template Structure

Each document type (PFMEA, Control Plan, Process Flow, PSW) has a prompt template defining how Claude should generate that document.

**Prompt Template Definition:**

```typescript
interface PromptTemplate {
  id: string;                 // 'pfmea' | 'controlPlan' | 'processFlow' | 'psw'
  name: string;               // 'Process FMEA'
  description: string;        // Human-readable description
  
  systemPrompt: string;       // Claude's role and output format instructions
  documentInstructions: string; // Document-type-specific instructions
  
  requiredInputs: {
    bom: boolean;             // BOM required?
    template: boolean;        // Excel template required?
    drawing: boolean;         // Engineering drawing required?
    ppapContext: boolean;     // PPAP context required?
  };
  
  optionalInputs: {
    emipContext: boolean;     // EMIP data optional?
    additionalFiles: boolean; // User can upload more files?
  };
  
  outputFormat: {
    schema: JSONSchema;       // Expected output structure
    fileFormat: 'json' | 'excel' | 'pdf';
    excelMapping?: WorkbookCellMap; // If fileFormat === 'excel'
  };
  
  validationRules: ValidationRule[];
  
  examplePrompt?: string;     // Example prompt for testing
}
```

**System Prompt (Common Across All Templates):**

```
You are an expert automotive quality engineer specializing in PPAP (Production Part Approval Process) documentation. Your role is to generate accurate, complete, and industry-standard PPAP documents based on Bill of Materials (BOM) data, engineering drawings, and customer requirements.

Output Format:
- Return structured JSON matching the provided schema
- Include confidence metadata for each field
- Flag uncertain fields requiring user review
- List assumptions made during generation

Quality Standards:
- Follow AIAG (Automotive Industry Action Group) standards
- Use industry-standard terminology
- Ensure traceability between BOM and document fields
- Highlight potential risks or gaps

If you need clarification, ask specific questions rather than making assumptions.
```

**Document-Specific Instructions (Example: PFMEA):**

```
Generate a Process FMEA (Failure Mode and Effects Analysis) document based on the provided BOM data.

Required Sections:
1. Process Steps: Extract from BOM operations (--10, --20, etc.)
2. Failure Modes: Identify potential failure modes for each operation
3. Effects: Describe customer impact of each failure mode
4. Severity: Rate severity (1-10) based on customer impact
5. Causes: Identify root causes of each failure mode
6. Occurrence: Rate likelihood (1-10) of each cause
7. Current Controls: Identify existing detection methods
8. Detection: Rate detection effectiveness (1-10)
9. RPN: Calculate Risk Priority Number (Severity × Occurrence × Detection)
10. Recommended Actions: Suggest mitigation for high RPN items

Industry Standards:
- Use AIAG FMEA-4 methodology
- Severity 9-10: Safety or regulatory non-compliance
- Severity 7-8: Major performance degradation
- Severity 4-6: Moderate customer impact
- Severity 1-3: Minor or no customer impact
- RPN > 200: High risk, immediate action required
- RPN 100-200: Medium risk, action recommended
- RPN < 100: Low risk, monitor

Output Structure:
Return JSON with array of failure modes, each containing:
- processStep, failureMode, effect, severity, cause, occurrence, currentControl, detection, rpn, recommendedAction
```

#### Prompt Template Registry

**Storage Location:** `src/features/copilot/templates/registry.ts` (repurposed from `documentEngine/templates/registry.ts`)

**Registry Structure:**

```typescript
// Static prompt templates (built-in)
const staticPromptTemplates: Record<string, PromptTemplate> = {
  'pfmea': PFMEA_PROMPT_TEMPLATE,
  'controlPlan': CONTROL_PLAN_PROMPT_TEMPLATE,
  'processFlow': PROCESS_FLOW_PROMPT_TEMPLATE,
  'psw': PSW_PROMPT_TEMPLATE,
};

// Dynamic prompt templates (user-defined or ingested)
const dynamicPromptTemplates: Record<string, PromptTemplate> = {};

// Registry API
export function getPromptTemplate(id: string): PromptTemplate;
export function listPromptTemplates(): PromptTemplate[];
export function registerPromptTemplate(template: PromptTemplate): void;
export function hasPromptTemplate(id: string): boolean;
```

**Dynamic Template Support:**

- Prompt templates can be added without code changes
- User can upload custom prompt templates (JSON format)
- Custom templates validated against `PromptTemplate` schema
- Custom templates stored in database (future enhancement)

#### Validation Rules

Each prompt template includes validation rules to ensure Claude's output meets requirements.

**Validation Rule Types:**

```typescript
interface ValidationRule {
  field: string;              // Field to validate
  type: 'required' | 'range' | 'format' | 'dependency';
  
  // If type === 'required'
  required?: boolean;
  
  // If type === 'range'
  min?: number;
  max?: number;
  
  // If type === 'format'
  pattern?: string;           // Regex pattern
  
  // If type === 'dependency'
  dependsOn?: string;         // Other field that must exist
  
  errorMessage: string;       // User-facing error message
}
```

**Example Validation Rules (PFMEA):**

```typescript
const pfmeaValidationRules: ValidationRule[] = [
  {
    field: 'severity',
    type: 'range',
    min: 1,
    max: 10,
    errorMessage: 'Severity must be between 1 and 10'
  },
  {
    field: 'occurrence',
    type: 'range',
    min: 1,
    max: 10,
    errorMessage: 'Occurrence must be between 1 and 10'
  },
  {
    field: 'detection',
    type: 'range',
    min: 1,
    max: 10,
    errorMessage: 'Detection must be between 1 and 10'
  },
  {
    field: 'rpn',
    type: 'dependency',
    dependsOn: 'severity,occurrence,detection',
    errorMessage: 'RPN must be calculated from severity, occurrence, and detection'
  },
  {
    field: 'failureMode',
    type: 'required',
    required: true,
    errorMessage: 'Failure mode is required for each process step'
  }
];
```

---

### 5. STUB DEFINITION: getEmipContext()

#### Stub Contract

**Function Signature:**

```typescript
async function getEmipContext(ppapId: string): Promise<EmipContext>
```

**Current Behavior (STUBBED):**

Returns mock `EmipContext` with placeholder component data. Does NOT query real EMIP domain (EMIP storage not yet built).

**Future Behavior:**

Queries EMIP domain for real component/BOM data associated with PPAP. Implementation changes when EMIP storage is built; interface remains fixed.

#### EmipContext Type Definition

```typescript
interface EmipContext {
  ppapId: string;
  partNumber: string;
  partDescription: string;
  customerName: string;
  supplierName: string;
  
  components: Component[];
  operations: Operation[];
  bomStructure: BOMNode[];
  
  metadata: {
    source: 'emip' | 'stub';
    lastUpdated: string;
    confidence: 'high' | 'medium' | 'low';
  };
}

interface Component {
  id: string;
  partNumber: string;
  description: string;
  quantity: number;
  uom: string;
  category: 'wire' | 'terminal' | 'connector' | 'hardware' | 'other';
  supplier?: string;
}

interface Operation {
  id: string;
  stepNumber: string;        // '--10', '--20', etc.
  operationCode: string;
  description: string;
  workCenter?: string;
  setupTime?: number;
  cycleTime?: number;
}

interface BOMNode {
  id: string;
  parentId?: string;
  component: Component;
  children: BOMNode[];
  level: number;
}
```

#### Stub Implementation

**File:** `src/features/copilot/services/emipStub.ts`

```typescript
export async function getEmipContext(ppapId: string): Promise<EmipContext> {
  console.log('[STUB] getEmipContext called for PPAP:', ppapId);
  console.log('[STUB] Returning mock EMIP data - EMIP storage not yet built');
  
  // Mock data for development and testing
  return {
    ppapId,
    partNumber: 'MOCK-12345',
    partDescription: 'Mock Wire Harness Assembly',
    customerName: 'Mock Customer Inc.',
    supplierName: 'Mock Supplier LLC',
    
    components: [
      {
        id: 'comp-1',
        partNumber: 'WIRE-001',
        description: '18 AWG Red Wire',
        quantity: 10,
        uom: 'FT',
        category: 'wire',
      },
      {
        id: 'comp-2',
        partNumber: 'TERM-001',
        description: 'Ring Terminal 18-22 AWG',
        quantity: 20,
        uom: 'EA',
        category: 'terminal',
      },
    ],
    
    operations: [
      {
        id: 'op-1',
        stepNumber: '--10',
        operationCode: 'CUT',
        description: 'Cut wire to length',
      },
      {
        id: 'op-2',
        stepNumber: '--20',
        operationCode: 'STRIP',
        description: 'Strip wire ends',
      },
      {
        id: 'op-3',
        stepNumber: '--30',
        operationCode: 'CRIMP',
        description: 'Crimp terminals',
      },
    ],
    
    bomStructure: [
      {
        id: 'node-1',
        component: { /* component data */ },
        children: [],
        level: 0,
      },
    ],
    
    metadata: {
      source: 'stub',
      lastUpdated: new Date().toISOString(),
      confidence: 'low',
    },
  };
}
```

#### Interface Contract (Fixed)

**The interface is FIXED and will NOT change when EMIP storage is built.**

Only the implementation changes:
- **Now:** Returns mock data from stub
- **Future:** Queries EMIP database for real data

**V3.2F-2 and V3.2F-3 MUST:**
- Use `getEmipContext()` function
- Handle `EmipContext` type
- Check `metadata.source` to distinguish stub vs real data
- Display warning to user if `metadata.source === 'stub'`

**Future EMIP Implementation:**
- Replace stub implementation with real database queries
- Return same `EmipContext` structure
- Set `metadata.source = 'emip'`
- No changes required in Document Copilot code

---

### 6. DOCUMENTENGINE MIGRATION PLAN

#### Files to KEEP AS-IS (No Changes Needed)

**Core Parsing and Normalization:**
- `core/bomParser.ts` — Pure BOM parsing, feeds Claude
- `core/bomNormalizer.ts` — Data normalization, feeds Claude

**Rationale:** AI orchestration still needs structured BOM data. These parsers extract and normalize data before sending to Claude. Deterministic parsing is faster, cheaper, and more reliable than AI parsing.

**Services (Workflow Intelligence):**
- `services/workflowGuidanceService.ts` — Workflow phase detection, guidance
- `services/riskAnalysisService.ts` — Risk assessment from validation results
- `services/systemValidationService.ts` — Completeness and readiness checks
- `services/systemHealthService.ts` — Health scoring and risk aggregation

**Rationale:** These services analyze document state, not generation method. AI-generated documents still need workflow guidance, risk analysis, validation, and health scoring.

**Persistence:**
- `persistence/sessionService.ts` — Session CRUD operations
- `persistence/versionDiffService.ts` — Version comparison logic

**Rationale:** Persistence is orthogonal to generation method. AI-generated documents still need session management and version comparison.

**Export (Presentation Layer):**
- `export/excelTemplateInjector.ts` — Excel workbook injection
- `export/mappings/controlPlanWorkbookMap.ts` — Cell coordinate mappings
- `export/mappings/processFlowWorkbookMap.ts` — Cell coordinate mappings
- `export/mappings/pfmeaSummaryWorkbookMap.ts` — Cell coordinate mappings

**Rationale:** Export is presentation logic, not generation logic. Claude generates document *data*; export layer handles *presentation* (injecting data into official PPAP workbook templates). Cell mappings are determined by Trane's template format, not generation method.

#### Files to REPURPOSE (Define Exact Changes)

**1. `core/documentGenerator.ts` → `copilot/services/claudeOrchestrator.ts`**

**Current Role:** Orchestrates document generation by calling template `generate()` functions

**New Role:** Orchestrates AI document generation by calling Claude API

**Changes:**
- Rename file: `core/documentGenerator.ts` → `copilot/services/claudeOrchestrator.ts`
- Replace `template.generate()` calls with Claude API calls
- Maintain same interface: `generateDocument(templateId, input) → draft`
- Add conversation state management
- Add prompt construction logic
- Add Claude response parsing

**Interface Preserved:**
```typescript
// BEFORE (deterministic generation):
export async function generateDocument(
  templateId: TemplateId,
  input: TemplateInput
): Promise<DocumentDraft> {
  const template = getTemplate(templateId);
  return template.generate(input);
}

// AFTER (AI orchestration):
export async function generateDocument(
  templateId: TemplateId,
  input: TemplateInput,
  sessionId?: string
): Promise<DocumentDraft> {
  const promptTemplate = getPromptTemplate(templateId);
  const inputPackage = assembleInputPackage(input, promptTemplate);
  const claudeResponse = await callClaude(inputPackage, sessionId);
  return parseClaudeResponse(claudeResponse);
}
```

**2. `persistence/versionService.ts` → Add AI Provenance Metadata**

**Current Role:** Document version control and audit trail

**New Role:** Same + AI provenance tracking

**Changes:**
- Add `aiProvenance` field to `DocumentVersion` type
- Store AI metadata with each version:
  - Prompt template used
  - Model version
  - Token count (input + output)
  - Generation timestamp
  - Confidence level
  - Uncertain fields list
- No changes to version control logic

**Type Extension:**
```typescript
// BEFORE:
export type DocumentVersion = {
  id: string;
  documentId: string;
  sessionId: string;
  templateId: TemplateId;
  versionNumber: number;
  documentData: DocumentDraft;
  editableData: DocumentDraft;
  metadata: DocumentMetadata;
  createdBy: string | null;
  createdAt: string;
  isApproved: boolean;
  mappingMetadata?: MappingMetadata; // Old: field mapping provenance
};

// AFTER:
export type DocumentVersion = {
  // ... all existing fields ...
  aiProvenance?: AIProvenance; // New: AI generation provenance
};

export type AIProvenance = {
  model: string;              // 'claude-sonnet-4-20250514'
  promptTemplateId: string;   // 'pfmea'
  promptTemplateVersion: string; // '1.0'
  tokenCount: {
    input: number;
    output: number;
    total: number;
  };
  generatedAt: string;
  confidence: 'high' | 'medium' | 'low';
  uncertainFields: string[];
  assumptions: string[];
  conversationTurns: number;  // How many Q&A exchanges
};
```

**3. `templates/registry.ts` → `copilot/templates/promptRegistry.ts`**

**Current Role:** Template registry for deterministic generation

**New Role:** Prompt template registry for AI generation

**Changes:**
- Rename file: `templates/registry.ts` → `copilot/templates/promptRegistry.ts`
- Replace `TemplateDefinition` with `PromptTemplate`
- Replace `generate()` functions with prompt instructions
- Maintain same registry interface (get, list, register, has)

**Type Replacement:**
```typescript
// BEFORE (deterministic template):
interface TemplateDefinition {
  id: TemplateId;
  name: string;
  description: string;
  requiredInputs: InputDefinition[];
  fieldDefinitions: FieldDefinition[];
  layout: DocumentLayout;
  generate: (input: TemplateInput) => DocumentDraft; // Code function
}

// AFTER (prompt template):
interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;           // Claude's role
  documentInstructions: string;   // Document-specific instructions
  requiredInputs: RequiredInputs; // What must be present
  optionalInputs: OptionalInputs; // What enriches output
  outputFormat: OutputFormat;     // Expected structure
  validationRules: ValidationRule[]; // What makes output acceptable
}
```

**4. `wizard/wizardValidationEngine.ts` → `copilot/services/aiAssistedValidation.ts`**

**Current Role:** Deterministic rule-based field validation

**New Role:** AI-assisted validation feedback

**Changes:**
- Rename file: `wizard/wizardValidationEngine.ts` → `copilot/services/aiAssistedValidation.ts`
- Replace hardcoded rules with Claude API calls for validation reasoning
- Maintain same validation interface: `validateFieldChange(context) → ValidationResult`
- Add AI reasoning to validation warnings

**Interface Preserved:**
```typescript
// BEFORE (deterministic rules):
export function validateFieldChange(context: FieldContext): ValidationResult {
  if (context.fieldName === 'severity') {
    if (context.operationDescription.includes('crimp') && context.userValue < 6) {
      return {
        isValid: true,
        warning: 'Crimp operations typically require severity ≥ 6',
        severity: 'high'
      };
    }
  }
  // ... hardcoded rules ...
}

// AFTER (AI-assisted):
export async function validateFieldChange(context: FieldContext): Promise<ValidationResult> {
  // Call Claude for contextual validation reasoning
  const validationPrompt = `
    Validate this field change:
    - Field: ${context.fieldName}
    - User value: ${context.userValue}
    - Original autofill: ${context.originalAutofill}
    - Operation: ${context.operationDescription}
    
    Provide validation feedback based on industry standards.
  `;
  
  const claudeResponse = await callClaudeForValidation(validationPrompt);
  return parseValidationResponse(claudeResponse);
}
```

#### Files to REMOVE

**1. `templates/templateIngestionService.ts`**

**Reason:** Deterministic field mapping logic obsolete. Claude handles field population based on prompt instructions. No need for hardcoded BOM → Process Flow → PFMEA → Control Plan mapping chains.

**Replacement:** Prompt template schema validator (validates prompt template JSON structure, not field mappings)

**2. `wizard/wizardAutofillRules.ts`**

**Reason:** Hardcoded autofill rules replaced by Claude. Instead of "if operation contains 'crimp' then suggest 'Crimp height measurement'", Claude analyzes operation descriptions in context and suggests appropriate methods/failure modes/effects with natural language reasoning.

**Replacement:** Claude prompt instructions that include FMEA/Control Plan best practices and industry standards

---

### 7. CONTRACT DEFINITIONS

All contracts use V3.2B contract types (Request, Output, Read, Event).

#### Contract 1: Document Copilot → Claude API

**Type:** External API Integration (not V3.2B domain contract)

**Request Contract:**

```typescript
interface SendToClaudeRequest {
  inputPackage: ClaudeInputPackage;
  sessionId?: string;         // For conversation continuity
  conversationHistory?: Message[];
}

interface SendToClaudeResponse {
  type: 'draft' | 'question' | 'error';
  documentData?: DocumentDraft;
  question?: Question;
  error?: Error;
  metadata: {
    model: string;
    tokenCount: { input: number; output: number };
    generatedAt: string;
  };
}
```

**Implementation:** `copilot/services/claudeClient.ts`

---

#### Contract 2: PPAP Workflow → Document Copilot

**Type:** Request Contract

**Purpose:** Launch copilot session from PPAP context

**Request:**

```typescript
interface LaunchCopilotSessionRequest {
  ppapId: string;
  documentType: string;       // 'PFMEA' | 'ControlPlan' | etc.
  launchedBy: string;         // User ID
  context: {
    partNumber: string;
    customerName: string;
    revision: string;
  };
}

interface LaunchCopilotSessionResponse {
  sessionId: string;
  status: 'launched' | 'failed';
  error?: string;
}
```

**Implementation:** `copilot/mutations.ts` → `launchCopilotSession()`

**Usage:**
```typescript
// PPAP Workflow calls Document Copilot
import { launchCopilotSession } from '@/src/features/copilot/mutations';

const response = await launchCopilotSession({
  ppapId: 'ppap-123',
  documentType: 'PFMEA',
  launchedBy: 'user-456',
  context: { partNumber: 'ABC-123', customerName: 'Acme', revision: 'A' }
});

// Navigate to copilot UI with sessionId
router.push(`/ppap/${ppapId}/copilot?session=${response.sessionId}`);
```

---

#### Contract 3: Document Copilot → Workspace/Vault

**Type:** Output Contract (uses existing Vault contracts)

**Purpose:** Store draft document in Vault

**Request:** Uses existing `StoreFileRequest` from Vault

```typescript
import { storeFile } from '@/src/features/vault/mutations';

const fileRef = await storeFile(
  draftFile,              // File object (JSON or Excel)
  'claude-copilot',       // uploadedBy
  {
    ownerId: sessionId,   // Copilot session ID
    ownerType: 'COPILOT_SESSION',
    metadata: {
      documentType: 'PFMEA',
      aiGenerated: true,
      confidence: 'high',
    }
  }
);

// fileRef: { id, url, metadata }
```

**Response:** Uses existing `FileReference` from Vault

---

#### Contract 4: Document Copilot → PPAP Workflow

**Type:** Event Contract

**Purpose:** Notify PPAP Workflow that draft document was created

**Event:**

```typescript
interface DocumentDraftCreatedEvent {
  eventType: 'DOCUMENT_DRAFT_CREATED';
  eventId: string;            // UUID for deduplication
  timestamp: string;
  
  payload: {
    ppapId: string;
    documentType: string;     // 'PFMEA' | 'ControlPlan' | etc.
    vaultFileId: string;      // File reference from Vault
    sessionId: string;        // Copilot session ID
    confidence: 'high' | 'medium' | 'low';
    uncertainFields: string[];
  };
  
  actor: {
    userId: string;
    userName: string;
    role: string;
  };
}
```

**Implementation:** `copilot/events.ts` → `emitDocumentDraftCreatedEvent()`

**Consumer:** PPAP Workflow listens for event and updates document requirement status

**Usage:**
```typescript
// Document Copilot emits event after storing draft
import { emitDocumentDraftCreatedEvent } from '@/src/features/copilot/events';

await emitDocumentDraftCreatedEvent({
  ppapId: 'ppap-123',
  documentType: 'PFMEA',
  vaultFileId: fileRef.id,
  sessionId: 'session-789',
  confidence: 'high',
  uncertainFields: ['occurrence', 'detection'],
}, currentUser);

// PPAP Workflow receives event and updates status
// (Implementation in PPAP Workflow domain)
```

---

#### Contract 5: Document Copilot → EMIP (STUBBED)

**Type:** Read Contract

**Purpose:** Retrieve component/BOM data for PPAP

**Request:**

```typescript
interface GetEmipContextRequest {
  ppapId: string;
}

interface GetEmipContextResponse {
  context: EmipContext;
  metadata: {
    source: 'emip' | 'stub';
    lastUpdated: string;
    confidence: 'high' | 'medium' | 'low';
  };
}
```

**Implementation:** `copilot/services/emipStub.ts` → `getEmipContext()`

**Current Behavior:** Returns mock `EmipContext` with placeholder data

**Future Behavior:** Queries EMIP domain for real component/BOM data

**Interface Contract:** FIXED — only implementation changes when EMIP storage is built

---

### 8. V3.2F-2 AND V3.2F-3 READINESS CRITERIA

**V3.2F-2 and V3.2F-3 MUST confirm these preconditions before starting:**

#### Precondition 1: All Contracts Defined

**Check:**
- Document Copilot → Claude API contract defined
- PPAP Workflow → Document Copilot contract defined
- Document Copilot → Vault contract defined (uses existing Vault contracts)
- Document Copilot → PPAP Workflow event contract defined
- Document Copilot → EMIP stub contract defined

**Validation:** All 5 contracts have TypeScript interfaces in V3.2F-1 Section 7

---

#### Precondition 2: Both Modes Documented

**Check:**
- PPAP-Bound mode fully documented (entry, loading, context, routing, tracking)
- Standalone mode fully documented (entry, loading, context, routing, tracking)
- Mode comparison table exists
- Differences are explicit

**Validation:** V3.2F-1 Section 2 documents both modes with comparison table

---

#### Precondition 3: Stub Interface Defined

**Check:**
- `getEmipContext()` function signature defined
- `EmipContext` type fully defined
- Current behavior (stub) documented
- Future behavior (real EMIP query) documented
- Interface contract is FIXED

**Validation:** V3.2F-1 Section 5 defines stub with complete type definitions

---

#### Precondition 4: Migration Plan Confirmed

**Check:**
- 9 files to KEEP AS-IS identified with rationale
- 4 files to REPURPOSE identified with exact changes
- 2 files to REMOVE identified with replacement strategy
- No ambiguity about what happens to each file

**Validation:** V3.2F-1 Section 6 lists all 16 files with verdicts and rationale

---

#### Precondition 5: Claude API Model and Token Limits Specified

**Check:**
- Model version specified: `claude-sonnet-4-20250514`
- Max tokens (initial) specified: 8000
- Max tokens (follow-up) specified: 2000
- Temperature specified: 0.3
- Top-P specified: 0.9

**Validation:** V3.2F-1 Section 3 specifies all Claude API configuration

---

#### Precondition 6: Prompt Template Structure Defined

**Check:**
- `PromptTemplate` type fully defined
- System prompt structure defined
- Document-specific instructions structure defined
- Validation rules structure defined
- Prompt template registry interface defined

**Validation:** V3.2F-1 Section 4 defines complete prompt template system

---

#### Precondition 7: V3.2A-E-2 Locked

**Check:**
- V3.2A domain ownership rules are finalized
- V3.2B interface contracts are finalized
- V3.2E-2 Workspace/Vault extraction is complete
- Vault domain exists at `src/features/vault/`
- No pending changes to domain definitions

**Validation:** Verify Vault domain exists, V3.2E-2 committed, BUILD_PLAN.md V3.2A-E sections complete

---

#### Precondition 8: DIAG-02 Verdicts Understood

**Check:**
- DIAG-02 Deep Scan report exists
- 16 files analyzed
- 9 KEEP AS-IS verdicts understood
- 3 REPURPOSE verdicts understood
- 2 REMOVE verdicts understood

**Validation:** DIAG-02 report exists with verdicts for all 16 files (completed in previous session)

---

**If ALL preconditions are met, V3.2F-2 may proceed with implementation.**

**If ANY precondition fails, V3.2F-2 MUST STOP and report which precondition failed.**

---

### 9. IMPLEMENTATION PHASES

**V3.2F-2: Document Copilot Core Implementation**
- Create `src/features/copilot/` domain structure
- Implement Claude API client
- Implement prompt template registry
- Implement `claudeOrchestrator.ts` (repurposed from `documentGenerator.ts`)
- Implement EMIP stub (`getEmipContext()`)
- Implement session management
- Implement conversation state tracking
- **Deliverable:** Core copilot infrastructure operational

**V3.2F-3: Two-Mode Integration**
- Implement PPAP-Bound mode (entry from PPAP workspace)
- Implement Standalone mode (entry from document workspace)
- Implement contract integrations (Vault, PPAP Workflow, EMIP stub)
- Implement event emission (`DocumentDraftCreatedEvent`)
- Implement AI provenance tracking (extend `versionService.ts`)
- Migrate existing documentEngine files per migration plan
- **Deliverable:** Both modes operational, full integration complete

**V3.2F-4: UI and Polish** (Future)
- Copilot chat UI
- Conversation history display
- Draft review and iteration UI
- Confidence metadata visualization
- Uncertain fields highlighting

---

**This completes V3.2F-1 domain definition.**

**V3.2F-2 and V3.2F-3 may now proceed with implementation without making architectural decisions.**

---

## V3.2G-1: PPAP Workbook Output Architecture

**Status:** DEFINED — Documentation only. No implementation in this batch.
**Date:** 2026-04-02
**Purpose:** Define the architecture for producing customer-deliverable Excel workbooks from Claude-generated document drafts. Reinstates Excel injection as a presentation layer.

---

### 1. Architecture Decision Update

V3.2F-1 locked Excel injection as ABANDONED. That decision was correct in context: the old approach used ExcelJS as the **generation** engine (cell coordinate maps, deterministic row writing, no AI). That mechanism is permanently abandoned.

V3.2G-1 reinstates Excel injection as a **presentation layer only**:

- **Generation = Claude.** Claude produces structured JSON drafts via the Document Copilot pipeline.
- **Injection = ExcelJS.** After the user approves a Claude draft, ExcelJS injects the approved content into the customer's workbook template (cosmetic rendering only).
- The distinction is critical: injection does not generate content, it renders already-approved AI output into a deliverable format.

**Locked rule (replaces V3.2F-1 abandonment rule):**

> Direct Excel template injection as a GENERATION mechanism is abandoned. Excel injection as a PRESENTATION layer (injecting Claude-generated content into customer workbook templates) is reinstated as of V3.2G-1. Generation = Claude. Injection = ExcelJS presentation only.

---

### 2. Customer Template Storage Strategy

Customer workbook templates are admin-uploaded once per customer and stored in Supabase Storage.

**Bucket:** `ppap-templates`
**Path pattern:** `ppap-templates/{customerName}/workbook.xlsx`
**Example:** `ppap-templates/trane/workbook.xlsx`

- Templates are uploaded by an admin via the admin UI (not yet built — tracked as future work).
- At export time, the system retrieves the template from Storage, loads it with ExcelJS, and injects the approved Claude draft content.
- The existing `vaultService.ts` `storeFile()` method targets the `ppap-documents` bucket and is NOT used for template retrieval. A separate `getCustomerTemplate(customerName)` function is needed in V3.2G-2.
- The V2.8B.6 workbook rehydration pattern (load template, inject, create clean workbook, copy values + safe styles, serialize) is already implemented in `excelTemplateInjector.ts` and must be preserved.

---

### 3. Target User Workflow

The complete post-V3.2G flow is:

1. **User uploads BOM PDF** → BOM parsing pipeline extracts and normalizes data.
2. **User selects document type** and optionally uploads customer Excel template.
3. **User initiates generation** → Claude Orchestrator produces a structured JSON draft.
4. **User reviews draft** in `CopilotDraftPreview` → accepts or requests changes.
5. **Approved draft routes to export** → system retrieves customer template from Supabase Storage.
6. **ExcelJS injects approved content** into customer workbook using cell coordinate maps.
7. **Output workbook stored in Vault** (`ppap-documents` bucket) and made available for download.
8. **PPAP record updated** (PPAP-Bound mode only) to reflect document completion.

---

### 4. Engineering Master Parser Requirements

The BOM PDF pipeline currently extracts text and normalizes into `NormalizedBOM`. For Excel injection to work, Claude's output JSON must map cleanly to the customer workbook structure.

This requires:

- **Document-type-specific output schemas** defined in `promptRegistry.ts` per document type (PFMEA, Control Plan, Process Flow).
- **Claude output format instructions** that match the cell coordinate maps already in `excelTemplateInjector.ts`.
- **Validation step** between draft approval and injection: confirm required fields are present in Claude's JSON before attempting injection.

The existing Trane cell coordinate maps in `excelTemplateInjector.ts` (`WorkbookCellMap` interface, `headerMappings`, `rowMappings`) are the target injection schema. Claude must be prompted to produce output that aligns with these maps.

---

### 5. Excel Injection Architecture (V3.2G Layer)

**Entry point:** Post-approval export action in `CopilotWorkspace.tsx` review phase.

**Flow:**

```
CopilotDraft (approved JSON)
  → retrieveCustomerTemplate(customerName)       [new — vaultService extension]
  → exportToExcelTemplate(draft, cellMap)        [existing — excelTemplateInjector.ts]
  → downloadExcelFile(blob, filename)            [existing — excelTemplateInjector.ts]
  → storeFile(blob, userId, ppapContext)         [existing — vaultService.ts]
```

**Key constraints (V2.8B.6 pattern must be preserved):**
- Load template as source workbook (ExcelJS `readFile` / `load`)
- Create a clean new workbook (never mutate the source)
- Copy values and safe styles only (no protection metadata, no hidden state)
- Serialize the clean workbook for download/storage

**Cell coordinate maps** (`WorkbookCellMap`) remain document-type-specific and customer-specific. The existing Trane maps are the reference implementation.

---

### 6. Claude Output Format Alignment

For each document type, the prompt template in `promptRegistry.ts` must instruct Claude to return JSON that matches the injection schema:

- **Process Flow:** Operations array with `operationNumber`, `operationName`, `characteristics`, `controlMethod`
- **PFMEA:** Failure mode rows with `processStep`, `potentialFailureMode`, `potentialEffect`, `severity`, `occurrence`, `detection`, `rpn`, `recommendedAction`
- **Control Plan:** Control entries with `partNumber`, `processName`, `characteristicType`, `productCharacteristic`, `processCharacteristic`, `specificationTolerance`, `evaluationMeasurementTechnique`, `sampleSize`, `sampleFrequency`, `controlMethod`, `reactionPlan`

These schemas are defined in V3.2G-2. The V3.2G-1 constraint is: **do not change `excelTemplateInjector.ts` until schemas are finalized.**

---

### 7. New Files Needed (V3.2G-2 scope)

| File | Purpose |
|------|---------|
| `src/features/documentEngine/export/customerTemplateService.ts` | Retrieve customer workbook template from Supabase Storage |
| `src/features/documentEngine/export/injectionSchemas.ts` | Per-document-type cell map schemas aligned to Claude output format |
| `src/features/documentEngine/export/exportOrchestrator.ts` | Coordinate draft → template retrieval → injection → vault storage |
| `app/api/export/route.ts` | Server-side export API route (template retrieval requires server-side Supabase access) |

Existing files modified in V3.2G-2:
- `src/features/documentEngine/ui/CopilotWorkspace.tsx` — add export action to review phase
- `src/features/documentEngine/templates/promptRegistry.ts` — align output format schemas to injection schemas
- `src/features/vault/services/vaultService.ts` — add `getCustomerTemplate()` method

---

### 8. V3.2G-2 Readiness Criteria

V3.2G-2 (implementation) may begin when:

1. `docs/BUILD_PLAN.md` contains this V3.2G-1 section (complete).
2. `BOOTSTRAP.md` Excel injection rule updated to reflect presentation-layer reinstatement (complete).
3. `excelTemplateInjector.ts` V2.8B.6 pattern verified operational (confirmed — 724 lines, rehydration pattern intact).
4. Customer template storage path defined: `ppap-templates/{customerName}/workbook.xlsx` (defined above).
5. Claude output format schemas drafted for at least one document type (PFMEA, Control Plan, or Process Flow).
6. Claude Orchestrator pipeline V3.2F-3c confirmed end-to-end (confirmed — BOM parsing → Claude API → draft preview working).

**V3.2G-2 must not begin until all 6 criteria are met.**

---

**This completes V3.2G-1 architecture definition.**

---

## V3.2E — Copilot Prompt Contract

**Status:** DEFINED — Documentation only. No implementation in this batch.
**Date:** 2026-04-02
**Type:** Architecture / Documentation

---

### A. Purpose

The Document Copilot is treated as a **deterministic system component**, not an interactive AI assistant. This contract governs ALL AI interactions in the EMIP-PPAP system.

**Core proposition:**
- AI output must be **structured, predictable, and enforceable** — not conversational, probabilistic, or free-form.
- The system is responsible for assembling inputs correctly. Claude is responsible for producing output that conforms to this contract exactly.
- Any deviation from this contract — wrong structure, free text, missing fields, unsolicited documents — constitutes a **system fault**, not user error. The system must detect and reject nonconforming output.

This contract exists because AI inconsistency is a quality and reliability risk in a PPAP compliance context. Engineering-critical values that are fabricated, misattributed, or structurally malformed cannot be caught downstream without a strict contract at the generation boundary.

---

### B. Core Principles

1. **AI generates content, NOT system logic.**
   Claude MUST produce structured document content (field values, narrative text, engineering specifications) based on provided context. Claude MUST NOT make routing decisions, infer PPAP readiness, assign ownership, or determine document activation state.

2. **AI MUST follow strict output schema.**
   Every response from Claude MUST conform to the Output Contract defined in Section E. No output that deviates from the schema may be accepted by the system.

3. **AI MUST NOT generate inactive documents.**
   Claude MUST NOT produce content for documents that are not marked "active" in the Document Activation Input (Section C). Static and suppressed documents are invisible to Claude.

4. **AI MUST NOT infer ownership or workflow decisions.**
   Claude MUST NOT assign document owners, set approval state, determine submission readiness, or make any inference about PPAP workflow position. These decisions belong exclusively to the PPAP Workflow domain.

5. **AI MUST request missing data instead of guessing.**
   When required engineering-critical input is absent, Claude MUST emit a `missing_data_requests` entry (Section F). Claude MUST NOT fabricate plausible values, interpolate from partial data, or produce partially populated output that silently omits required fields.

---

### C. Prompt Structure (System-Level)

Every prompt sent to Claude in this system MUST include ALL five of the following sections, in this order. Omitting any section voids the contract.

#### 1. System Role

Defines Claude's identity and behavioral constraints for this call. Establishes that Claude is acting as a structured document generation engine, not a general assistant. Includes explicit prohibitions on free text, unsolicited documents, and fabrication.

#### 2. Critical Rules

An enumerated list of hard behavioral rules. These MUST use MUST / MUST NOT language. Rules address: output format enforcement, document activation scope, missing-data behavior, prohibited fabrication, and schema compliance. This section is loaded before any user-controlled input to prevent context poisoning.

#### 3. Document Activation Input

A structured declaration of which document types are active for this generation request. Derived from the Document Profile system. Claude MUST treat this list as the exclusive scope of generation. Documents not listed MUST NOT appear in output.

Activation states passed to Claude:
- `"active"` — Claude MUST generate content for this document type.
- `"static"` — Claude MUST ignore this document type entirely.
- `"external_required"` — Claude MUST NOT generate content; MUST emit a `missing_data_requests` entry noting that external data is required.

#### 4. Context Input

The full structured input package assembled by the AI integration layer. Includes:
- Raw BOM text (extracted from PDF)
- Parsed BOM data (structured JSON from the BOM parsing layer)
- Normalized BOM (business entities from the BOM normalization layer)
- EMIP context (from the EMIP context provider — mocked until EMIP storage is built)
- PPAP context (PPAP-Bound mode only: customer, part number, revision, commodity)
- Optional: customer workbook template (base64) — passed as context only; MUST NOT shape output structure
- Optional: engineering drawing (base64)

Claude MUST use only the data provided in the Context Input. Claude MUST NOT supplement with external knowledge not grounded in the provided context.

#### 5. Output Contract

The explicit schema instruction. Defines the exact JSON structure Claude must return. Specifies that no output outside this schema will be accepted. Must be the final section of the prompt so it is the most proximate instruction before Claude generates output.

---

### D. Document Activation Enforcement

The Document Activation Input (Section C.3) is the exclusive scope gate for document generation. These rules are absolute:

1. **Only `"active"` documents are generated.** Claude MUST produce output for each active document type in the `documents` map. Absence of a required active document in the output is a schema violation.

2. **`"static"` documents are ignored.** Claude MUST NOT include static documents in output at any key. The word "static" MUST NOT appear in Claude's response.

3. **`"external_required"` documents trigger data requests.** Claude MUST NOT attempt to generate content for these documents. Claude MUST emit one or more `missing_data_requests` entries explaining what external data is required and from whom.

4. **Claude MUST NOT generate unsolicited documents.** If a document type is not present in the Document Activation Input, it MUST NOT appear in the output under any key or alias.

5. **Activation state is determined by the system, not Claude.** Claude MUST NOT evaluate whether a document should be active based on context. The activation list is authoritative.

---

### E. Output Contract (Strict)

**All Claude output MUST conform to this contract exactly. No exceptions.**

#### Format

- **JSON ONLY.** Claude MUST NOT emit any text outside the JSON object — no preamble, no explanation, no markdown fences, no closing commentary.
- **No free text.** Narrative explanations, caveats, and model commentary are prohibited.
- **No partial output.** Claude MUST NOT return a document with some fields populated and others silently omitted. Either a field is populated or it appears in `missing_data_requests`.

#### Top-Level Structure

```json
{
  "documents": {},
  "missing_data_requests": []
}
```

- `documents` — a map where each key is a document type identifier (e.g., `"pfmea"`, `"control_plan"`, `"process_flow"`) corresponding to an active document in the Document Activation Input. Each value conforms to the per-document schema defined by the prompt orchestration layer for that document type.
- `missing_data_requests` — an array of request objects describing what data is absent and preventing complete generation. May be empty (`[]`) if all required data is present.

#### Per-Document Schema

Each document type has a strict, defined schema owned by the prompt orchestration layer. Schema is document-type-specific and format-agnostic — it is defined independently of any delivery format (Excel, PDF, or otherwise). Downstream formatting layers consume this schema; the schema MUST NOT be shaped by any downstream format's requirements. **A document object that does not conform to its schema is invalid and MUST be rejected by the system.**

Minimum schema compliance rules:
- All required fields for the document type MUST be present.
- Field types MUST match declared types (string, number, array of objects, etc.).
- Arrays MUST NOT be returned as scalars.
- Nested objects MUST NOT be flattened.
- Field names MUST match declared field identifiers exactly (no aliases, no case variants).

#### `missing_data_requests` Entry Structure

```json
{
  "document_type": "<document type identifier or 'global'>",
  "field": "<field identifier or description>",
  "reason": "<why this data is required>",
  "source": "<where the data should come from — e.g., 'customer', 'engineering drawing', 'BOM'>"
}
```

All four fields are required on every `missing_data_requests` entry.

#### Schema Violations

The following constitute schema violations. The system MUST reject output containing any of these:
- Output is not valid JSON.
- Top-level keys other than `documents` and `missing_data_requests` are present.
- A key in `documents` does not correspond to an active document type.
- A document object is missing required fields.
- A document field has wrong type.
- Free text appears anywhere outside field values.
- A `missing_data_requests` entry is missing any of its four required fields.

---

### F. Missing Data Behavior

1. **Claude MUST request missing required data.** When an engineering-critical field cannot be populated from the provided context, Claude MUST add a `missing_data_requests` entry rather than leaving the field empty or guessing.

2. **Claude MUST NOT fabricate engineering-critical values.** Severity rankings, RPN values, characteristic tolerances, sample sizes, control method specifications, and similar engineering parameters MUST NOT be invented. These values are safety-critical in PPAP contexts.

3. **Claude MAY ONLY derive values directly supported by the provided context.** A value is supported by context if it is explicitly present in the BOM data, EMIP context, PPAP context, or engineering drawing provided in the Context Input. Claude MUST NOT introduce new engineering assumptions, create implied process steps, or derive characteristics not explicitly present in the provided context. If context is insufficient to support a value, Claude MUST emit a `missing_data_requests` entry instead.

4. **The system MUST surface `missing_data_requests` to the user.** Any non-empty `missing_data_requests` array MUST be displayed in the Copilot UI before the user can accept a draft. The user must explicitly acknowledge missing data before proceeding.

5. **Missing data is not a generation failure.** A response that contains a valid `documents` map for active documents AND a populated `missing_data_requests` array is a valid, successful response — not an error. The system MUST handle this case without treating it as a fault.

---

### G. Determinism Requirement

1. **Same input MUST produce same structure.** For a fixed context package and fixed Document Activation Input, Claude's output structure MUST be identical across calls. Field names, nesting, array ordering, and key presence MUST NOT vary by call.

2. **Output MUST be stable for downstream consumers.** All downstream formatting layers depend on predictable field names, nesting, and structure. Structural variability in Claude output constitutes a system fault regardless of delivery format.

3. **Variability MUST be minimized.** Where multiple valid phrasings exist, prompt templates MUST prefer language that constrains Claude's structural choices. Temperature settings and system role framing MUST favor low-variance output.

4. **Determinism is a prompt engineering responsibility.** The AI integration layer and prompt orchestration layer jointly own the responsibility of constructing prompts that produce stable output. If output is structurally variable, the prompt MUST be revised — not the validation layer.

---

### H. Prohibited Behaviors

The following behaviors are **explicitly forbidden** for Claude in this system. Any prompt template or orchestration logic that permits these behaviors violates this contract.

| Prohibited Behavior | Rule |
|---|---|
| Generating documents not in the Document Activation Input | MUST NOT |
| Outputting narrative explanations, model commentary, or caveats | MUST NOT |
| Modifying, acknowledging, or referencing static documents | MUST NOT |
| Producing partially structured data (some fields present, some silently missing) | MUST NOT |
| Inventing engineering-critical values (severity, RPN, tolerances, sample sizes) | MUST NOT |
| Emitting any text outside the top-level JSON object | MUST NOT |
| Making PPAP workflow decisions (readiness, ownership, approval state) | MUST NOT |
| Using knowledge not grounded in the provided context package | MUST NOT |
| Returning an empty `documents` map when active documents were declared | MUST NOT |
| Aliasing, abbreviating, or case-varying required field names | MUST NOT |

---

### I. Validation Rules

The system MUST enforce the following validations on every Claude response before the response is surfaced to the user or stored:

1. **JSON parse validation.** The response body MUST parse as valid JSON. A parse failure is a hard error; the system MUST NOT present malformed output to the user.

2. **Top-level schema validation.** The parsed object MUST contain exactly `documents` (object) and `missing_data_requests` (array). Additional keys at the top level are invalid.

3. **Document scope validation.** Every key in `documents` MUST match an active document type declared in the Document Activation Input for this request. Documents not in the activation list MUST be rejected even if they appear in the output.

4. **Per-document required field validation.** Each document object MUST contain all required fields for its document type. Missing required fields MUST be flagged as a schema violation, not silently tolerated.

5. **Field type validation.** Each field in each document object MUST match its declared type. Type mismatches MUST be flagged as schema violations.

6. **`missing_data_requests` entry validation.** Every entry in the array MUST contain all four required fields (`document_type`, `field`, `reason`, `source`). Entries missing any field MUST be rejected.

7. **Rejection behavior.** A response that fails any validation check MUST be rejected. The system MUST NOT accept partial validation success. On rejection:
   - Log the validation error.
   - Return an error state to the Copilot UI.
   - Do NOT store the invalid draft in Vault.
   - Do NOT advance the Copilot session to review phase.

---

### J. Relationship to Other Domains

This contract defines Claude's output boundary. The responsibilities of other domains relative to Copilot output are:

| Domain | Role relative to Copilot output |
|---|---|
| **Document Copilot** | Assembles input package, calls Claude, validates output schema, surfaces draft and missing-data requests to user. Owns this contract. |
| **PPAP Workflow** | Evaluates document readiness and PPAP progression state after user accepts a draft. MUST NOT be called before user approval. |
| **Workspace / Vault** | Stores approved draft output as files. Receives only post-approval, user-accepted content. MUST NOT store rejected or unreviewed drafts. |
| **Engineer Command Center** | Displays Copilot session state and draft availability to users. READ-ONLY — MUST NOT trigger generation or validation. |
| **EMIP** | Provides reference component data (currently stubbed). Supplies part of the Context Input package to the Orchestrator. Has no post-generation role. |

**Critical boundary:** Document Copilot MUST NOT mutate PPAP state directly. It emits a `DocumentDraftCreatedEvent` after user approval; the PPAP Workflow domain handles that event and determines workflow impact.

---

### Non-Breaking Guarantee

This section introduces no code changes, no UI changes, and no schema changes. It is documentation only.

All constraints defined here align with existing architectural decisions in V3.2A (Domain Ownership), V3.2B (Interface Contracts), V3.2C (Scenario Validation), V3.2D (Failure Validation), and V3.2F-1 (Document Copilot Domain Definition). No existing rule is weakened or reversed by this contract.

---

**This completes the V3.2E Copilot Prompt Contract definition.**

