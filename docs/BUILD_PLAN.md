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
