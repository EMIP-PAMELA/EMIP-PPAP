/**
 * Injection Logger
 * V3.2F.1 — Injection Engine Hardening
 *
 * Responsibility:
 *   Provide structured, traceable logging for all injection engine events.
 *   Every significant action (sheet match, header detection, row writes,
 *   field writes) is logged to support debugging and audit trail.
 *
 * Governance rules (V3.2E / V3.2G-1):
 *   - Logging is informational only. It MUST NOT modify workbook state.
 *   - Log entries are structured JSON objects emitted to the console.
 *   - In a future phase, log entries may be routed to an audit service.
 *     Keep the logEvent signature stable to enable that migration.
 */

// ============================================================================
// Types
// ============================================================================

export type LogEventType = 'info' | 'warn' | 'error' | 'debug';

export interface LogMetadata {
  [key: string]: unknown;
}

// ============================================================================
// Logger
// ============================================================================

/**
 * Emit a structured log entry for an injection engine event.
 *
 * @param type     - Severity level: 'info' | 'warn' | 'error' | 'debug'
 * @param message  - Human-readable description of the event.
 * @param metadata - Optional key-value context (sheet name, row count, etc.)
 */
export function logEvent(
  type: LogEventType,
  message: string,
  metadata?: LogMetadata
): void {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    type,
    message,
  };

  if (metadata && Object.keys(metadata).length > 0) {
    entry['metadata'] = metadata;
  }

  const serialized = '[InjectionEngine] ' + JSON.stringify(entry);

  switch (type) {
    case 'error':
      console.error(serialized);
      break;
    case 'warn':
      console.warn(serialized);
      break;
    case 'debug':
      console.debug(serialized);
      break;
    default:
      console.log(serialized);
  }
}
