/**
 * Schema Validator
 * V3.2F.1 — Injection Engine Hardening
 *
 * Responsibility:
 *   Validate that data received from the Copilot output contract conforms
 *   to the expected schema for each document type before injection begins.
 *
 * Governance rules (V3.2E / V3.2G-1):
 *   - Validation MUST throw a descriptive error on any violation.
 *   - Validators MUST NOT auto-correct, coerce, or silently skip invalid data.
 *   - Numeric fields must be valid finite numbers (not NaN, not Infinity).
 *   - String fields must be non-null strings (empty string is permitted —
 *     it is the caller's responsibility to determine if empty is acceptable).
 *   - Validators return void on success; callers cast data after validation.
 */

// ============================================================================
// PFMEA Validator
// ============================================================================

const PFMEA_REQUIRED_STRING_FIELDS = [
  'process_step',
  'failure_mode',
  'effect',
  'cause',
] as const;

const PFMEA_REQUIRED_NUMERIC_FIELDS = [
  'severity',
  'occurrence',
  'detection',
  'rpn',
] as const;

/**
 * Validate PFMEA document data against the V3.2F schema contract.
 *
 * Checks:
 *   - Top-level structure: { rows: [...] }
 *   - rows is a non-empty array
 *   - Each row is an object
 *   - Each required string field is present and is a string
 *   - Each required numeric field is present, is a number, and is finite
 *
 * @throws Descriptive error on any validation failure.
 */
export function validatePFMEA(data: unknown): void {
  if (data === null || typeof data !== 'object') {
    throw new Error(
      `[SchemaValidator] PFMEA: expected an object, received: ${preview(data)}`
    );
  }

  if (!('rows' in data)) {
    throw new Error(
      '[SchemaValidator] PFMEA: missing required field "rows". ' +
      `Received keys: ${Object.keys(data as object).join(', ') || '(none)'}`
    );
  }

  const rows = (data as Record<string, unknown>)['rows'];

  if (!Array.isArray(rows)) {
    throw new Error(
      `[SchemaValidator] PFMEA: "rows" must be an array. Received: ${preview(rows)}`
    );
  }

  if (rows.length === 0) {
    throw new Error(
      '[SchemaValidator] PFMEA: "rows" array is empty. At least one row is required.'
    );
  }

  rows.forEach((row: unknown, i: number) => {
    if (row === null || typeof row !== 'object') {
      throw new Error(
        `[SchemaValidator] PFMEA: rows[${i}] must be an object. Received: ${preview(row)}`
      );
    }

    const r = row as Record<string, unknown>;

    for (const field of PFMEA_REQUIRED_STRING_FIELDS) {
      if (r[field] === undefined || r[field] === null) {
        throw new Error(
          `[SchemaValidator] PFMEA: rows[${i}].${field} is required but missing or null.`
        );
      }
      if (typeof r[field] !== 'string') {
        throw new Error(
          `[SchemaValidator] PFMEA: rows[${i}].${field} must be a string. ` +
          `Received type: ${typeof r[field]}, value: ${preview(r[field])}`
        );
      }
    }

    for (const field of PFMEA_REQUIRED_NUMERIC_FIELDS) {
      if (r[field] === undefined || r[field] === null) {
        throw new Error(
          `[SchemaValidator] PFMEA: rows[${i}].${field} is required but missing or null.`
        );
      }
      if (typeof r[field] !== 'number' || !isFinite(r[field] as number)) {
        throw new Error(
          `[SchemaValidator] PFMEA: rows[${i}].${field} must be a finite number. ` +
          `Received: ${preview(r[field])}`
        );
      }
    }
  });
}

// ============================================================================
// Helpers
// ============================================================================

function preview(value: unknown): string {
  try {
    const str = JSON.stringify(value);
    return str !== undefined ? str.slice(0, 120) : String(value);
  } catch {
    return String(value);
  }
}
