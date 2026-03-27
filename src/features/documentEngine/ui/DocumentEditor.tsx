'use client';

import { DocumentDraft } from '../templates/types';

interface DocumentEditorProps {
  draft: DocumentDraft;
  onFieldChange: (fieldKey: string, value: any) => void;
  onReset: () => void;
  hasChanges: boolean;
}

export function DocumentEditor({ draft, onFieldChange, onReset, hasChanges }: DocumentEditorProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Document Editor</h3>
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            {draft.templateId}
          </span>
          {hasChanges && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
              Modified
            </span>
          )}
        </div>
        {hasChanges && (
          <button
            onClick={onReset}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium"
          >
            Reset to Generated
          </button>
        )}
      </div>

      <div className="bg-gray-50 rounded-lg p-6 space-y-6">
        {/* Metadata Section (Read-only) */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Metadata (Read-only)</h4>
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

        {/* Editable Fields Section */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Document Fields (Editable)</h4>
          <div className="bg-white rounded p-4 space-y-4">
            {Object.entries(draft.fields).map(([key, value]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </label>
                <input
                  type={typeof value === 'number' ? 'number' : 'text'}
                  value={String(value)}
                  onChange={(e) => {
                    const newValue = typeof value === 'number' 
                      ? parseFloat(e.target.value) || 0 
                      : e.target.value;
                    onFieldChange(key, newValue);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Editing:</strong> Changes are saved in your working draft. Use "Reset to Generated" to discard changes. Export functionality will be added in a future phase.
        </p>
      </div>
    </div>
  );
}
