# EMIP-PPAP System Architecture & Build Plan

**Last Updated:** 2026-03-24 10:45 CT  
**Phase:** 23.16.0 - EMIP System Realignment  
**Status:** Operational Foundation + Architectural Evolution

**Previous Version:** Archived to `BUILD_PLAN_ARCHIVE_20260320.md`

---

## Program Statement

### EMIP-PPAP: Controlled PPAP Execution System

**EMIP-PPAP** is a **controlled execution system** for PPAP lifecycle orchestration, managing distributed engineering work across multiple customers, sites, and roles. It is the **first operational subsystem** of the Engineering Manufacturing Intelligence Platform (EMIP) architecture.

#### System Classification

**EMIP-PPAP is NOT a tracking tool.**

It is a **controlled execution system** with:

1. **State Machine:** Enforced workflow states that control available actions
2. **Validation Engine:** Requirement completion validation (not just document uploads)
3. **Acknowledgement Gate:** Hard control point separating pre-ack from post-ack work
4. **Template-Driven Workflow:** Customer-specific execution rules (Trane, Rheem)
5. **Role-Based Execution:** Permissions aligned with workflow states and ownership

#### System Definition

EMIP-PPAP transforms PPAP execution from **manual tracking** to **controlled enforcement**, providing:

- **State-driven workflow control** with enforced transitions
- **Validation engine** ensuring completion before progression
- **Hard acknowledgement gate** with pre-ack work locking
- **Template-driven execution** for customer-specific requirements (Trane, Rheem)
- **Role-based permissions** aligned with workflow states
- **Automated validation** preventing incomplete submissions
- **Full auditability** with event-sourced history
- **Integration readiness** for Reliance, SharePoint, and downstream EMIP modules

#### Core Principles

1. **Enforcement Over Tracking:** System controls workflow, not users
2. **Validation Over Manual Checking:** Automated completion validation
3. **Structured Over Ad-Hoc:** Template-driven execution rules
4. **State-Driven Over Status-Based:** Workflow states control UI and actions
5. **Integration-Ready:** API-first design for external system connectivity

---

## 5-Layer PPAP Lifecycle Architecture

### Architectural Overview

