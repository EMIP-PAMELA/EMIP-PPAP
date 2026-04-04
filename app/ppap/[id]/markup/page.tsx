'use client';

import { useParams, useRouter } from 'next/navigation';
import { MarkupTool } from '@/src/features/ppap/components/MarkupTool';

export default function PPAPMarkupPage() {
  const params = useParams();
  const router = useRouter();
  const ppapId = typeof params.id === 'string' ? params.id : undefined;

  return (
    <MarkupTool
      context="ppap"
      ppapId={ppapId}
      onClose={() => router.push(ppapId ? `/ppap/${ppapId}/documents` : '/ppap')}
    />
  );
}
