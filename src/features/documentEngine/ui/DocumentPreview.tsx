'use client';

import { DocumentDraft } from '../templates/types';

interface DocumentPreviewProps {
  draft: DocumentDraft;
}

export function DocumentPreview({ draft }: DocumentPreviewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Generated Document Draft</h3>
        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
          {draft.templateId}
        </span>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 space-y-6">
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Metadata</h4>
          <div className="bg-white rounded p-4 space-y-2">
            {Object.entries(draft.metadata).map(([key, value]) => (
              <div key={key} className="flex justify-between items-start border-b border-gray-100 pb-2 last:border-0">
                <span className="text-sm font-medium text-gray-600 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                </span>
                <span className="text-sm text-gray-900 text-right ml-4">
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Document Fields</h4>
          <div className="bg-white rounded p-4 space-y-3">
            {Object.entries(draft.fields).map(([key, value]) => (
              <div key={key} className="flex justify-between items-start border-b border-gray-100 pb-3 last:border-0">
                <span className="text-sm font-medium text-gray-600 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                </span>
                <span className="text-sm text-gray-900 text-right ml-4 font-semibold">
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> This is a structured draft. Export to PDF functionality will be added in a future phase.
        </p>
      </div>
    </div>
  );
}