EMIP-PPAP implements a **5-layer workflow model** that structures PPAP execution from quote through customer approval:

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1: INTAKE & READINESS                            │
│  Purpose: Pre-PPAP validation and plant assignment      │
│  Owner: PPAP Coordinator                                │
│  State: Quote → Ready for PPAP                          │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  LAYER 2: PRE-ACKNOWLEDGEMENT EXECUTION                 │
│  Purpose: Engineering preparation and process design    │
│  Owner: Assigned Engineer                               │
│  State: Initiated → Ready for Acknowledgement           │
│  Phases: Initiation, Planning, Validation               │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  LAYER 3: ACKNOWLEDGEMENT GATE (CONTROL POINT)          │
│  Purpose: Formal acceptance of PPAP responsibility      │
│  Owner: Customer (external actor)                       │
│  Trigger: Customer submits acknowledgement event        │
│  Effect: Locks pre-ack work, enables post-ack execution │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  LAYER 4: POST-ACKNOWLEDGEMENT EXECUTION                │
│  Purpose: Production validation and data collection     │
│  Owner: Assigned Engineer                               │
│  State: Acknowledged → Ready for Submission             │
│  Phases: Execution, Documentation                       │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  LAYER 5: COMPLETION & SUBMISSION                       │
│  Purpose: Final review and customer delivery            │
│  Owner: PPAP Coordinator                                │
│  State: Ready for Submission → Submitted → Approved     │
└─────────────────────────────────────────────────────────┘
```

### Layer 1: Intake & Readiness

**Purpose:** Pre-PPAP validation ensuring quote readiness, tooling availability, BOM validation, and plant assignment before formal PPAP initiation.

**Owner:** PPAP Coordinator

**Key Activities:**
- Track quote-stage parts requiring PPAP
- Validate tooling status (ordered → received → validated)
- Validate BOM completeness
- Define sub-assembly structure
- Assign manufacturing plant
- Flag material/supply risks
- Promote to formal PPAP when ready

**State Transitions:** Quote → Tooling Ordered → Tooling Received → BOM Validated → Plant Assigned → Ready for PPAP

**Implementation Status:** 🔄 Design complete, implementation in Phase 3

---

### Layer 2: Pre-Acknowledgement Execution

**Purpose:** Engineering preparation phase where process design, FMEA, control plans, and initial documentation are completed **before** customer acknowledgement.

**Owner:** Assigned Engineer

**Workflow Phases:**
- **Initiation:** Part setup, drawing upload, initial planning
- **Planning:** Process flow, PFMEA, DFMEA development
- **Validation:** Control plan creation, measurement system planning

**Required Documents (Template-Dependent):**
- Process Flow Diagram
- PFMEA (Process Failure Mode Effects Analysis)
- DFMEA (Design Failure Mode Effects Analysis)
- Control Plan (preliminary)
- Measurement Plan
- Tooling drawings

**Completion Criteria:**
- All pre-ack documents uploaded per template
- All pre-ack tasks completed
- Engineer marks ready for acknowledgement

**Implementation Status:** ✅ Partial (basic workflow in place, template enforcement pending Phase 3)

---

### Layer 3: Acknowledgement Gate

**Purpose:** Formal customer acceptance of PPAP responsibility, triggering ownership transfer and locking pre-acknowledgement work.

**Owner:** Customer (external), facilitated by PPAP Coordinator

**Gate Logic:**
1. Customer submits acknowledgement (external action)
2. Coordinator logs acknowledgement event in system
3. System locks all pre-ack work (read-only)
4. System enables post-ack phases
5. Audit trail records ownership transfer

**Critical Rule:** No post-acknowledgement work can begin until gate is passed.

---

**CORRECTION APPLIED (Phase 23.16.1):**

This replaces prior ambiguous authority definition.

**ACKNOWLEDGEMENT AUTHORITY:**

**Authorized Roles:**
- **Coordinator role (PRIMARY)** - Jasmine and designated PPAP coordinators
- **Admin role (OVERRIDE ONLY)** - VP, leadership with system-wide authority

**Prohibited:**
- **Engineers are NOT permitted to acknowledge**
- **Viewer role cannot acknowledge**
- **Unassigned users cannot acknowledge**

**ENFORCEMENT RULES:**
- **Only authorized roles can trigger ACKNOWLEDGED state**
- **Acknowledgement permanently locks all pre-ack work**
- **Unauthorized attempts MUST be rejected with error**
- **Event MUST be logged with actor role validation**

**Implementation Logic:**
```typescript
function canAcknowledgePPAP(user: User, ppap: PPAP): boolean {
  // Only Coordinator or Admin roles can acknowledge
  if (user.role !== 'coordinator' && user.role !== 'admin') {
    return false;
  }
  
  // PPAP must be in READY_FOR_ACKNOWLEDGEMENT state
  if (ppap.state !== 'READY_FOR_ACKNOWLEDGEMENT') {
    return false;
  }
  
  return true;
}
```

**Mutation Guard:**
```typescript
async function acknowledgePPAP(ppapId: string, userId: string) {
  const user = await getUser(userId);
  const ppap = await getPPAP(ppapId);
  
  if (!canAcknowledgePPAP(user, ppap)) {
    throw new Error('Unauthorized: Only Coordinator or Admin can acknowledge PPAP');
  }
  
  // Proceed with acknowledgement
  await updatePPAPState(ppapId, 'ACKNOWLEDGED');
  await lockPreAckWork(ppapId);
  await logEvent({
    type: 'ACKNOWLEDGEMENT_RECEIVED',
    actor: userId,
    role: user.role,
    ppapId
  });
}
```

**Implementation Status:** 🔄 Design complete, implementation in Phase 3B

---

### Layer 4: Post-Acknowledgement Execution

**Purpose:** Production validation, dimensional inspection, capability studies, and final documentation collection after customer acknowledgement.

**Owner:** Assigned Engineer

**Workflow Phases:**
- **Execution:** Production run, dimensional inspection, capability studies
- **Documentation:** Final control plan, PSW completion, packaging approval

**Required Documents (Template-Dependent):**
- Dimensional Results (first article inspection)
- Material Certifications
- Performance Test Results
- MSA (Measurement System Analysis)
- Capability Studies (Ppk, Cpk)
- Production Part Submission Warrant (PSW)
- Appearance Approval Report (AAR)
- Packaging Approval
- Final Control Plan

**Completion Criteria:**
- All post-ack documents uploaded per template
- All post-ack tasks completed
- Engineer marks ready for submission

**Implementation Status:** ✅ Partial (workflow exists, template enforcement and gate locking pending Phase 3)

---

### Layer 5: Completion & Submission

**Purpose:** Final coordinator review, customer submission, and PPAP lifecycle closure.

**Owner:** PPAP Coordinator

**Workflow:**
1. Coordinator reviews completeness
2. Coordinator submits to customer
3. System tracks customer response
4. PPAP archived or reopened based on outcome

**States:**
- `Ready for Submission` (engineer complete)
- `Submitted` (coordinator action)
- `Approved` (customer acceptance)
- `Rejected` (customer rejection → reopen)

**Implementation Status:** ✅ Basic workflow in place, formal submission tracking pending enhancement

---

## State Machine (Workflow Control)

### Overview

**CRITICAL:** EMIP-PPAP uses a **state machine** to control workflow execution. States are **enforced by the system**, not user-managed.

States determine:
- Available UI actions
- Allowed mutations
- Visible phases
- Required validations
- Permission boundaries

### State Definitions

#### Pre-Acknowledgement States

**INITIATED**
- **Entry Condition:** PPAP created and assigned to engineer
- **Owner:** Assigned Engineer
- **Available Actions:**
  - Upload pre-ack documents
  - Complete pre-ack tasks
  - Mark requirements complete
  - Request coordinator assistance
- **Blocked Actions:**
  - Acknowledge PPAP
  - Upload post-ack documents
  - Submit to customer
- **Exit Condition:** All pre-ack validations complete
- **Next State:** IN_REVIEW

**IN_REVIEW**
- **Entry Condition:** Engineer marks pre-ack work complete
- **Owner:** PPAP Coordinator
- **Available Actions:**
  - Review pre-ack work
  - Request changes (returns to INITIATED)
  - Approve for acknowledgement
- **Blocked Actions:**
  - Edit pre-ack documents (engineer locked out)
  - Post-ack work
- **Exit Condition:** Coordinator approves
- **Next State:** READY_FOR_ACKNOWLEDGEMENT

**READY_FOR_ACKNOWLEDGEMENT**
- **Entry Condition:** Coordinator approves pre-ack work
- **Owner:** PPAP Coordinator (awaiting customer action)
- **Available Actions:**
  - View pre-ack work (read-only)
  - Log acknowledgement event (coordinator only)
- **Blocked Actions:**
  - Edit pre-ack work (locked)
  - Post-ack work (not yet acknowledged)
- **Exit Condition:** Customer acknowledges (logged by coordinator)
- **Next State:** ACKNOWLEDGED

---

#### Acknowledgement Gate

**ACKNOWLEDGED**
- **Entry Condition:** Customer acknowledgement logged
- **Owner:** Assigned Engineer + Production Plant
- **System Actions on Entry:**
  - Lock all pre-ack work (permanent read-only)
  - Enable post-ack phases
  - Snapshot pre-ack state for audit
  - Log ACKNOWLEDGEMENT_RECEIVED event
- **Available Actions:**
  - Upload post-ack documents
  - Complete post-ack tasks
  - Mark validations complete
- **Blocked Actions:**
  - Edit pre-ack work (permanently locked)
  - Submit to customer (not ready)
- **Exit Condition:** All post-ack validations complete
- **Next State:** IN_VALIDATION

---

#### Post-Acknowledgement States

**IN_VALIDATION**
- **Entry Condition:** Engineer marks post-ack work complete
- **Owner:** PPAP Coordinator
- **Available Actions:**
  - Review post-ack work
  - Request changes (returns to ACKNOWLEDGED)
  - Approve for submission
- **Blocked Actions:**
  - Edit post-ack documents (engineer locked out)
- **Exit Condition:** Coordinator approves
- **Next State:** READY_FOR_SUBMISSION

**READY_FOR_SUBMISSION**
- **Entry Condition:** Coordinator approves post-ack work
- **Owner:** PPAP Coordinator
- **Available Actions:**
  - Generate submission package
  - Submit to customer
- **Blocked Actions:**
  - Edit any work (locked for submission)
- **Exit Condition:** Coordinator submits
- **Next State:** SUBMITTED

---

#### Final States

**SUBMITTED**
- **Entry Condition:** Coordinator submits to customer
- **Owner:** PPAP Coordinator (awaiting customer response)
- **Available Actions:**
  - View submission package (read-only)
  - Log customer response
- **Blocked Actions:**
  - Edit any work
- **Exit Condition:** Customer responds
- **Next State:** ACCEPTED or REJECTED

**ACCEPTED**
- **Entry Condition:** Customer approves PPAP
- **Owner:** PPAP Coordinator
- **Available Actions:**
  - Archive PPAP
  - Generate reports
- **Blocked Actions:**
  - Edit any work
- **Exit Condition:** Coordinator archives
- **Next State:** COMPLETE

**REJECTED**
- **Entry Condition:** Customer rejects PPAP
- **Owner:** PPAP Coordinator
- **Available Actions:**
  - Review rejection reason
  - Log rejection details
  - Return PPAP to post-ack phase for rework
- **Blocked Actions:**
  - Archive PPAP
- **Exit Condition:** Coordinator returns PPAP to post-ack validation
- **Next State:** IN_VALIDATION (for rework)

**COMPLETE**
- **Entry Condition:** PPAP accepted and archived
- **Owner:** System
- **Available Actions:**
  - View (read-only)
  - Export reports
- **Blocked Actions:**
  - All mutations
- **Exit Condition:** None (terminal state)

---

**CORRECTION APPLIED (Phase 23.16.1):**

This replaces previous terminal rejection definition.

**CRITICAL CHANGES:**
- **REJECTED is NOT a terminal state**
- **REJECTED returns PPAP to IN_VALIDATION** (post-ack phase)
- **System MUST allow continued work after rejection**
- **Transition MUST be logged**

**Rejection Loop:**
```
SUBMITTED → REJECTED → IN_VALIDATION → READY_FOR_SUBMISSION → SUBMITTED
```

**Rules:**
- Customer rejection does not close PPAP
- Coordinator reviews rejection and returns to post-ack validation
- Engineer addresses rejection issues
- Resubmission follows normal post-ack completion flow
- Only ACCEPTED state leads to COMPLETE

---

### State Transition Rules

**Valid Transitions:**
```
INITIATED → IN_REVIEW → READY_FOR_ACKNOWLEDGEMENT → ACKNOWLEDGED → IN_VALIDATION → READY_FOR_SUBMISSION → SUBMITTED → ACCEPTED → COMPLETE

