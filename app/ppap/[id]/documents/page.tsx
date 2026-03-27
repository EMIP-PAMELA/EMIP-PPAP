import { DocumentWorkspace } from '@/src/features/documentEngine/ui/DocumentWorkspace';

interface DocumentsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function DocumentsPage({ params }: DocumentsPageProps) {
  const { id } = await params;
  
  return <DocumentWorkspace ppapId={id} />;
}
