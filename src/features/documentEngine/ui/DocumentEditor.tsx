'use client';

import { DocumentDraft, TemplateId } from '../templates/types';
import { getTemplate } from '../templates/registry';

interface DocumentEditorProps {
  draft: DocumentDraft;
  templateId: TemplateId;
  onFieldChange: (fieldPath: string, value: any) => void;
  onReset?: () => void;
  hasChanges?: boolean;
  readOnly?: boolean;
  // Phase 33: Mapping metadata for debug visibility
  mappingMeta?: Record<string, any>;
  showMappingDebug?: boolean;
}  // Phase 25: Support read-only mode for approved/old versions

export function DocumentEditor({ draft, templateId, onFieldChange, onReset, hasChanges, readOnly = false, mappingMeta, showMappingDebug }: DocumentEditorProps) {
  const template = getTemplate(templateId);
  const layout = template.layout;
  const fieldDefinitions = template.fieldDefinitions;

  // Helper to find field definition
  const getFieldDef = (fieldKey: string) => {
    return fieldDefinitions.find(def => def.key === fieldKey);
  };
  
  // Phase 33: Get mapping indicator for field
  const getMappingIndicator = (fieldKey: string) => {
    if (!showMappingDebug || !mappingMeta || !mappingMeta[fieldKey]) {
      return null;
    }
    
    const meta = mappingMeta[fieldKey];
    const sourceInfo = `${meta.sourceModel}.${meta.sourceField}`;
    
    if (meta.success) {
      return (
        <span 
          className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded font-mono"
          title={`Mapped from ${sourceInfo}`}
        >
          ✓ {sourceInfo}
        </span>
      );
    } else {
      return (
        <span 
          className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded"
          title={meta.error || 'Mapping failed'}
        >
          ⚠ {meta.error || 'Mapping failed'}
        </span>
      );
    }
  };

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
          {readOnly && (
            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
              Read-Only
            </span>
          )}
        </div>
        {hasChanges && !readOnly && (
          <button
            onClick={onReset}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 font-medium text-sm transition-colors"
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

        {/* Section-Based Fields */}
        {layout.sections.map((section) => (
          <div key={section.id}>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">{section.title}</h4>
            <div className="bg-white rounded p-4 space-y-4">
              {section.fields.map((fieldKey) => {
                // Skip if field doesn't exist in draft
                if (!(fieldKey in draft.fields)) return null;
                
                const value = draft.fields[fieldKey];
                const fieldDef = getFieldDef(fieldKey);
                
                // Fallback if no field definition found
                if (!fieldDef) {
                  return (
                    <div key={fieldKey}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {fieldKey.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <input
                        type="text"
                        value={String(value)}
                        onChange={(e) => onFieldChange(fieldKey, e.target.value)}
                        disabled={readOnly}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          readOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                        }`}
                      />
                    </div>
                  );
                }
                
                return (
                  <div key={fieldKey}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {fieldDef.label}
                      {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
                      {getMappingIndicator(fieldKey)}
                      {!fieldDef.editable && <span className="text-gray-500 ml-2 text-xs">(Read-only)</span>}
                    </label>
                    
                    {/* Array value → table rendering (editable if rowFields defined) */}
                    {Array.isArray(value) ? (
                      <div className="overflow-x-auto">
                        {value.length === 0 ? (
                          <p className="text-sm text-gray-500 italic">No rows</p>
                        ) : fieldDef.rowFields ? (
                          /* Editable table — schema-driven per column */
                          <table className="w-full text-sm border border-gray-200 rounded-md">
                            <thead className="bg-gray-100">
                              <tr>
                                {fieldDef.rowFields.map((col) => (
                                  <th
                                    key={col.key}
                                    className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide border-b border-gray-200 whitespace-nowrap"
                                  >
                                    {col.label}
                                    {col.required && <span className="text-red-400 ml-1">*</span>}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(value as Record<string, any>[]).map((row, rowIndex) => (
                                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  {fieldDef.rowFields!.map((col) => {
                                    const cellValue = row[col.key];

                                    const handleCellChange = (newCellValue: any) => {
                                      const updatedRow = { ...row, [col.key]: newCellValue };

                                      // Recompute any columns whose derivedProduct includes this key
                                      for (const sibling of fieldDef.rowFields!) {
                                        if (sibling.derivedProduct?.includes(col.key)) {
                                          const product = sibling.derivedProduct.reduce<number | null>(
                                            (acc, k) => {
                                              const v = k === col.key ? newCellValue : updatedRow[k];
                                              if (acc === null || v == null || v === '' || isNaN(Number(v))) return null;
                                              return acc * Number(v);
                                            },
                                            1
                                          );
                                          updatedRow[sibling.key] = product;
                                        }
                                      }

                                      const updatedRows = value.map((r: any, i: number) =>
                                        i === rowIndex ? updatedRow : r
                                      );
                                      onFieldChange(fieldKey, updatedRows);
                                    };

                                    if (!col.editable) {
                                      return (
                                        <td
                                          key={col.key}
                                          className="px-3 py-2 border-b border-gray-100 text-gray-600 align-top whitespace-nowrap"
                                        >
                                          {Array.isArray(cellValue)
                                            ? cellValue.length > 0 ? cellValue.join(', ') : '—'
                                            : String(cellValue ?? '—')}
                                        </td>
                                      );
                                    }

                                    return (
                                      <td key={col.key} className="px-2 py-1 border-b border-gray-100 align-top">
                                        <input
                                          type={col.type === 'number' ? 'number' : 'text'}
                                          value={cellValue ?? ''}
                                          min={col.validation?.min}
                                          max={col.validation?.max}
                                          onChange={(e) => {
                                            let v: any = e.target.value;
                                            if (col.type === 'number') {
                                              v = e.target.value === '' ? null : (parseFloat(e.target.value) || null);
                                            }
                                            handleCellChange(v);
                                          }}
                                          disabled={readOnly}
                                          className={`w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[80px] ${
                                            readOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                                          }`}
                                        />
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          /* Read-only table — no rowFields schema */
                          <table className="w-full text-sm border border-gray-200 rounded-md">
                            <thead className="bg-gray-100">
                              <tr>
                                {Object.keys(value[0]).map((col) => (
                                  <th
                                    key={col}
                                    className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide border-b border-gray-200"
                                  >
                                    {col.replace(/([A-Z])/g, ' $1').trim()}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {value.map((row: Record<string, any>, rowIndex: number) => (
                                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  {Object.values(row).map((cell, cellIndex) => (
                                    <td
                                      key={cellIndex}
                                      className="px-3 py-2 border-b border-gray-100 text-gray-800 align-top"
                                    >
                                      {Array.isArray(cell)
                                        ? cell.length > 0 ? cell.join(', ') : '—'
                                        : String(cell ?? '—')}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    ) : /* Render based on field type */
                    fieldDef.type === 'select' && fieldDef.editable ? (
                      <select
                        value={String(value)}
                        onChange={(e) => onFieldChange(fieldKey, e.target.value)}
                        disabled={!fieldDef.editable}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        {fieldDef.options?.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : fieldDef.editable ? (
                      <input
                        type={fieldDef.type === 'number' ? 'number' : 'text'}
                        value={String(value)}
                        onChange={(e) => {
                          let newValue: any = e.target.value;
                          if (fieldDef.type === 'number') {
                            newValue = parseFloat(e.target.value) || 0;
                          }
                          onFieldChange(fieldKey, newValue);
                        }}
                        min={fieldDef.validation?.min}
                        max={fieldDef.validation?.max}
                        pattern={fieldDef.validation?.pattern}
                        required={fieldDef.required}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                        {String(value)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Editing:</strong> Changes are saved in your working draft. Use "Reset to Generated" to discard changes. Export functionality will be added in a future phase.
        </p>
      </div>
    </div>
  );
}
