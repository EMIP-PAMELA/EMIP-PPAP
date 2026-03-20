'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deletePPAP } from '@/src/features/ppap/mutations';

interface DeletePPAPButtonProps {
  ppapId: string;
  ppapNumber: string;
}

export function DeletePPAPButton({ ppapId, ppapNumber }: DeletePPAPButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this PPAP? This action cannot be undone.'
    );

    if (!confirmed) return;

    setDeleting(true);

    try {
      await deletePPAP(ppapId, 'Matt');
      router.push('/');
      router.refresh();
    } catch (err) {
      console.error('Failed to delete PPAP:', err);
      alert('Failed to delete PPAP. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
    >
      {deleting ? 'Deleting...' : 'Delete PPAP'}
    </button>
  );
}
