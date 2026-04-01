'use client';

import { useSearchParams } from 'next/navigation';
import { CopilotWorkspace } from '@/src/features/documentEngine/ui/CopilotWorkspace';

/**
 * Document Copilot Route
 * V3.2F-3b
 * 
 * Entry point for AI-guided document generation with Claude.
 * Supports both Standalone and PPAP-Bound modes via query parameters.
 * 
 * Usage:
 * - /copilot - Standalone mode
 * - /copilot?ppapId=xxx - PPAP-Bound mode
 */
export default function CopilotPage() {
  const searchParams = useSearchParams();
  const ppapId = searchParams.get('ppapId');
  const documentType = searchParams.get('documentType');

  return (
    <CopilotWorkspace 
      ppapId={ppapId || undefined}
      documentType={documentType || undefined}
    />
  );
}
