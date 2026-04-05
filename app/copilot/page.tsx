'use client';

/**
 * Standalone Document Copilot Route
 * V3.3A
 *
 * Standalone mode only — no PPAP context.
 * PPAP-bound sessions must use /ppap/[id]/copilot.
 */

import { CopilotWorkspace } from '@/src/features/documentEngine/ui/CopilotWorkspace';

export default function CopilotPage() {
  return <CopilotWorkspace />;
}
