'use client';

/**
 * PPAP-Bound Copilot Route
 * V3.3A
 *
 * Entry point for AI document generation within a specific PPAP context.
 * Context is auto-loaded from the PPAP record.
 * Only accessible after ACKNOWLEDGED state (enforced in PPAPDetailLayout).
 */

import { useParams, useRouter } from 'next/navigation';
import { CopilotWorkspace } from '@/src/features/documentEngine/ui/CopilotWorkspace';

export default function PPAPCopilotPage() {
  const params = useParams();
  const router = useRouter();
  const ppapId = typeof params.id === 'string' ? params.id : undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <button
          onClick={() => router.push(ppapId ? `/ppap/${ppapId}` : '/ppap')}
          className="mb-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          ← Back to PPAP
        </button>
        <CopilotWorkspace ppapId={ppapId} />
      </div>
    </div>
  );
}