Rejection/Rework Paths:
IN_REVIEW → INITIATED (coordinator requests changes)
IN_VALIDATION → ACKNOWLEDGED (coordinator requests changes)
SUBMITTED → REJECTED → IN_VALIDATION (customer rejection - rework required)
```

**Invalid Transitions:**
- Cannot skip states (e.g., INITIATED → ACKNOWLEDGED)
- Cannot reverse through acknowledgement gate (ACKNOWLEDGED → READY_FOR_ACKNOWLEDGEMENT)
- Cannot transition to COMPLETE from REJECTED (must go through IN_VALIDATION → SUBMITTED → ACCEPTED)

**Enforcement:**
- UI hides unavailable actions based on current state
- Mutations validate state before execution
- State transitions logged as events
- Invalid transitions rejected with error

---

### State-Driven UI Behavior

**Example: Document Upload**
```typescript
if (ppap.state === 'INITIATED' || ppap.state === 'IN_REVIEW') {
  // Show pre-ack document upload
  <UploadButton category="pre-ack" />
} else if (ppap.state === 'ACKNOWLEDGED' || ppap.state === 'IN_VALIDATION') {
  // Show post-ack document upload
  <UploadButton category="post-ack" />
} else {
  // No upload allowed
  <DisabledButton tooltip="Upload not available in current state" />
}
```

**Example: Phase Visibility**
```typescript
const visiblePhases = phases.filter(phase => {
  if (phase.category === 'pre-ack') {
    return true; // Always show pre-ack phases
  } else if (phase.category === 'post-ack') {
    return ppap.state !== 'INITIATED' && ppap.state !== 'IN_REVIEW' && ppap.state !== 'READY_FOR_ACKNOWLEDGEMENT';
  }
  return false;
});
```

**Implementation Status:** 🔄 Design complete, implementation in Phase 2B/3B

---

## Role & Authority Model (State-Aligned)

### Overview

**CRITICAL:** EMIP-PPAP enforces role-based permissions that are **aligned with the state machine**. Permissions are determined by both **role AND state**, not role alone.

**Permission Formula:**
```
(role) + (state) → allowed / blocked
```

This ensures workflow integrity and prevents unauthorized state transitions.

---

### Roles

EMIP-PPAP defines **4 fixed roles**:

1. **Admin** - Supervisory / Override Role
2. **Coordinator** - Process Controller
3. **Engineer** - Work Executor
4. **Viewer** - Read-Only Oversight

---

### Role Definitions

#### Admin (Supervisory / Override Role)

**Responsibilities:**
- Full system visibility
- Can perform ALL coordinator actions
- Can assign and reassign work
- Can acknowledge PPAPs
- Can override workflow decisions
- Can reopen or redirect PPAPs

**Intent:**
Admin is **NOT the primary operator**. Admin is an **escalation and override authority** for exceptional situations.

**Authority Level:** Unlimited (within system constraints)

---

#### Coordinator (Process Controller)

**Responsibilities:**
- Owns PPAP intake (manual entry from external systems)
- Assigns engineers to PPAPs
- Sets production plant context
- Manages workflow progression
- Controls acknowledgement gate

**Critical Authority:**
**ONLY Coordinator and Admin can acknowledge PPAPs.**

This is a **hard gate** that separates pre-acknowledgement work from post-acknowledgement execution. Engineers cannot bypass this control.

**Intent:**
Coordinator is the **primary driver of workflow execution**. They control PPAP assignment, progression, and acknowledgement.

**Authority Level:** Workflow control + Assignment + Acknowledgement gate

---

#### Engineer (Work Executor)

**Responsibilities:**
- Performs pre-ack and post-ack work
- Uploads and edits documents
- Completes validation requirements
- Advances work within assigned phase
- Prepares PPAPs for submission

**Restrictions:**
- **Cannot assign work** (no assignment authority)
- **Cannot acknowledge PPAPs** (coordinator-only gate)
- **Cannot override workflow state** (state machine enforced)

**Intent:**
Engineer **executes work** but does not control workflow. They operate within the phases and states assigned to them by the coordinator.

**Authority Level:** Work execution only (no workflow control)

---

#### Viewer (Read-Only Oversight)

**Responsibilities:**
- Full visibility into all PPAPs
- Can view all documents and validation status
- Can view workflow history and events

**Restrictions:**
- **No edit permissions** (read-only)
- **No workflow control** (cannot transition states)
- **No document uploads** (cannot modify data)

**Intent:**
Used for **leadership visibility and reporting**. Provides oversight without operational control.

**Authority Level:** Read-only (no write permissions)

---

### Permission Model

**Permissions are determined by:**

```
(role) + (state) → allowed / blocked
```

**NOT role alone.**

This ensures that:
1. Roles cannot bypass state machine constraints
2. State transitions are only allowed when both role AND state permit
3. Workflow integrity is maintained

**Example:**
```typescript
// Engineer trying to submit PPAP
canSubmitPPAP(role: 'engineer', state: 'IN_PROGRESS') → FALSE (wrong state)
canSubmitPPAP(role: 'engineer', state: 'READY_FOR_SUBMISSION') → TRUE (correct state + role)
canSubmitPPAP(role: 'viewer', state: 'READY_FOR_SUBMISSION') → FALSE (wrong role)
```

---

### Critical Rules

#### 1. Acknowledgement Gate Control

**Transition:**
```
READY_FOR_ACKNOWLEDGEMENT → ACKNOWLEDGED
```

**Allowed Roles:**
- Coordinator
- Admin

**Explicitly Prohibited:**
- Engineer (cannot acknowledge)
- Viewer (read-only)

**Rationale:**
The acknowledgement gate is a **critical control point** that locks pre-ack work and enables post-ack execution. Only workflow controllers (Coordinator/Admin) can execute this transition.

---

#### 2. Assignment Authority

**Action:** Assign PPAP to Engineer

**Allowed Roles:**
- Coordinator
- Admin

**Prohibited:**
- Engineer (cannot assign to themselves or others)
- Viewer (read-only)

**Rationale:**
Assignment is a workflow control action. Engineers execute assigned work but do not control assignment.

---

#### 3. Workflow Control vs Execution

**Workflow Control (Coordinator/Admin):**
- Assign PPAPs
- Acknowledge PPAPs
- Override workflow decisions
- Manage workflow transitions

**Work Execution (Engineer):**
- Complete validation requirements
- Upload documents
- Mark requirements complete
- Prepare for submission

**Observation Only (Viewer):**
- View all PPAPs
- Monitor progress
- Generate reports

**Principle:** Separation of control and execution ensures accountability and prevents self-service workflow bypass.

---

#### 4. Admin vs Coordinator Distinction

**Admin:**
- Can perform **all coordinator actions**
- Acts as **override authority**
- Used for escalation and exceptional situations

**Coordinator:**
- **Primary workflow operator**
- Default assignment and acknowledgement authority
- Day-to-day workflow control

**CRITICAL:** System must not assume Admin is the primary operator. Coordinators are the default workflow controllers. Admins are for escalation only.

---

### Permission Implementation

**Permission Helpers:**

```typescript
// Edit permissions
canEditPPAP(role: UserRole): boolean {
  return role === 'admin' || role === 'engineer';
}

// Assignment permissions
canAssignPPAP(role: UserRole): boolean {
  return role === 'admin' || role === 'coordinator';
}

// Acknowledgement gate (role + state)
canAcknowledgePPAP(role: UserRole, state: string): boolean {
  if (state !== 'READY_FOR_ACKNOWLEDGEMENT') return false;
  return role === 'admin' || role === 'coordinator';
}

// Submission permissions (role + state)
canSubmitPPAP(role: UserRole, state: string): boolean {
  if (state !== 'READY_FOR_SUBMISSION') return false;
  return role === 'admin' || role === 'engineer';
}

