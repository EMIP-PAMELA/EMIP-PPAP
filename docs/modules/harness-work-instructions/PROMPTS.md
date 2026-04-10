# Harness Work Instruction Generator — AI Prompts

## Prompt Engineering Strategy

**Phase:** HWI.2 (Implemented)  
**Model:** claude-sonnet-4-20250514  
**Temperature:** 0 (deterministic)  
**Max Tokens:** 8192

---

## System Prompt

```
You are a deterministic wire harness data extraction microservice.
Output ONLY valid JSON with no markdown, no code fences, no commentary.
The JSON must conform exactly to the schema provided in the user message.
```

---

## Extraction User Prompt Template

Source: `src/features/harness-work-instructions/services/instructionAI.ts` → `buildExtractionPrompt()`

```
You are a wire harness manufacturing data extraction service.
Extract structured data from the provided BOM and drawing notes.
Your output MUST be a single valid JSON object — no markdown, no prose, no explanation.

OUTPUT SCHEMA (follow exactly):
{
  "id": "<use the provided job ID>",
  "status": "review",
  "metadata": {
    "part_number": "<string>",
    "revision": "<string>",
    "description": "<string or null>",
    "source_document_url": null,
    "created_at": "<ISO8601 datetime string>",
    "approved_at": null,
    "generated_pdf_url": null
  },
  "wire_instances": [
    {
      "wire_id": "<unique string, e.g. W001>",
      "aci_wire_part_number": "<string>",
      "gauge": "<string or number, e.g. '18' or 18>",
      "color": "<string>",
      "cut_length": <positive number, inches>,
      "strip_end_a": <number or null>,
      "strip_end_b": <number or null>,
      "end_a": {
        "connector_id": "<string or null>",
        "cavity": "<string or null>",
        "terminal_part_number": "<string or null>",
        "seal_part_number": "<string or null>"
      },
      "end_b": {
        "connector_id": "<string or null>",
        "cavity": "<string or null>",
        "terminal_part_number": "<string or null>",
        "seal_part_number": "<string or null>"
      },
      "provenance": {
        "source_type": "<'drawing'|'bom'|'derived'|'manual'>",
        "source_ref": "<string or omit>",
        "confidence": <0.0-1.0>,
        "note": "<string or omit>"
      }
    }
  ],
  "press_rows": [...],
  "komax_rows": [...],
  "pin_map_rows": [...],
  "assembly_steps": [...],
  "engineering_flags": [...],
  "review_questions": [...]
}

RULES:
- Set "answer" to null and "resolved" to false for all review_questions.
- Set "resolved" to false for all engineering_flags.
- Use "review_required" flag_type when data is uncertain or incomplete.
- Output empty arrays [] for sections with no data — do NOT omit them.
- All provenance objects must include source_type and confidence (0.0-1.0).
- If you cannot determine a required value, set it to null where nullable,
  or add a review_required engineering_flag.
- Do NOT include any fields not in the schema above.

JOB ID: {jobId}
PART NUMBER: {partNumber}
REVISION: {revision}

BOM DATA:
{rawBomText}

DRAWING NOTES:
{drawingNotes}
```

---

## Schema Field Rules

### Provenance (required on all major entities)
| Field | Type | Required |
|-------|------|----------|
| `source_type` | `'drawing' \| 'bom' \| 'derived' \| 'manual'` | ✅ |
| `source_ref` | string | optional |
| `confidence` | number 0–1 | ✅ |
| `note` | string | optional |

### Engineering Flags (uncertainty surface)
| flag_type | When to use |
|-----------|-------------|
| `review_required` | Uncertain value, needs human verification |
| `warning` | Possible issue but not blocking |
| `error` | Clear data problem |
| `info` | Informational only |

---

## Pipeline

```
ExtractionInput (jobId, partNumber, revision, rawBomText, drawingNotes)
    ↓
buildExtractionPrompt()
    ↓
Anthropic API (claude-sonnet, temp=0, max_tokens=8192)
    ↓
Safe JSON.parse (jsonMatch regex, try/catch)
    ↓
{ rawData, preFlags }
    ↓
validateAndMapErrors(rawData, fallback) [Zod validation]
    ↓
{ job: HarnessInstructionJob, flags: EngineeringFlag[] }
    ↓
Merge all flags → return safe payload
```

---

## Failure Modes + Flags

| Failure | Flag Code | flag_type |
|---------|-----------|-----------|
| No API key | `AI_NO_KEY` | `error` |
| API fetch error | `AI_FAILURE` | `error` |
| API HTTP error | `AI_API_ERROR` | `error` |
| No JSON in response | `AI_PARSE_ERROR` | `error` |
| JSON.parse throws | `AI_PARSE_ERROR` | `error` |
| AI returned null | `AI_FALLBACK_USED` | `warning` |
| Schema violation | `VALIDATION-NNN` | `review_required` |

---

## Future Improvements

- Multi-page document support with page references in provenance
- Drawing/image extraction using vision models
- Cross-reference validation (wire_id consistency across arrays)
- Confidence thresholds triggering automatic review_required flags
- Prompt versioning for template regression testing

---

**Last Updated:** 2026-04-10  
**Status:** Implemented (HWI.2)
