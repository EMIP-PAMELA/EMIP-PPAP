'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import EMIPLayout from '../../layout/EMIPLayout';

export default function UploadDrawingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/vault');
  }, [router]);

  return (
    <EMIPLayout>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm uppercase tracking-[0.4em] text-blue-500">Document Vault</p>
        <h1 className="text-3xl font-bold text-gray-900">Redirecting…</h1>
        <p className="text-gray-600 max-w-md">
          Drawing uploads now live in the unified Document Vault. We’ll take you there automatically.
        </p>
      </div>
    </EMIPLayout>
  );
}
