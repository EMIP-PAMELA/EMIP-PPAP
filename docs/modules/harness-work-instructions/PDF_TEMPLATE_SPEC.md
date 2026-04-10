# Harness Work Instruction Generator — PDF Template Specification

## Design Philosophy

**Deterministic Rendering:** Same approved data → Same PDF output (100% reproducible)

---

## Template Strategy

### React-PDF (Recommended)
- **Library:** `@react-pdf/renderer`
- **Advantages:**
  - Pure React components
  - Type-safe templates
  - Version control friendly
  - No browser dependencies
- **Output:** PDF binary stream

### Template Structure

```tsx
<Document>
  <Page>
    <HeaderSection job={approvedData} />
    <MaterialsTable materials={approvedData.materials} />
    <AssemblyStepsSection steps={approvedData.assemblySteps} />
    <ToolingSection tooling={approvedData.tooling} />
    <FooterSection />
  </Page>
</Document>
```

---

## Page Layout

### Header
- Company logo (left)
- Document title: "Harness Assembly Work Instruction"
- Part number + revision (right)
- Generation date

### Materials Table
| Part Number | Description | Qty | UOM |
|-------------|-------------|-----|-----|
| ...         | ...         | ... | ... |

### Assembly Steps
1. **Step 1:** [Instruction text]
   - Wire: [spec if applicable]
   - Terminal: [spec if applicable]
   - Notes: [if any]

2. **Step 2:** ...

### Tooling Section
- Required tools list
- Torque specs (if applicable)
- Quality checks

### Footer
- Page number
- Revision history
- Approval signature line

---

## Styling Rules

- **Font:** Arial or Helvetica (standard manufacturing)
- **Margins:** 0.5in all sides
- **Line Spacing:** 1.15
- **Table Borders:** 1px solid black
- **Colors:** Black + dark gray only (print-friendly)

---

## Data Binding

```typescript
interface TemplateProps {
  approvedData: ApprovedHarnessData;
  metadata: {
    generatedAt: Date;
    generatedBy: string;
    templateVersion: string;
  };
}
```

---

## Version Control

- Templates versioned as `v1.0.0`, `v1.1.0`, etc.
- Template version stored in PDF metadata
- Breaking changes require major version bump
- Template changes tracked in BUILD_LEDGER

---

## Future Enhancements

- Multi-page support for complex assemblies
- Embedded diagrams/images
- QR code for digital traceability
- Configurable company branding

---

**Last Updated:** 2026-04-10  
**Status:** Scaffold (No Implementation Yet)
