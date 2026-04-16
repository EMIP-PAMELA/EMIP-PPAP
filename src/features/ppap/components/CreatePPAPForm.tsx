'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createPPAP } from '@/src/features/ppap/mutations';
import { uploadPPAPDocument } from '@/src/features/ppap/utils/uploadFile';
import { logEvent } from '@/src/features/events/mutations';
import { supabase } from '@/src/lib/supabaseClient';
import type { CreatePPAPInput, PPAPType } from '@/src/types/database.types';
import { VALID_PLANTS } from '../utils/plantValidation';
import { VALID_DEPARTMENTS, DEPARTMENT_LABELS, DEPARTMENT_DESCRIPTIONS } from '../config/departments';
import {
  DOCUMENT_REGISTRY,
  DocumentMode,
  DocumentScopeEntry,
  MODE_LABELS,
  MODE_BADGE_CLASSES,
  buildDefaultScope,
  validateScope,
  requiresOwner,
} from '../config/documentRegistry';

interface UploadedFile {
  file_name: string;
  file_path: string;
}

const generateTempId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export function CreatePPAPForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<CreatePPAPInput>>({});
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const tempPpapId = useRef(generateTempId());

  // V3.3A: Document scope state — initialized to registry defaults
  const [documentScope, setDocumentScope] = useState<DocumentScopeEntry[]>(() =>
    buildDefaultScope()
  );
  const [scopeErrors, setScopeErrors] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Phase 3H.12: Validate all required fields including plant
      if (!formData.ppap_number || !formData.part_number || !formData.customer_name || !formData.request_date || !formData.ppap_type) {
        throw new Error('Please fill in all required fields');
      }

      if (!formData.plant) {
        throw new Error('Please select a production plant');
      }

      // V3.3A.5: Validate department is selected
      if (!formData.department) {
        throw new Error('Please select a responsible department');
      }

      // V3.3A: Validate document scope
      const scopeValidationErrors = validateScope(documentScope);
      if (scopeValidationErrors.length > 0) {
        setScopeErrors(scopeValidationErrors);
        setLoading(false);
        return;
      }
      setScopeErrors([]);

      // Phase 3H.12: Log creation input
      console.log('🆕 CREATE PPAP INPUT', {
        partNumber: formData.part_number,
        customer: formData.customer_name,
        plant: formData.plant,
        documentScope,
      });

      const ppap = await createPPAP(formData as CreatePPAPInput);

      // V3.3A: Log document scope as event_data snapshot at creation time.
      // Note: ppap_records has no document_scope column — persistence deferred until
      // ppap_document_scope table is created. Scope is preserved here in the event log.
      await logEvent({
        ppap_id: ppap.id,
        event_type: 'PPAP_CREATED',
        event_data: {
          document_scope: documentScope,
          ppap_type: formData.ppap_type,
          customer: formData.customer_name,
          part_number: formData.part_number,
        },
        actor: 'System User',
        actor_role: 'coordinator',
      });

      // CRITICAL: Log DOCUMENT_ADDED events with real PPAP ID only
      if (uploadedFiles.length > 0) {
        // Guard: ensure ppap.id is valid before event logging
        if (!ppap.id || typeof ppap.id !== 'string') {
          throw new Error('Cannot log document events without valid PPAP id');
        }

        console.log('Logging document events for uploaded files. PPAP ID:', ppap.id);
        
        for (const file of uploadedFiles) {
          console.log('DOCUMENT_ADDED write', {
            ppapId: ppap.id,
            fileName: file.file_name,
            filePath: file.file_path,
          });

          await logEvent({
            ppap_id: ppap.id,
            event_type: 'DOCUMENT_ADDED',
            event_data: {
              file_name: file.file_name,
              file_path: file.file_path,
              document_type: 'initial',
            },
            actor: 'System User',
            actor_role: 'Engineer',
          });
        }
        
        console.log('Document event logging complete. Files now visible under ppapId:', ppap.id);
      }

      router.push(`/ppap/${ppap.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create PPAP');
      setLoading(false);
    }
  };

  const handleChange = (field: keyof CreatePPAPInput, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // V3.3A: Document scope helpers
  const updateScopeEntry = (documentId: string, patch: Partial<DocumentScopeEntry>) => {
    setDocumentScope((prev) =>
      prev.map((entry) =>
        entry.documentId === documentId ? { ...entry, ...patch } : entry
      )
    );
    setScopeErrors([]); // clear errors on any change
  };

  const resetScopeToDefaults = () => {
    setDocumentScope(buildDefaultScope(formData.ppap_type));
    setScopeErrors([]);
  };

  const handleInitialUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    const uploadedList: UploadedFile[] = [];

    for (const file of files) {
      try {
        // Upload to storage (organized by temp folder for now)
        const fileRef = await uploadPPAPDocument(file, tempPpapId.current);

        // DO NOT log event yet - no real PPAP id exists
        // Event logging deferred until handleSubmit with real ppap.id

        uploadedList.push({
          file_name: file.name,
          file_path: fileRef.url,
        });
      } catch (err) {
        console.error('Upload failed for', file.name, ':', err);
        setError(`Failed to upload ${file.name}`);
      }
    }

    setUploadedFiles((prev) => [...prev, ...uploadedList]);
    setUploading(false);

    // Reset input
    e.target.value = '';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 px-6 py-4 rounded-lg shadow-sm">
          <p className="font-bold text-base">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-8">
        <h3 className="text-xl font-bold text-[color:var(--text-primary)] mb-6 pb-3 border-b border-gray-200">PPAP Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="ppap_number" className="block text-sm font-semibold text-gray-700 mb-2">
              Customer PPAP Number <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              id="ppap_number"
              required
              className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={formData.ppap_number || ''}
              onChange={(e) => handleChange('ppap_number', e.target.value.trim())}
              placeholder="Enter customer-assigned PPAP number"
            />
          </div>

          <div>
            <label htmlFor="part_number" className="block text-sm font-semibold text-gray-700 mb-2">
              Part Number <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              id="part_number"
              required
              className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={formData.part_number || ''}
              onChange={(e) => handleChange('part_number', e.target.value)}
              placeholder="Enter part number"
            />
          </div>

          <div>
            <label htmlFor="customer_name" className="block text-sm font-semibold text-gray-700 mb-2">
              Customer Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              id="customer_name"
              required
              className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={formData.customer_name || ''}
              onChange={(e) => handleChange('customer_name', e.target.value)}
              placeholder="Enter customer name"
            />
          </div>

          <div>
            <label htmlFor="ppap_type" className="block text-sm font-semibold text-gray-700 mb-2">
              What type of PPAP is this? <span className="text-red-600">*</span>
            </label>
            <select
              id="ppap_type"
              required
              className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={formData.ppap_type || ''}
              onChange={(e) => handleChange('ppap_type', e.target.value as PPAPType)}
            >
              <option value="">Select PPAP Type</option>
              <option value="NPI">New Product Introduction (NPI)</option>
              <option value="CHANGE">Engineering Change / Modification</option>
              <option value="MAINTENANCE">Production / Maintenance Update</option>
            </select>
          </div>

          <div>
            <label htmlFor="plant" className="block text-sm font-semibold text-gray-700 mb-2">
              Production Plant <span className="text-red-600">*</span>
            </label>
            <select
              id="plant"
              required
              className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={formData.plant || ''}
              onChange={(e) => handleChange('plant', e.target.value)}
            >
              <option value="">Select Production Plant</option>
              {VALID_PLANTS.map((plant) => (
                <option key={plant} value={plant}>
                  {plant}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="request_date" className="block text-sm font-semibold text-gray-700 mb-2">
              Request Date <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              id="request_date"
              required
              className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={formData.request_date || ''}
              onChange={(e) => handleChange('request_date', e.target.value)}
            />
          </div>

          {/* V3.3A.5: Department Queue Assignment */}
          <div>
            <label htmlFor="department" className="block text-sm font-semibold text-gray-700 mb-2">
              Responsible Department <span className="text-red-600">*</span>
            </label>
            <select
              id="department"
              required
              className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={formData.department || ''}
              onChange={(e) => handleChange('department', e.target.value)}
            >
              <option value="">Select Department</option>
              {VALID_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {DEPARTMENT_LABELS[dept]}
                </option>
              ))}
            </select>
            {formData.department && (
              <p className="mt-1 text-xs text-gray-600">
                {DEPARTMENT_DESCRIPTIONS[formData.department]}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* V3.3A: Document Scope Selection */}
      <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-8">
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-bold text-[color:var(--text-primary)]">Document Scope</h3>
            <p className="text-sm text-gray-600 mt-1">
              Configure which documents are required and how each will be produced.
            </p>
          </div>
          <button
            type="button"
            onClick={resetScopeToDefaults}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
          >
            Reset to defaults
          </button>
        </div>

        {/* Scope validation errors */}
        {scopeErrors.length > 0 && (
          <div className="mb-4 bg-red-50 border border-red-300 rounded-lg px-4 py-3 space-y-1">
            {scopeErrors.map((e, i) => (
              <p key={i} className="text-sm text-red-800">{e}</p>
            ))}
          </div>
        )}

        {/* Document scope table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="text-left pb-2 pr-4 w-48">Document</th>
                <th className="text-center pb-2 px-3 w-20">Required</th>
                <th className="text-left pb-2 px-3 w-44">Mode</th>
                <th className="text-left pb-2 pl-3">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documentScope.map((entry) => {
                const config = DOCUMENT_REGISTRY.find((d) => d.id === entry.documentId)!;
                const isNa = entry.mode === 'na';
                const needsOwner = entry.required && requiresOwner(entry.mode);

                return (
                  <tr
                    key={entry.documentId}
                    className={`${isNa ? 'opacity-50' : ''} transition-opacity`}
                  >
                    {/* Document name + requirement badge */}
                    <td className="py-2.5 pr-4">
                      <span className="font-medium text-gray-900">{config.name}</span>
                      <span
                        className={`ml-2 text-xs px-1.5 py-0.5 rounded font-semibold ${
                          config.requirementLevel === 'REQUIRED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {config.requirementLevel === 'REQUIRED' ? 'REQ' : 'COND'}
                      </span>
                    </td>

                    {/* Required toggle */}
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={entry.required}
                        onChange={(e) =>
                          updateScopeEntry(entry.documentId, {
                            required: e.target.checked,
                            // If un-requiring and mode was na, keep na. Otherwise keep mode.
                          })
                        }
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </td>

                    {/* Mode dropdown */}
                    <td className="py-2.5 px-3">
                      {config.modeEditable ? (
                        <select
                          value={entry.mode}
                          onChange={(e) =>
                            updateScopeEntry(entry.documentId, {
                              mode: e.target.value as DocumentMode,
                              // Clear owner when switching to static/na
                              owner: requiresOwner(e.target.value as DocumentMode) ? entry.owner : '',
                            })
                          }
                          disabled={!entry.required}
                          className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                          {(['generated', 'assisted', 'static', 'na'] as DocumentMode[]).map((m) => (
                            // Only show 'generated'/'assisted' for AI-capable docs
                            (!config.aiCapable && (m === 'generated')) ? null :
                            <option key={m} value={m}>{MODE_LABELS[m]}</option>
                          ))}
                        </select>
                      ) : (
                        // Non-editable mode — display only
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${MODE_BADGE_CLASSES[entry.mode]}`}>
                          {MODE_LABELS[entry.mode]}
                        </span>
                      )}
                    </td>

                    {/* Owner field — only shown when required */}
                    <td className="py-2.5 pl-3">
                      {needsOwner ? (
                        <input
                          type="text"
                          value={entry.owner}
                          onChange={(e) =>
                            updateScopeEntry(entry.documentId, { owner: e.target.value })
                          }
                          placeholder="Assign to..."
                          className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-3">
          {(['generated', 'assisted', 'static', 'na'] as DocumentMode[]).map((m) => (
            <span key={m} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${MODE_BADGE_CLASSES[m]}`}>
              {MODE_LABELS[m]}
            </span>
          ))}
          <span className="text-xs text-gray-500 ml-2 self-center">Owner required for Generated and Assisted modes</span>
        </div>
      </div>

      {/* Optional: Initial Customer Documents */}
      <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-8">
        <h3 className="text-xl font-bold text-[color:var(--text-primary)] mb-6 pb-3 border-b border-gray-200">Initial Customer Documents (Optional)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Upload any initial documents received from the customer (e.g., drawings, PPAP request forms, specifications).
          This front-loads all incoming data for easier tracking.
        </p>
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
          <div className="space-y-2">
            <svg className="mx-auto h-10 w-10 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="text-sm text-gray-600">
              <label htmlFor="intake-file-upload" className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500">
                <span>{uploading ? 'Uploading...' : 'Click to upload'}</span>
                <input 
                  id="intake-file-upload" 
                  name="intake-file-upload" 
                  type="file" 
                  className="sr-only" 
                  multiple 
                  onChange={handleInitialUpload}
                  disabled={uploading}
                />
              </label>
              <span className="pl-1">or drag and drop</span>
            </div>
            <p className="text-xs text-gray-500">Customer drawings, PPAP requests, specifications (PDF, DOC, DOCX)</p>
          </div>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-semibold text-gray-700">Uploaded Files ({uploadedFiles.length}):</p>
            <div className="space-y-1">
              {uploadedFiles.map((file, index) => (
                <div key={`${file.file_path}-${index}`} className="flex items-center gap-2 text-sm text-gray-600 bg-green-50 border border-green-200 rounded px-3 py-2">
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="flex-1">{file.file_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm"
        >
          {loading ? 'Creating...' : 'Create PPAP'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="bg-white border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors shadow-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