// Read-only check
isReadOnly(role: UserRole): boolean {
  return role === 'viewer';
}
```

**Implementation Status:** ✅ Phase 2A complete (UI enforcement, no auth)

---

### Permission Matrix

| Action                  | Admin | Coordinator | Engineer | Viewer |
|------------------------|-------|-------------|----------|--------|
| View PPAPs             | ✓     | ✓           | ✓        | ✓      |
| Navigate to Details    | ✓     | ✓           | ✓        | ✗      |
| Create PPAP            | ✓     | ✓           | ✓        | ✗      |
| Edit PPAP              | ✓     | ✗           | ✓        | ✗      |
| Assign PPAP            | ✓     | ✓           | ✗        | ✗      |
| Acknowledge PPAP       | ✓     | ✓*          | ✗        | ✗      |
| Submit PPAP            | ✓     | ✗           | ✓*       | ✗      |

*Only when state allows (READY_FOR_ACKNOWLEDGEMENT / READY_FOR_SUBMISSION)

---

### Authentication Strategy

**Phase 2A (Current):**
- Mock user with changeable role
- No authentication system
- UI-level enforcement only
- Future-compatible with real auth

**Future Phases:**
- Integrate with existing auth system
- User-to-role mapping from database
- Backend permission enforcement
- API-level access control

**Design Principle:** Role model is defined now, authentication integration deferred to future phases.

---

## Validation Engine (Requirement Completion System)

### Overview

**CRITICAL:** EMIP-PPAP uses a **validation engine** to enforce completion requirements. The system validates **requirement completion**, not just document uploads.

**NOT:** "Documents uploaded"

**BUT:** "Required validations complete"

### Validation vs. Document Upload

**Document Upload:**
- User action: Upload file
- System action: Store file, log event
- Result: File exists in storage

**Validation Completion:**
- User action: Mark requirement complete
- System action: Validate completion criteria, update state
- Result: Requirement marked complete, contributes to phase completion

**Key Difference:** A document can be uploaded without completing the requirement. The engineer must explicitly validate that the requirement is satisfied.

---

### Validation Structure

#### Validation Definition

```typescript
interface Validation {
  id: string;
  template_id: string;
  name: string; // "Process Flow Diagram Complete"
  category: 'pre-ack' | 'post-ack';
  required: boolean;
  requires_approval: boolean; // NEW - some validations require approval
  validation_type: 'document' | 'task' | 'approval' | 'data';
  
  // Validation criteria
  criteria?: {
    min_documents?: number;
    required_approver?: string; // Role: coordinator, qa, admin
    data_fields?: string[];
  };
  
  // Completion tracking
  status: 'not_started' | 'in_progress' | 'complete' | 'approved';
  completed_by?: string; // Engineer who completed validation
  completed_at?: Date;
  approved_by?: string; // Coordinator/QA/Admin who approved (if required)
  approved_at?: Date;
  
