# Harness Work Instruction Generator — AI Prompts

## Prompt Engineering Strategy

**Phase:** HWI.2 (Future Implementation)

---

## Extraction Prompt Template

```
You are a manufacturing engineer analyzing a wire harness assembly BOM.

Extract the following structured information:

1. **Master Part Number** — The top-level harness assembly part number
2. **Description** — Product description
3. **Assembly Steps** — Sequential build instructions including:
   - Step number
   - Instruction text
   - Wire specifications (gauge, color, length)
   - Terminal specifications (type, crimp tool)
   - Any notes or warnings

4. **Materials List** — All component part numbers with:
   - Part number
   - Description
   - Quantity
   - UOM (unit of measure)

5. **Tooling Requirements** — Required tools:
   - Tool name
   - Tool number (if specified)
   - Torque specs (if applicable)

Return results as valid JSON matching this schema:
[Schema definition here]

Source Document:
{sourceDocumentText}
```

---

## Response Format

```json
{
  "masterPartNumber": "12345-REV-A",
  "description": "Main Harness Assembly",
  "assemblySteps": [
    {
      "stepNumber": 1,
      "instruction": "Strip 0.25 inches of insulation from 18AWG RED wire",
      "wireSpec": {
        "gauge": "18AWG",
        "color": "RED",
        "lengthInches": 12.0
      },
      "terminalSpec": null,
      "notes": null
    }
  ],
  "materials": [
    {
      "partNumber": "WIRE-18-RED",
      "description": "18AWG Red Wire",
      "quantity": 12.0,
      "uom": "IN"
    }
  ],
  "tooling": [
    {
      "name": "Wire Stripper",
      "toolNumber": "TOOL-001",
      "torqueSpec": null
    }
  ]
}
```

---

## Validation Rules

- All part numbers must be alphanumeric
- Step numbers must be sequential
- Wire gauge must be valid AWG value
- Quantity must be positive number
- UOM must be standard (IN, FT, EA, etc.)

---

## Error Handling

If extraction fails or confidence is low:
- Return partial data with confidence scores
- Flag ambiguous fields for human review
- Provide extraction warnings

---

## Future Improvements

- Multi-page document support
- Drawing/diagram extraction
- Cross-reference validation
- Terminology standardization

---

**Last Updated:** 2026-04-10  
**Status:** Placeholder (No AI Implementation Yet)
