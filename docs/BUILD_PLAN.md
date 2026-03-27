# EMIP-PPAP System Architecture & Build Plan

**Last Updated:** 2026-03-25 19:15 CT  
**Version:** 3F.15 - Implementation-Grade Source of Truth  
**Status:** Architectural Blueprint Locked

**Previous Version:** Archived to `BUILD_PLAN_ARCHIVE_20260325.md`

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

## Conclusion

This document is the **implementation-grade source of truth** for EMIP-PPAP.

**Future implementation MUST:**
- Bootstrap against this plan
- Follow governance rules
- Preserve core architecture
- Update this plan as system evolves

**This plan is a living document.**
As the system evolves, this plan MUST be updated to reflect current state and future direction.
