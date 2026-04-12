'use client';

/**
 * Legacy session-based dashboard -- superseded by /emip-dashboard.
 * Redirects immediately so no dead-end is exposed to users.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacyDashboardRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/emip-dashboard');
  }, [router]);
  return null;
}