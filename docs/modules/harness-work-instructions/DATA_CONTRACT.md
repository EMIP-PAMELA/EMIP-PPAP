# Harness Work Instruction Generator — Data Contract

## Canonical Data Model

### Job Entity

```typescript
interface HarnessInstructionJob {
  id: string;
  partNumber: string;
  revision: string;
  status: 'draft' | 'extracting' | 'review' | 'approved' | 'generated';
  sourceDocumentUrl: string | null;
  extractedData: ExtractedHarnessData | null;
  approvedData: ApprovedHarnessData | null;
  createdAt: Date;
  approvedAt: Date | null;
  generatedPdfUrl: string | null;
}
```

### Extracted Data (AI Output)

```typescript
interface ExtractedHarnessData {
  masterPartNumber: string;
  description: string;
  assemblySteps: AssemblyStep[];
  materials: Material[];
  tooling: Tooling[];
  metadata: ExtractionMetadata;
}

interface AssemblyStep {
  stepNumber: number;
  instruction: string;
  wireSpec: WireSpec | null;
  terminalSpec: TerminalSpec | null;
  notes: string | null;
}
```

### Approved Data (Human-Reviewed)

```typescript
interface ApprovedHarnessData {
  masterPartNumber: string;
  description: string;
  assemblySteps: AssemblyStep[];
  materials: Material[];
  tooling: Tooling[];
  reviewNotes: string | null;
  approvedBy: string;
  approvedAt: Date;
}
```

### Review Decision

```typescript
interface ReviewDecision {
  jobId: string;
  action: 'approve' | 'reject' | 'request_changes';
  edits: Partial<ExtractedHarnessData> | null;
  reviewerNotes: string | null;
  timestamp: Date;
}
```

---

## Data Transformation Rules

1. **Extraction** — AI outputs `ExtractedHarnessData`
2. **Review** — Human edits produce `ApprovedHarnessData`
3. **Generation** — PDF renderer consumes `ApprovedHarnessData` only

---

## Validation Rules

- `partNumber` must match EMIP part number format
- `status` transitions: draft → extracting → review → approved → generated
- `approvedData` required before PDF generation
- `extractedData` immutable after creation (history preserved)

---

**Last Updated:** 2026-04-10  
**Status:** Scaffold
