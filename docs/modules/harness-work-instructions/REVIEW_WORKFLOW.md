# Harness Work Instruction Generator — Review Workflow

## Human-in-the-Loop Governance

**Core Principle:** NO AI output reaches production without explicit human approval.

---

## Workflow States

```
DRAFT
  ↓ (upload source)
EXTRACTING
  ↓ (AI completes)
REVIEW ←→ (edit/refine)
  ↓ (approve)
APPROVED
  ↓ (generate)
GENERATED
```

---

## State Transitions

### Draft → Extracting
- **Trigger:** User uploads source document
- **Action:** AI extraction job queued
- **User Action:** Wait for AI completion

### Extracting → Review
- **Trigger:** AI extraction completes
- **Action:** Extracted data presented for review
- **User Action:** Review all extracted fields

### Review → Review (iterative)
- **Trigger:** User edits extracted data
- **Action:** Changes saved as draft edits
- **User Action:** Continue refining

### Review → Approved
- **Trigger:** User clicks "Approve"
- **Action:** Lock extracted + edited data as `approvedData`
- **User Action:** None (irreversible)

### Approved → Generated
- **Trigger:** User clicks "Generate PDF"
- **Action:** Render PDF from `approvedData`
- **User Action:** Download PDF

---

## Review UI Requirements

### Must Display
- Original source document (side-by-side)
- All extracted fields (editable)
- Confidence scores (if available)
- Validation warnings

### Must Allow
- Inline editing of all fields
- Add/remove assembly steps
- Modify materials and tooling
- Add reviewer notes

### Must Prevent
- Approval without reviewing all fields
- PDF generation without approval
- Modification of approved data

---

## Approval Gates

1. **Pre-Approval Checklist**
   - [ ] All required fields populated
   - [ ] Part number validated
   - [ ] Assembly steps reviewed
   - [ ] Materials list verified

2. **Post-Approval Lock**
   - `approvedData` becomes immutable
   - Original `extractedData` preserved for audit
   - PDF generation enabled

---

## Audit Trail

- All review actions logged
- Timestamp + user for approval
- Diff between extracted and approved data
- PDF generation history

---

**Last Updated:** 2026-04-10  
**Status:** Scaffold
