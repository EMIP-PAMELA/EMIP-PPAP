'use client';

import { useRouter } from 'next/navigation';
import { MarkupTool } from '@/src/features/ppap/components/MarkupTool';

export default function WorkspaceMarkupPage() {
  const router = useRouter();

  return (
    <MarkupTool
      context="standalone"
      onClose={() => router.push('/document-workspace')}
    />
  );
}