  // Evidence
  evidence?: {
    document_ids?: string[];
    task_ids?: string[];
    notes?: string;
  };
}
```

---

**CORRECTION APPLIED (Phase 23.16.1):**

This replaces prior 'complete-only' validation model.

**VALIDATION STATUS MODEL:**
- `NOT_STARTED` - Validation not yet started
- `IN_PROGRESS` - Engineer working on validation
- `COMPLETE` - Engineer completed validation
- `APPROVED` - Coordinator/QA approved validation (if required)

**CRITICAL CHANGES:**
- **Each validation MUST include `completed_by` (engineer)**
- **Each validation MUST include `approved_by` (coordinator/QA/authorized role) if `requires_approval` is true**
- **Some validations REQUIRE approval before progression**
- **System MUST block transition if approval required but missing**
- **Validation must store evidence (document IDs, task IDs, notes)**
- **Completion AND approval must be logged as separate events**

**Approval Rules:**
- If `requires_approval: false` → Engineer completion moves status to `COMPLETE` (sufficient for phase transition)
- If `requires_approval: true` → Engineer completion moves status to `COMPLETE`, but coordinator approval required to move to `APPROVED`
- Phase transition blocked if any required validation is not in `COMPLETE` or `APPROVED` state (depending on `requires_approval`)
- Approval-required validations must reach `APPROVED` status before phase can transition

#### Validation Types

**1. Document Validation**
- **Criteria:** Specific document(s) uploaded and reviewed
- **Example:** "DFMEA Complete" requires DFMEA document uploaded and marked reviewed
- **Completion:** Engineer uploads document AND marks validation complete

**2. Task Validation**
- **Criteria:** Specific task(s) completed
- **Example:** "Tooling Inspection Complete" requires inspection task marked done
- **Completion:** Engineer completes task AND marks validation complete

**3. Approval Validation**
- **Criteria:** Specific person approves work
- **Example:** "Control Plan Approved" requires coordinator approval
- **Completion:** Approver marks validation complete

**4. Data Validation**
- **Criteria:** Required data fields populated
- **Example:** "Dimensional Results Entered" requires measurement data entry
- **Completion:** Engineer enters data AND marks validation complete

---

### Trane Template Validations

#### Pre-Acknowledgement Validations

**Process Design (Category: pre-ack)**
1. **Process Flow Diagram Complete** (required)
   - Type: document
   - Criteria: Process flow document uploaded and reviewed
   - Blocks: Transition to IN_REVIEW

2. **DFMEA Complete** (required)
   - Type: document
   - Criteria: DFMEA document uploaded and reviewed
   - Blocks: Transition to IN_REVIEW

3. **PFMEA Complete** (required)
   - Type: document
   - Criteria: PFMEA document uploaded and reviewed
   - Blocks: Transition to IN_REVIEW

4. **Control Plan Complete** (required)
   - Type: document
   - Criteria: Preliminary control plan uploaded and reviewed
   - Blocks: Transition to IN_REVIEW

5. **Measurement Plan Complete** (required)
   - Type: document
   - Criteria: Measurement plan uploaded and reviewed
   - Blocks: Transition to IN_REVIEW

6. **Tooling Drawings Complete** (optional)
   - Type: document
   - Criteria: Tooling drawings uploaded
   - Blocks: None (optional)

**Pre-Ack Completion Criteria:**
- All required validations marked complete
- Engineer marks phase complete
- System validates all requirements met
- If complete: Transition to IN_REVIEW
- If incomplete: Display missing requirements, block transition

---

#### Post-Acknowledgement Validations

**Production Validation (Category: post-ack)**
1. **Dimensional Results Complete** (required)
   - Type: data + document
   - Criteria: First article inspection data entered AND results document uploaded
   - Blocks: Transition to IN_VALIDATION

2. **Material Certifications Complete** (required)
   - Type: document
   - Criteria: Material certs uploaded for all materials
   - Blocks: Transition to IN_VALIDATION

3. **Performance Test Results Complete** (required)
   - Type: data + document
   - Criteria: Test data entered AND results document uploaded
   - Blocks: Transition to IN_VALIDATION

4. **MSA Complete** (required)
   - Type: document
   - Criteria: Measurement System Analysis uploaded and reviewed
   - Blocks: Transition to IN_VALIDATION

5. **Capability Studies Complete** (required)
   - Type: data + document
   - Criteria: Ppk/Cpk data entered AND study document uploaded
   - Blocks: Transition to IN_VALIDATION

6. **PSW Complete** (required)
   - Type: document
   - Criteria: Production Part Submission Warrant uploaded and signed
   - Blocks: Transition to IN_VALIDATION

7. **AAR Complete** (optional)
   - Type: document
   - Criteria: Appearance Approval Report uploaded
   - Blocks: None (optional)

8. **Packaging Approval Complete** (required)
   - Type: document
   - Criteria: Packaging approval document uploaded
   - Blocks: Transition to IN_VALIDATION

9. **Final Control Plan Complete** (required)
   - Type: document
   - Criteria: Final control plan uploaded and reviewed
   - Blocks: Transition to IN_VALIDATION

**Post-Ack Completion Criteria:**
- All required validations marked complete
- Engineer marks phase complete
- System validates all requirements met
- If complete: Transition to IN_VALIDATION
- If incomplete: Display missing requirements, block transition

---

### Validation Engine Behavior

#### Phase Completion Check

```typescript
function canCompletePhase(ppap: PPAP, phase: Phase): ValidationResult {
  const template = getTemplate(ppap.template_id);
  const requiredValidations = template.validations.filter(v => 
    v.category === phase.category && v.required
  );
  
  const incompleteValidations = requiredValidations.filter(v => 
    v.status !== 'complete'
  );
  
  if (incompleteValidations.length > 0) {
    return {
      canComplete: false,
      missingValidations: incompleteValidations,
      message: `Cannot complete phase. Missing ${incompleteValidations.length} required validations.`
    };
  }
  
  return {
    canComplete: true,
    missingValidations: [],
    message: 'All required validations complete.'
  };
}
```

#### State Transition Validation

```typescript
function canTransitionState(ppap: PPAP, targetState: State): ValidationResult {
  // Check state machine allows transition
  if (!isValidTransition(ppap.state, targetState)) {
    return { canTransition: false, reason: 'Invalid state transition' };
  }
  
  // Check validations if transitioning out of work phase
  if (targetState === 'IN_REVIEW') {
    return canCompletePhase(ppap, 'pre-ack');
  } else if (targetState === 'IN_VALIDATION') {
    return canCompletePhase(ppap, 'post-ack');
  }
  
  return { canTransition: true };
}
```

#### UI Validation Display

**Validation Checklist Component:**
```typescript
function ValidationChecklist({ ppap, phase }) {
  const validations = getValidationsForPhase(ppap, phase);
  
  return (
    <div className="validation-checklist">
      <h3>Required Validations</h3>
      {validations.map(validation => (
        <ValidationItem
          key={validation.id}
          validation={validation}
          canEdit={ppap.state === 'INITIATED' || ppap.state === 'ACKNOWLEDGED'}
          onComplete={handleValidationComplete}
        />
      ))}
      
      <CompletionStatus
        complete={validations.every(v => !v.required || v.status === 'complete')}
        missing={validations.filter(v => v.required && v.status !== 'complete')}
      />
    </div>
  );
}
```

**Validation Item Component:**
```typescript
function ValidationItem({ validation, canEdit, onComplete }) {
  return (
    <div className="validation-item">
      <StatusIcon status={validation.status} />
      <span className="validation-name">{validation.name}</span>
      {validation.required && <Badge color="red">Required</Badge>}
      
      {canEdit && validation.status !== 'complete' && (
        <button onClick={() => onComplete(validation.id)}>
          Mark Complete
        </button>
      )}
      
      {validation.status === 'complete' && (
        <CompletionInfo
          completedBy={validation.completed_by}
          completedAt={validation.completed_at}
        />
      )}
    </div>
  );
}
```

**Implementation Status:** 🔄 Design complete, implementation in Phase 3D

---

## PPAP Intake Architecture

**Status:** AUTHORITATIVE

### Overview

The system shall implement a normalized PPAP intake layer that governs how all PPAP records enter the system.

### Intake Sources

All PPAPs must originate from one of the following sources:

1. **Manual Entry** (current state)
   - Internal users create PPAP records directly in the system
   - Structured initiation forms guide data entry
   - Immediate validation and normalization

2. **Customer Portal** (future state)
   - External users initiate PPAP requests
   - Self-service intake with guided workflows
   - Auto-population where possible

3. **External System Integration** (future state)
   - Rheem ETQ Reliance
   - Trane Windchill
   - Other OEM PPAP systems
   - API-based or file-based ingestion

### Core Principle

**All incoming PPAP data must be normalized into the system's internal data model before being persisted.**

- **Internal schema (DTL_SNAPSHOT.md) is the single source of truth**
- **External systems must map INTO the internal model**
- **External schemas must NEVER dictate internal structure**

### Design Intent

This architecture ensures:

- **Consistent data structure** across all PPAPs regardless of source
- **Elimination of schema drift** from external system changes
- **Clean upgrade path to integration** without breaking existing functionality
- **Ability to support multiple customer systems** with different data models
- **System autonomy** - external systems initiate, internal system governs

### Normalization Layer

All intake sources flow through a normalization layer that:

1. **Validates** required fields and data types
2. **Maps** external field names to internal schema
3. **Enriches** data with system-generated metadata
4. **Logs** intake events for audit trail
5. **Persists** only normalized data to database

### Integration Philosophy

**Integration is an input mechanism, not a control mechanism.**

External systems may:
- ✅ Initiate PPAP requests
- ✅ Provide initial data
- ✅ Request status updates

External systems may NOT:
- ❌ Dictate internal workflow
- ❌ Override internal validation
---

### 2. Intake & Readiness System

**Status:** 🔄 Design complete, implementation in Phase 3A

**Purpose:** Track parts in pre-PPAP state (quote stage) through readiness validation before formal PPAP initiation.

**Ownership:** PPAP Coordinator

**Key Features:**
- Tooling validation tracking (ordered → received → validated)
- BOM validation
- Sub-assembly definition
- Plant assignment
- Risk assessment (material, supply, complexity)
- Promotion to formal PPAP

**Readiness States:**
```
Quote → Tooling Ordered → Tooling Received → BOM Validated → Plant Assigned → Ready for PPAP
```

**Data Tracking:**
- Quote number and customer
- Tooling status with dates
- BOM validation status
- Sub-assemblies
- Manufacturing plant
- Risk flags (material, supply, complexity)
- Promotion date to formal PPAP

---

### 3. Process Template System

**Status:** 🔄 Design complete, implementation in Phase 3C

**Purpose:** Control workflow behavior, task requirements, and document requirements based on customer-specific PPAP standards.

**Template Types:**

**Trane Template**
- Pre-Ack Documents: Process Flow, PFMEA, DFMEA, Control Plan, Measurement Plan
- Post-Ack Documents: Dimensional Results, MSA, Capability Studies, PSW, AAR, Packaging
- Phases: Initiation, Planning, Validation, Execution, Documentation

**Rheem Template**
- To be defined based on Rheem PPAP standards
- May use different phase names or sequences

**Template Assignment:**
- Auto-assigned based on customer selection
- Templates control all workflow behavior
- Defines required tasks, documents, and validation criteria

---

### 4. Acknowledgement Gate System

**Status:** 🔄 Design complete, implementation in Phase 3B

**Purpose:** Enforce formal customer acceptance of PPAP responsibility, separating preparation (pre-ack) from execution (post-ack).

**Gate Trigger:**
- External customer action logged by coordinator
- System validates pre-ack work complete
- Logs acknowledgement event
- Updates PPAP state
- Locks pre-ack work (read-only)
- Enables post-ack phases

**Critical Rule:** No post-acknowledgement work can begin until acknowledgement gate is passed.

**Pre-Ack Locking:**
- All pre-ack documents become read-only
- Pre-ack tasks cannot be modified
- Phase completion status frozen
- Audit trail preserved

---

### 5. Document Requirement Engine

**Status:** 🔄 Design complete, implementation in Phase 3D

**Purpose:** Track and validate document uploads against template-specific requirements, preventing incomplete PPAP submissions.

**Key Features:**
- Template-driven required document lists
- Pre-ack vs post-ack distinction
- Upload tracking with requirement linking
- Completion validation before phase transition
- Document checklist UI
- Ad-hoc upload support

**Enforcement:**
- Prevents phase completion without required documents
- Blocks submission if documents missing
- Visual checklist shows completion status

**Document Categories:**
- Design (DFMEA, tooling drawings)
- Process (PFMEA, control plan, process flow)
- Validation (MSA, measurement plan)
- Results (dimensional results, capability studies)
- Certification (PSW, material certs, packaging approval)

---

## Phased Development Roadmap

### Phase 1: Functional Stabilization (CURRENT)

**Timeline:** Weeks 1-2  
**Status:** 🔄 In Progress (Phase 23.15.5.x)

**Objective:** Stabilize core export and markup functionality for pilot readiness.

**Scope:**
- ✅ PDF rendering via PDF.js (complete)
- ✅ Annotation overlay system (complete)
- ✅ Export pipeline architecture (complete)
- 🔄 Color sanitization refinement (Phase 23.15.5.3 complete, monitoring)
- 🔄 Export reliability hardening
- 🔄 UI polish for markup tool

**Success Criteria:**
- Export completes reliably for PDFs and images
- Annotations render accurately
- No html2canvas crashes
- No data loss during export

---

### Phase 2: Operational Pilot Readiness (NEXT)

**Timeline:** Weeks 2-5  
**Status:** ⏳ Pending

**Objective:** Implement permissions system and scale UI for multi-PPAP management.

**Phase 2A: Permissions System (PRIMARY NEXT STEP)**
- Role-based access control implementation
- UI-level restrictions based on user role
- Mutation guards for protected operations
- Assignment model (coordinator assigns engineer)
- Reassignment capability
- Dashboard filtering by ownership

**Phase 2B: Dashboard Scaling**
- Table view for PPAP list (replace card grid)
- Sortable columns (part number, customer, status, owner)
- Filterable by status, owner, customer
- Search by part number
- Pagination for high volume

**Phase 2C: Navigation Fixes**
- Fix back navigation from PPAP detail
- Breadcrumb navigation
- Preserve filter state

**Success Criteria:**
- Coordinators can assign PPAPs to engineers
- Engineers see only their assigned PPAPs (optional filter)
- Dashboard handles 50+ PPAPs efficiently
- Navigation is intuitive

---

### Phase 3: Structured Workflow Execution

**Timeline:** Weeks 6-10  
**Status:** ⏳ Planned

**Objective:** Implement intake system, acknowledgement gate, and template-driven execution.

**Phase 3A: Intake & Readiness System**
- Pre-PPAP intake tracking (quote → ready for PPAP)
- Tooling validation tracking
- BOM validation
- Plant assignment
- Material risk flagging
- Transition to formal PPAP

**Phase 3B: Acknowledgement Gate**
- Pre-ack vs post-ack phase separation
- Acknowledgement event logging
- Pre-ack work locking after acknowledgement
- Post-ack phase enabling

**Phase 3C: Template-Driven Execution**
- Template selection (Trane, Rheem)
- Template-specific task requirements
- Template-specific document requirements
- Completion validation against template

**Phase 3D: Document Requirement Tracking**
- Required document checklist per template
- Upload tracking and validation
- Pre-ack vs post-ack document distinction
- Completion gates based on document status

**Success Criteria:**
- Intake system tracks pre-PPAP parts
- Templates control workflow behavior
- Acknowledgement gate enforces pre/post separation
- Document requirements prevent incomplete submissions

---

### Phase 4: Production Maturity

**Timeline:** Weeks 11-14  
**Status:** ⏳ Planned

**Objective:** Harden system for high-volume production use.

**Scope:**
- Performance optimization (database queries, rendering)
- Audit log completeness
- Error handling and recovery
- Concurrent user support
- Notification system (assignments, status changes)
- Export queue for bulk operations
- Archive and search functionality

**Success Criteria:**
- System handles 200+ active PPAPs
- Sub-second dashboard load times
- Full audit trail for compliance
- Reliable concurrent editing

---

### Phase 5: Integration Readiness

**Timeline:** Weeks 15-20  
**Status:** ⏳ Planned

**Objective:** Enable integration with external systems and prepare for EMIP expansion.

**Scope:**
- Reliance ERP integration (part data, BOM sync)
- SharePoint integration (document storage, collaboration)
- API layer for external system access
- Webhook support for event notifications
- Export to customer portals (if applicable)
- Foundation for next EMIP modules

**Success Criteria:**
- Parts auto-import from Reliance
- Documents sync to SharePoint
- External systems can query PPAP status
- Integration reduces manual data entry

---

## Active Workstreams

### 1. Platform Stability
**Owner:** Development team  
**Focus:** Export pipeline, markup tool, core rendering  
**Current Phase:** 23.15.5.x (color sanitization)  
**Next:** Export reliability hardening, production validation

### 2. State Machine Implementation (NEW - CRITICAL)
**Owner:** Development + Product  
**Focus:** Enforced workflow states, state-driven UI, transition validation  
**Current Phase:** Design complete (Phase 23.16.0)  
**Next:** State machine implementation (Phase 2B/3B)  
**Priority:** HIGH - Foundation for controlled execution system

### 3. Validation Engine (NEW - CRITICAL)
**Owner:** Development + Quality  
**Focus:** Requirement completion validation, automated checking, blocking logic  
**Current Phase:** Design complete (Phase 23.16.0)  
**Next:** Validation engine foundation (Phase 3D)  
**Priority:** HIGH - Prevents incomplete submissions

### 4. Operational UX (TABLE DASHBOARD REQUIRED)
**Owner:** Development + UX  
**Focus:** Table-based PPAP list, sortable columns, filtering, search  
**Current Phase:** Planning  
**Next:** Table view implementation (Phase 2B) - **HIGH PRIORITY**  
**Note:** Current card grid does not scale for production use

### 5. Workflow Definition
**Owner:** Product + Stakeholders  
**Focus:** Template requirements, validation definitions, gate criteria  
**Current Phase:** Architecture design (Phase 23.16.0)  
**Next:** Trane template specification with validations

### 6. Permissions & Access Control (PRIORITY)
**Owner:** Development  
**Focus:** Role-based access, assignment model, state-aligned permissions  
**Current Phase:** Design complete (Phase 23.16.0)  
**Next:** Implementation (Phase 2A)  
**Note:** Permissions must align with state machine

### 7. Document Orchestration
**Owner:** Development + Quality  
**Focus:** Document upload tracking, requirement linking  
**Current Phase:** Design  
**Next:** Document management enhancement (Phase 3D)  
**Note:** Supports validation engine

### 8. Governance & Auditability
**Owner:** Development + Compliance  
**Focus:** Event logging, audit trails, state change tracking  
**Current Phase:** Foundation in place (ppap_events table)  
**Next:** State transition event logging, audit log UI

### 9. Intake & Readiness Modeling
**Owner:** Product + Operations  
**Focus:** Pre-PPAP tracking, tooling validation, Reliance integration  
**Current Phase:** Design (Phase 23.16.0)  
**Next:** Stakeholder validation, schema design (Phase 3A)

### 10. Template & Workflow Engine
**Owner:** Development + Product  
**Focus:** Template-driven validation rules, customer-specific execution  
**Current Phase:** Design (Phase 23.16.0)  
**Next:** Template schema, Trane template definition (Phase 3C)

### 11. Integration Readiness
**Owner:** Development + IT  
**Focus:** Reliance integration, API design, external system connections  
**Current Phase:** Planning  
**Next:** Integration architecture (Phase 5)

---

## Immediate Priorities

### Priority 1: Export Pipeline Stabilization (ONGOING)
**Status:** Phase 23.15.5.3 complete, monitoring for additional failures  
**Timeline:** Week 1

**Next Actions:**
- Runtime testing of sanitization coverage
- Pseudo-element sanitization if needed
- State update race condition guards (disable controls during export)
- Production validation

**Rationale:** Core functionality must be stable before expanding features

---

### Priority 2: Table Dashboard Implementation (HIGH PRIORITY)
**Status:** Planning  
**Timeline:** Week 2

**Next Actions:**
- Replace card grid with table-based PPAP list
- Implement sortable columns (part number, customer, status, owner, date)
- Add filtering (status, owner, customer)
- Add search (part number, customer name)
- Implement pagination for high volume

**Rationale:** Current card grid does NOT scale for production use. System must handle 50+ PPAPs efficiently. Table view is critical for operational readiness.

**Dependencies:**
- None (can implement immediately after export stabilization)

---

### Priority 3: Permissions System Implementation (NEXT BUILD PHASE)
**Status:** Design complete  
**Timeline:** Weeks 2-3

**Next Actions:**
- Schema extension for user roles and assignments
- UI-level permission checks (state-aligned)
- Mutation guards for protected operations
- Assignment workflow implementation
- State-based permission enforcement

**Rationale:** Enables coordinator-to-engineer assignment model, prevents unauthorized actions

**Dependencies:**
- User authentication system (already in place via Supabase)
- Role management UI
- Assignment tracking schema
- State machine definition (complete)

---

### Priority 4: State Machine Foundation
**Status:** Design complete (Phase 23.16.0)  
**Timeline:** Weeks 3-4

**Next Actions:**
- Implement state field and transitions in schema
- Build state transition validation logic
- Implement state-driven UI controls
- Add state change event logging
- Test state machine enforcement

**Rationale:** Foundation for controlled execution system. Enables workflow enforcement over tracking.

**Dependencies:**
- Permissions system (Phase 2A)
- State definitions (complete)

---

### Priority 5: Validation Engine Foundation
**Status:** Design complete (Phase 23.16.0)  
**Timeline:** Weeks 4-5

**Next Actions:**
- Implement validation tracking schema
- Build validation completion logic
- Implement phase completion checks
- Add validation checklist UI
- Integrate with state machine transitions

**Rationale:** Prevents incomplete PPAP submissions. Automates requirement checking.

**Dependencies:**
- State machine (Priority 4)
- Template system design
- Trane validation definitions (complete)

---

### Priority 6: Workflow Alignment with Stakeholders
**Status:** Architecture defined (Phase 23.16.0)  
**Timeline:** Week 2-3 (parallel with development)

**Next Actions:**
- Present 5-layer model to Jasmine (coordinator)
- Validate Trane template validations with engineering team
- Define acknowledgement gate process with customer stakeholders
- Map pre-ack vs post-ack validation requirements
- Review state machine workflow with operations

**Rationale:** Ensure system design matches real-world PPAP workflow

---

### Priority 7: Preparation for Pilot Use
**Status:** Planning  
**Timeline:** Week 6

**Next Actions:**
- Define pilot scope (customers, parts, users)
- Create user training materials (coordinator, engineer roles)
- Setup error monitoring and alerting
- Define support process and escalation
- Plan phased rollout

**Rationale:** Ensure smooth transition to production use

---

## Current System State

### Working Features (Production Ready)

✅ **Core PPAP Management:**
- PPAP record creation and tracking
- PPAP list view
- PPAP detail/dashboard page
- Event audit trail

✅ **Document Management:**
- Document metadata tracking
- File upload to Supabase Storage
- Download links
- Category badges

✅ **Drawing Markup & Export:**
- PDF rendering to PNG via PDF.js
- Annotation overlay system (5 marker types)
- Drag-and-drop annotation placement
- Annotation editing and descriptions
- Export to PDF with drawing + annotation sheet
- Color sanitization for html2canvas compatibility

✅ **Conversation Log:**
- Internal notes and communication
- Message types (NOTE, QUESTION, BLOCKER)
- Author and site tracking

✅ **Basic Workflow:**
- Phase-based workflow (manual transitions)
- Status tracking
- Task tracking

### In Development

🔄 **Export Stability:**
- Phase 23.15.5.x refinements
- Production validation

### Planned (Not Yet Implemented)

⏳ **Permissions System** (Phase 2A - NEXT)
⏳ **Dashboard Scaling** (Phase 2B)
⏳ **Intake & Readiness** (Phase 3A)
⏳ **Acknowledgement Gate** (Phase 3B)
⏳ **Template System** (Phase 3C)
⏳ **Document Requirements** (Phase 3D)
⏳ **External Integrations** (Phase 5)

---

## Status Values (Current Implementation)

| Status | Meaning |
| `NEW` | PPAP request created, intake pending |
| `INTAKE_COMPLETE` | All initial data entered |
| `PRE_ACK_ASSIGNED` | Engineering tasks assigned |
| `PRE_ACK_IN_PROGRESS` | Engineering work underway |
| `READY_TO_ACKNOWLEDGE` | Pre-ack complete, ready for ack |
| `ACKNOWLEDGED` | Officially acknowledged with customer |
| `POST_ACK_ASSIGNED` | Build/validation tasks assigned |
| `POST_ACK_IN_PROGRESS` | Build/validation underway |
| `AWAITING_SUBMISSION` | Package ready, pending submission |
| `SUBMITTED` | Submitted to customer |
| `APPROVED` | Customer approved |
| `ON_HOLD` | Temporarily paused |
| `BLOCKED` | Blocked by external dependency |
| `CLOSED` | Complete and archived |

---

## DTL Dependency Rule

**CRITICAL: No feature may be implemented without verified DTL fields.**

Before implementing any feature:
1. ✅ Identify required database fields
2. ✅ Check `docs/DTL_SNAPSHOT.md` for field existence
3. ✅ Verify field names, types, and constraints
4. ✅ Use ONLY fields listed in DTL
5. ✅ If field missing, STOP and update DTL first

**DTL_SNAPSHOT.md is authoritative.** Code must align to DTL, never assume fields exist.

---

## Execution Rules for Repo Agent

### Mandatory Preflight Checklist

Before starting any work:
1. ✅ Read `BOOTSTRAP.md`
2. ✅ Read `AGENT_RULES.md`
3. ✅ Read `docs/BUILD_PLAN.md` (this file)
4. ✅ Read `docs/DTL_SNAPSHOT.md`
5. ✅ Read `docs/MILEMARKER.md`
6. ✅ Identify current phase
7. ✅ Verify DTL fields needed
8. ✅ State objective, constraints, validation plan

### Phase Execution Rules

1. **Do NOT skip phases** - Complete phases sequentially
2. **Do NOT assume fields** - Verify every field in DTL_SNAPSHOT.md
3. **Do NOT modify schema** - Work with existing verified schema only
4. **Do NOT expand scope** - Stay within current phase boundaries
5. **Do update documentation** - BUILD_LEDGER and MILEMARKER after each milestone

### Definition of Done (per phase)

A phase is complete when:
- ✅ All features work against live Supabase data
- ✅ All inputs validated
- ✅ Loading, empty, and error states implemented
- ✅ Event logging added where applicable
- ✅ DTL_SNAPSHOT.md verified (no mismatches)
- ✅ BUILD_LEDGER.md updated
- ✅ MILEMARKER.md updated
- ✅ Code committed with clear message
- ✅ Manual validation completed

---

## Integration Readiness Strategy

**Status:** FUTURE PHASES

### Overview

The system is designed to support future integration with external PPAP systems such as:

- **Rheem ETQ Reliance**
- **Trane Windchill**
- **Other OEM PPAP systems**

### Integration Modes (Planned)

1. **Manual Entry** (current baseline)
   - Internal users create PPAPs directly in the system
   - Full control over data entry and validation
   - Immediate normalization and persistence

2. **Structured Import** (CSV / JSON upload)
   - Bulk PPAP creation from formatted files
   - Pre-validation before import
   - Batch normalization and event logging

3. **API-Based Intake** (future)
   - Real-time PPAP creation via REST/GraphQL API
   - External system authentication and authorization
   - Webhook notifications for status updates

### Core Rules

All imported data must adhere to the following principles:

1. **Validation First**
   - All imported data must be validated against internal schema
   - Invalid data rejected with clear error messages
   - No partial imports (all-or-nothing transactions)

2. **Normalization Required**
   - External field names mapped to internal schema
   - Data types converted to internal formats
   - Enrichment with system-generated metadata

3. **External Identifiers Preserved but Not Authoritative**
   - External PPAP IDs, Project Numbers stored for reference
   - Internal UUIDs remain primary keys
   - External IDs used for correlation only

4. **Internal Workflow Always Governs**
   - External systems cannot bypass validation
   - Internal status workflow remains authoritative
   - External systems receive status updates, not control workflow

### Architectural Principle

**Integration is an input mechanism, not a control mechanism.**

**External systems initiate requests —  
The internal system executes, validates, and governs the PPAP lifecycle.**

This ensures:
- **System autonomy** - external changes do not break internal workflow
- **Data consistency** - all PPAPs follow same validation rules
- **Audit trail integrity** - all changes logged through internal event system
- **Flexibility** - can integrate with multiple external systems without conflicts

---

## Development Governance

### Schema Changes
1. No schema changes without explicit approval
2. All schema changes must update DTL_SNAPSHOT.md first
3. Record every schema change in BUILD_LEDGER.md
4. Commit schema + code changes atomically

### Code Quality
1. TypeScript strict mode
2. Prefer small focused components
3. Separate data access from presentation
4. Loading, empty, error states required
5. No unsafe type assertions

### Commit Discipline
1. Commit at meaningful milestones
2. Clear commit messages (feat/fix/chore/docs)
3. Update BUILD_LEDGER.md with every significant change
4. Update MILEMARKER.md after phase completion

### Phase Execution
1. **Do NOT skip phases** - Complete phases sequentially
2. **Do NOT assume fields** - Verify every field in DTL_SNAPSHOT.md
3. **Do NOT modify schema** - Work with existing verified schema only
4. **Do NOT expand scope** - Stay within current phase boundaries
5. **Do update documentation** - BUILD_LEDGER and MILEMARKER after each milestone

---

## Technical Stack

**Frontend:**
- Next.js 16 (App Router, Turbopack)
- React 19
- TypeScript (strict mode)
- TailwindCSS

**Backend:**
- Supabase (PostgreSQL, Storage, Auth)
- Row-Level Security (RLS)

**Specialized Libraries:**
- PDF.js (PDF rendering)
- html2canvas (DOM to canvas export)
- jsPDF (PDF generation)

**Deployment:**
- Vercel (main branch auto-deploy)
- Environment variables via Vercel

---

## Repository Structure

```
app/                          # Next.js App Router pages
├── page.tsx                  # Dashboard home
├── ppap/
│   ├── page.tsx             # PPAP list
│   ├── new/                 # PPAP creation
│   └── [id]/                # PPAP detail

