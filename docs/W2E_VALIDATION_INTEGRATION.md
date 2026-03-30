# Phase W2E - Validation Integration Guide

## Overview

Phase W2E adds live validation and autofill feedback to the Document Wizard. The validation engine provides contextual warnings when users edit fields, helping them understand autofill recommendations without blocking their changes.

## Architecture

```
User Edit → DocumentEditor → useWizardValidation Hook → wizardValidationEngine → Console Logs + Warnings
```

## Files Created

### 1. `wizardValidationEngine.ts`
Core validation logic with deterministic rules.

**Key Functions:**
- `validateFieldChange(context)` - Main validation function
- `validateSeverity()` - Severity rating validation
- `validateMethod()` - Method field validation
- `validateFailureMode()` - Failure mode validation
- `validateEffect()` - Effect field validation
- `validateRow()` - Batch validation for table rows

**Validation Rules:**

| Field | Rule | Warning Example |
|-------|------|----------------|
| severity | Crimp operations < 6 | "Crimp operations typically require severity ≥ 6 due to electrical failure risk" |
| severity | Solder operations < 7 | "Solder operations typically require severity ≥ 7 due to safety/reliability risk" |
| severity | Test operations < 8 | "Test failures typically indicate complete loss of function. Recommended severity: 9" |
| severity | Deviation ≥ 3 from autofill | "Severity changed from recommended value of 7. Ensure justification is documented." |
| method | Crimp without "height" | "Crimp operations typically require crimp height measurement" |
| method | Generic "N/A" | "Method should specify an actual inspection/measurement technique" |
| failureMode | Vague terms | "Failure mode should be specific (e.g., 'Improper crimp' not just 'Defect')" |
| effect | Missing impact | "Effect should clearly state customer or system impact" |

### 2. `useWizardValidation.ts`
React hook for DocumentEditor integration.

**Usage:**
```typescript
const validation = useWizardValidation();

// On field change
const result = validation.validateField({
  fieldName: 'severity',
  userValue: 5,
  originalAutofill: 7,
  operationDescription: 'Crimp terminal to wire',
  operationCategory: 'crimping'
});

// Get warning for display
const warning = validation.getFieldWarning('severity');
```

## Integration with DocumentEditor

### Current Status (W2E)
- ✅ Validation engine created
- ✅ Validation hook created
- ✅ Console logging enabled
- ⏳ UI integration (future enhancement)

### Console Logging Output

When a user edits a field, console shows:
```
[W2E VALIDATION] Field changed: severity
[W2E VALIDATION] User value: 5
[W2E VALIDATION] Original autofill: 7
[W2E VALIDATION] Warning: Crimp operations typically require severity ≥ 6 due to electrical failure risk. Recommended: 7
[W2E VALIDATION] Severity: high
```

### Future UI Integration (Post-W2E)

**Recommended Approach:**

1. **Import validation hook in DocumentEditor:**
```typescript
import { useWizardValidation } from '../wizard/useWizardValidation';

const validation = useWizardValidation();
```

2. **Wrap onFieldChange callback:**
```typescript
const handleFieldChange = (fieldPath: string, value: any) => {
  // Call original handler
  onFieldChange(fieldPath, value);
  
  // Validate if wizard template
  if (draft.metadata?.templateType === 'wizard') {
    const result = validation.validateField({
      fieldName: fieldPath,
      userValue: value,
      originalAutofill: draft.metadata?.autofillValues?.[fieldPath],
      operationDescription: draft.metadata?.operationDescription,
      operationCategory: draft.metadata?.operationCategory
    });
  }
};
```

3. **Display warnings in UI:**
```tsx
{validation.getFieldWarning(fieldKey) && (
  <div className="mt-1 flex items-start gap-2 text-sm">
    <span className="text-yellow-600">⚠️</span>
    <span className="text-yellow-700">
      {validation.getFieldWarning(fieldKey)?.warning}
    </span>
  </div>
)}
```

## Validation Philosophy

### Non-Blocking
- All validations return `isValid: true` unless value is completely invalid (e.g., out of range)
- Warnings are **guidance**, not restrictions
- Users maintain full control to override suggestions

### Severity Levels

| Level | Meaning | Example |
|-------|---------|---------|
| **high** | Strong recommendation based on safety/quality | Crimp severity < 6 |
| **medium** | Important suggestion | Missing specific method |
| **low** | Minor improvement | Generic failure mode wording |

### Transparency
- All warnings include reasoning
- Console logs show validation logic
- Users understand **why** a warning appears

## Testing Validation

### Manual Test Cases

1. **Crimp Severity Warning:**
   - Operation: "Crimp terminal to wire"
   - Set severity = 4
   - Expected: High severity warning about electrical failure risk

2. **Method Validation:**
   - Operation: "Crimp terminal"
   - Set method = "Visual inspection"
   - Expected: Medium severity warning about crimp height measurement

3. **Failure Mode Specificity:**
   - Set failureMode = "Defect"
   - Expected: Low severity warning about being specific

4. **Valid Override:**
   - Operation: "Label wire"
   - Set severity = 3 (lower than autofill 4)
   - Expected: Low or no warning (labeling is lower risk)

## Non-Breaking Guarantee

✅ **Templates unchanged** - No modifications to template generation  
✅ **Autofill unchanged** - Validation uses autofill values but doesn't change them  
✅ **Parser unchanged** - No BOM parsing changes  
✅ **Optional integration** - DocumentEditor works with or without validation  
✅ **Console-first** - Validation works via console logs, UI is optional enhancement  

## Next Steps (Post-W2E)

1. Add validation state management to DocumentEditor
2. Implement warning UI components (⚠️ icons, tooltips)
3. Add validation summary panel
4. Enable/disable validation toggle
5. Export validation results with document metadata
