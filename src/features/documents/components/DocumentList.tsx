'use client';

import { PPAPDocument } from '@/src/types/database.types';
import { formatDateTime } from '@/src/lib/utils';
import { UploadDocumentForm } from './UploadDocumentForm';
import { useRouter } from 'next/navigation';

interface DocumentListProps {
  ppapId: string;
  documents: PPAPDocument[];
}

export function DocumentList({ ppapId, documents }: DocumentListProps) {
  const router = useRouter();

  const handleUploadSuccess = () => {
    router.refresh();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Documents</h2>

      {documents.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No documents yet.</p>
          <p className="text-sm text-gray-400">Upload the first document to start building the submission package.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900">{doc.file_name}</h4>
                    {doc.category && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {doc.category.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Uploaded by {doc.uploaded_by}</span>
                    <span>{formatDateTime(doc.created_at)}</span>
                    {doc.file_url && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        Download
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <UploadDocumentForm ppapId={ppapId} onSuccess={handleUploadSuccess} />
    </div>
  );
}