src/
├── lib/
│   ├── supabaseClient.ts    # Supabase client
│   └── utils.ts             # Utilities
├── types/
│   └── database.types.ts    # TypeScript interfaces
├── features/
│   ├── ppap/                # PPAP feature module
│   ├── conversations/       # Conversation module
│   ├── tasks/               # Task module
│   ├── documents/           # Document module
│   └── events/              # Event logging module
├── utils/
│   ├── renderPdfToImage.ts  # PDF.js utility
│   └── sanitizeColorsForExport.ts # html2canvas prep

docs/
├── BOOTSTRAP.md             # Start here
├── BUILD_PLAN.md            # This file (architecture & roadmap)
├── BUILD_LEDGER.md          # Phase history & change log
├── DTL_SNAPSHOT.md          # Database schema contract
├── MILEMARKER.md            # Current system state
└── BUILD_PLAN_ARCHIVE_20260320.md # Previous version
```

---

## Summary

**Phase 23.16.0** redefines EMIP-PPAP from a basic tracking tool to a **controlled execution system** with state-driven workflow enforcement and automated validation checking.

### System Classification

**EMIP-PPAP is NOT a tracking tool.**

It is a **controlled execution system** with five foundational components:

1. **State Machine** - Enforced workflow states (INITIATED → IN_REVIEW → ACKNOWLEDGED → IN_VALIDATION → SUBMITTED → COMPLETE)
2. **Validation Engine** - Automated requirement completion validation (not just document uploads)
3. **Acknowledgement Gate** - Hard control point with pre-ack work locking
4. **Template-Driven Workflow** - Customer-specific execution rules (Trane, Rheem)
5. **Role-Based Execution** - Permissions aligned with workflow states

### Core Principles

1. **Enforcement Over Tracking:** System controls workflow, not users
2. **Validation Over Manual Checking:** Automated completion validation
3. **Structured Over Ad-Hoc:** Template-driven execution rules
4. **State-Driven Over Status-Based:** Workflow states control UI and actions
5. **Integration-Ready:** API-first design for external system connectivity

### Key Transformations

**From:** Manual status tracking  
**To:** State machine workflow enforcement

**From:** Document uploads  
**To:** Validation engine requirement completion

**From:** User-managed workflow  
**To:** System-controlled state transitions

**From:** Open access  
**To:** State-aligned role-based permissions (Phase 2A)

**From:** Generic workflow  
**To:** Template-driven validation rules (Phase 3C)

**From:** Informal acknowledgement  
**To:** Hard acknowledgement gate with work locking (Phase 3B)

**From:** Ad-hoc document checking  
**To:** Automated validation engine (Phase 3D)

**From:** Quote-stage blind spot  
**To:** Intake & readiness tracking (Phase 3A)

**From:** Card grid dashboard  
**To:** Table-based scalable dashboard (Phase 2B - HIGH PRIORITY)

### Implementation Priorities

**Immediate (Weeks 1-2):**
1. Export pipeline stabilization (ongoing)
2. Table dashboard implementation (HIGH PRIORITY - scalability requirement)

**Near-Term (Weeks 2-4):**
3. Permissions system (state-aligned RBAC)
4. State machine foundation
5. Workflow alignment with stakeholders

**Mid-Term (Weeks 4-6):**
6. Validation engine foundation
7. Preparation for pilot use

### Next Build Phases

**Phase 2B: Table Dashboard** (Week 2)
- Replace card grid with table-based PPAP list
- Sortable columns, filtering, search, pagination
- Critical for production scalability (50+ PPAPs)

**Phase 2A: Permissions System** (Weeks 2-3)
- Role-based access control (Admin, Coordinator, Engineer, Viewer)
- Assignment model (Coordinator assigns PPAPs to Engineers)
- State-aligned permission enforcement
- UI restrictions, mutation guards, RLS policies

**Phase 3B: State Machine** (Weeks 3-4)
- State field and transition validation
- State-driven UI controls
- State change event logging
- Workflow enforcement implementation

**Phase 3D: Validation Engine** (Weeks 4-5)
- Validation tracking schema
- Completion logic and phase checks
- Validation checklist UI
- Integration with state transitions

### Long-Term Vision

EMIP-PPAP serves as the **architectural foundation** for:
- **Controlled execution** across distributed engineering work
- **Multi-customer PPAP orchestration** (Trane, Rheem, future customers)
- **Template-driven workflow** for customer-specific requirements
- **State-driven enforcement** preventing incomplete submissions
- **Integration with external systems** (Reliance, Windchill, SharePoint)
- **Expansion to other EMIP modules** (tooling, quality, production)

### Governance Compliance

✅ **Design-Only Phase:**
- No code changes
- No schema changes
- No feature implementation
- No refactoring
- Preserved export/markup architecture

✅ **Architecture Complete:**
- State machine defined (10 states, transition rules)
- Validation engine designed (Trane template validations)
- 5-layer lifecycle model
- 11 active workstreams
- 7 immediate priorities
- Phased roadmap (5 phases, 20 weeks)

---

**Document Status:** Controlled execution system architecture complete  
**System Model:** State machine + validation engine + acknowledgement gate + templates + RBAC  
**Next Action:** Table dashboard (Week 2), then Permissions System (Phase 2A)  
**Commit:** `docs: phase 23.16.0 controlled execution system architecture`
