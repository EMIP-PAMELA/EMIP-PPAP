import type { Metadata } from 'next';
import VaultPageClient from './VaultPageClient';

interface NextSearchParams {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: 'Document Vault',
};

// Next.js 16 App Router: searchParams is async in server components and must be awaited.
export default async function VaultPage({ searchParams }: NextSearchParams) {
  const params = await searchParams;
  return <VaultPageClient initialSearchParams={params} />;
}
