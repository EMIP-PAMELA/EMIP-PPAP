# EMIP-PPAP System Architecture & Build Plan

**Last Updated:** 2026-03-28 11:56 CT  
**Version:** 3F.15 + Implementation Update (Phases 9-21)  
**Status:** Architectural Blueprint + Implementation Reconciliation

**Previous Version:** Archived to `BUILD_PLAN_ARCHIVE_20260325.md`

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

## Conclusion

This document is the **implementation-grade source of truth** for EMIP-PPAP.

**Future implementation MUST:**
- Bootstrap against this plan
- Follow governance rules
- Preserve core architecture
- Update this plan as system evolves

**This plan is a living document.**
As the system evolves, this plan MUST be updated to reflect current state and future direction.

**As of Phase 21 (2026-03-28):**
- ✅ Core PPAP workflow system fully operational (Phase 3F–3K)
- ✅ Document Engine system fully operational (Phases 9–21)
- ✅ Systems integrated via `/ppap/[id]/documents` route
- ✅ Single unified document system enforced
- 🔲 Future enhancements planned (Phases 22–26+)
