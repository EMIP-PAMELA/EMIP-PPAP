'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logEvent } from '@/src/features/events/mutations';
import { updateWorkflowPhase } from '../mutations/updateWorkflowPhase';
import { WorkflowPhase } from '../constants/workflowPhases';
import { uploadPPAPDocument } from '../utils/uploadFile';
import { getPPAPDocuments } from '../utils/getPPAPDocuments';
import { supabase } from '@/src/lib/supabaseClient';
import { MarkupTool } from './MarkupTool';

interface DocumentationFormProps {
  ppapId: string;
  partNumber: string;
  currentPhase: WorkflowPhase;
  initialSection?: Section;
  isReadOnly?: boolean;
}

type Section = 'checklist' | 'upload' | 'readiness' | 'confirmation';

interface DocumentationData {
  suggested_date: string;
  can_meet_date: boolean;
  docs_ready: boolean;
  comments: string;
  design_record: boolean;
  dimensional_results: boolean;
  dfmea: boolean;
  pfmea: boolean;
  control_plan: boolean;
  msa: boolean;
  material_test_results: boolean;
  initial_process_studies: boolean;
  packaging: boolean;
  tooling: boolean;
  acknowledgement: boolean;
}

const REQUIRED_DOCUMENTS = [
  { key: 'design_record', label: 'Design Record' },
  { key: 'dimensional_results', label: 'Dimensional Results' },
  { key: 'dfmea', label: 'Design Failure Mode and Effects Analysis (DFMEA)' },
  { key: 'pfmea', label: 'Process Failure Mode and Effects Analysis (PFMEA)' },
  { key: 'control_plan', label: 'Control Plan' },
  { key: 'msa', label: 'MSA (Measurement System Analysis)' },
  { key: 'material_test_results', label: 'Material Test Results' },
  { key: 'initial_process_studies', label: 'Initial Process Studies' },
  { key: 'packaging', label: 'Packaging Specification' },
  { key: 'tooling', label: 'Tooling Documentation' },
] as const;

const SECTIONS = [
  { id: 'checklist', label: 'Required Documents' },
  { id: 'upload', label: 'Upload Documents' },
  { id: 'readiness', label: 'Submission Readiness' },
  { id: 'confirmation', label: 'Confirmation' },
] as const;

interface UploadedFile {
  file_name: string;
  file_path: string;
  document_type: string;
  uploaded_at: string;
}

export function DocumentationForm({ ppapId, partNumber, currentPhase, initialSection, isReadOnly = false }: DocumentationFormProps) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>(initialSection || 'checklist');
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({});
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [showMarkupTool, setShowMarkupTool] = useState(false);

  const [formData, setFormData] = useState<DocumentationData>({
    suggested_date: '',
    can_meet_date: false,
    docs_ready: false,
    comments: '',
    design_record: false,
    dimensional_results: false,
    dfmea: false,
    pfmea: false,
    control_plan: false,
    msa: false,
    material_test_results: false,
    initial_process_studies: false,
    packaging: false,
    tooling: false,
    acknowledgement: false,
  });

  // Fetch uploaded files using shared utility
  useEffect(() => {
    const fetchUploadedFiles = async () => {
      try {
        const docs = await getPPAPDocuments(ppapId);
        console.log('Documents loaded in DocumentationForm:', docs);
        
        const files = docs.map(doc => ({
          file_name: doc.file_name,
          file_path: doc.file_path,
          document_type: doc.document_type || 'general',
          uploaded_at: new Date().toISOString(),
        }));

        setUploadedFiles(files);
      } catch (error) {
        console.error('Failed to fetch uploaded files:', error);
      }
    };

    fetchUploadedFiles();
  }, [ppapId]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setErrors({});

    try {
      // Guard: ensure ppapId is valid before event logging
      if (!ppapId || typeof ppapId !== 'string') {
        throw new Error('Cannot log document event without valid PPAP id');
      }

      for (const file of Array.from(files)) {
        // Upload file to Supabase Storage
        const filePath = await uploadPPAPDocument(file, ppapId);

        console.log('DOCUMENT_ADDED write', {
          ppapId,
          fileName: file.name,
          filePath,
        });

        // Log upload event
        await logEvent({
          ppap_id: ppapId,
          event_type: 'DOCUMENT_ADDED',
          event_data: {
            file_name: file.name,
            file_path: filePath,
            document_type: 'general',
          },
          actor: 'System User',
          actor_role: 'Engineer',
        });
      }

      // Refresh uploaded files list using shared utility
      const docs = await getPPAPDocuments(ppapId);
      const refreshedFiles: UploadedFile[] = docs.map(doc => ({
        file_name: doc.file_name,
        file_path: doc.file_path,
        document_type: doc.document_type || 'general',
        uploaded_at: new Date().toISOString(),
      }));
      setUploadedFiles(refreshedFiles);

      setSuccessMessage(`Successfully uploaded ${files.length} file(s)`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Upload failed:', error);
      setErrors({ upload: error instanceof Error ? error.message : 'Upload failed' });
    } finally {
      setUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const getMissingDocuments = (): string[] => {
    return REQUIRED_DOCUMENTS
      .filter(doc => !formData[doc.key as keyof DocumentationData])
      .map(doc => doc.label);
  };

  const getCheckedButNotUploaded = (): string[] => {
    return REQUIRED_DOCUMENTS
      .filter(doc => {
        const isChecked = !!formData[doc.key as keyof DocumentationData];
        const isUploaded = uploadedDocs[doc.key];
        return isChecked && !isUploaded;
      })
      .map(doc => doc.label);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.suggested_date) {
      newErrors.suggested_date = 'Suggested submission date is required';
    }

    if (!formData.acknowledgement) {
      newErrors.acknowledgement = 'You must acknowledge the submission';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    setErrors({});
    setSuccessMessage('');

    if (!validateForm()) {
      setErrors(prev => ({
        ...prev,
        _form: 'Please complete all required fields',
      }));
      return;
    }

    setLoading(true);

    try {
      // Log DOCUMENTATION_SUBMITTED event
      await logEvent({
        ppap_id: ppapId,
        event_type: 'DOCUMENTATION_SUBMITTED',
        event_data: {
          submission_date: formData.suggested_date,
          can_meet_date: formData.can_meet_date,
          docs_ready: formData.docs_ready,
          checked_documents: REQUIRED_DOCUMENTS.filter(doc => 
            formData[doc.key as keyof DocumentationData]
          ).map(doc => doc.label),
          comments: formData.comments,
          all_form_data: formData,
        },
        actor: 'Matt',
        actor_role: 'Engineer',
      });

      // Persist phase change to database
      await updateWorkflowPhase({
        ppapId,
        fromPhase: currentPhase,
        toPhase: 'SAMPLE',
        actor: 'Matt',
        additionalData: {
          documentation_data: formData,
        },
      });

      setSuccessMessage('✓ Documentation phase completed! Advancing to Sample phase...');
      
      // Refresh UI to reflect status/phase change
      router.refresh();
      
      // Phase 3F: Phase is now derived from state, no manual phase setting
      // The workflow bar will automatically update when state changes
    } catch (error) {
      console.error('Failed to submit documentation:', error);
      setErrors({ 
        _form: error instanceof Error 
          ? `Failed to submit documentation: ${error.message}` 
          : 'Failed to submit documentation. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof DocumentationData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const countCheckedDocuments = (): number => {
    return REQUIRED_DOCUMENTS.filter(doc => 
      formData[doc.key as keyof DocumentationData]
    ).length;
  };

  return (
    <>
      {showMarkupTool && (
        <MarkupTool
          ppapId={ppapId}
          partNumber={partNumber}
          onClose={() => setShowMarkupTool(false)}
        />
      )}

      <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-300 rounded-xl shadow-sm">
      <div className="border-b border-gray-200 px-8 py-6">
        <h2 className="text-2xl font-bold text-gray-900">Documentation Phase</h2>
        <p className="text-sm text-gray-600 mt-1">
          Part Number: <span className="font-medium">{partNumber || ''}</span>
        </p>
      </div>

      {/* Read-Only Banner */}
      {isReadOnly && (
        <div className="px-6 py-4 bg-yellow-50 border-b-2 border-yellow-300">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <p className="text-sm font-bold text-yellow-900 uppercase tracking-wide">Preview Mode</p>
              <p className="text-sm text-yellow-800">Complete previous phases to unlock this section</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Sidebar Navigation */}
        <div className="w-64 border-r border-gray-200 bg-gray-50">
          <div className="p-8 space-y-8">
            {SECTIONS.map(section => (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(section.id as Section);
                  setErrors({});
                }}
                className={`w-full text-left px-4 py-2 rounded text-sm font-medium transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 p-6">
          {errors._form && (
            <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800 font-medium">
              {errors._form || ''}
            </div>
          )}

          {/* Guidance Warnings - Non-blocking */}
          {getMissingDocuments().length > 0 && activeSection === 'checklist' && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-300 rounded-lg text-sm text-blue-800 font-medium">
              <p className="font-bold">ℹ️ Document Guidance</p>
              <p className="mt-1">Consider checking these documents:</p>
              <div className="mt-2">
                <ul className="mt-1 ml-4 list-disc text-xs">
                  {getMissingDocuments().map(doc => (
                    <li key={doc}>{doc || ''}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Required Documents Checklist Section - NOW FIRST */}
          {activeSection === 'checklist' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">Required Documents Checklist</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Review and check the documents you have prepared for this PPAP submission.
                  <span className="block mt-2 text-xs text-gray-500">
                    ✓ = Document prepared and ready
                  </span>
                </p>

                {/* Markup Tool Mode Switch */}
                <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-purple-900 mb-3">Drawing Markup</h4>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowMarkupTool(true)}
                      disabled={isReadOnly}
                      className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      🖊️ Open Markup Tool
                    </button>
                    <button
                      disabled={isReadOnly}
                      className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      📤 Upload Markup File
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Create markup annotations in-tool or upload pre-marked drawings
                  </p>
                </div>
                
                <div className="space-y-3">
                  {REQUIRED_DOCUMENTS.map(doc => {
                    const isUploaded = uploadedDocs[doc.key];
                    const isChecked = !!formData[doc.key as keyof DocumentationData];
                    return (
                      <div key={doc.key} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                        <div className="flex items-start flex-1">
                          <input
                            type="checkbox"
                            id={doc.key}
                            checked={isChecked}
                            onChange={(e) => updateField(doc.key as keyof DocumentationData, e.target.checked)}
                            className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor={doc.key} className="ml-3 text-sm text-gray-700">
                            {doc.label}
                          </label>
                        </div>
                        <div className="ml-4">
                          {isUploaded ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              ✓ Uploaded
                            </span>
                          ) : isChecked ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              ⚠ Missing
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                              Not Required
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Upload Documents Section - NOW SECOND */}
          {activeSection === 'upload' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">Upload Required Documents</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload documents required for this PPAP submission.
                </p>

                {/* Upload area */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-gray-400 transition-colors">
                  <div className="space-y-4">
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="text-sm text-gray-600">
                      <label htmlFor="file-upload" className={`relative rounded-md font-medium ${
                        uploading || isReadOnly ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-500 cursor-pointer'
                      }`}>
                        <span>{uploading ? 'Uploading...' : 'Click to upload'}</span>
                        <input 
                          id="file-upload" 
                          name="file-upload" 
                          type="file" 
                          className="sr-only" 
                          multiple 
                          onChange={handleFileUpload}
                          disabled={uploading || isReadOnly}
                          accept=".pdf,.doc,.docx,.xls,.xlsx"
                        />
                      </label>
                      <span className="pl-1">or drag and drop</span>
                    </div>
                    <p className="text-xs text-gray-500">PDF, DOC, DOCX, XLS, XLSX up to 10MB each</p>
                  </div>
                </div>

                {errors.upload && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800">
                    <p className="font-bold">⚠️ Upload Error</p>
                    <p className="mt-1 text-xs">{errors.upload || ''}</p>
                  </div>
                )}

                {/* Uploaded Files List */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Uploaded Documents ({uploadedFiles.length})</h4>
                    <div className="space-y-2">
                      {(uploadedFiles || []).map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{file.file_name || 'Unknown file'}</p>
                              <p className="text-xs text-gray-600">
                                Uploaded {new Date(file.uploaded_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-green-700 px-3 py-1 bg-green-100 rounded-full">
                            ✓ Uploaded
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submission Readiness Section - NOW THIRD */}
          {activeSection === 'readiness' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Submission Readiness</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Suggested Submission Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.suggested_date || ''}
                      onChange={(e) => updateField('suggested_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.suggested_date && (
                      <p className="mt-1 text-sm text-red-600">{errors.suggested_date || ''}</p>
                    )}
                  </div>

                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id="can_meet_date"
                      checked={!!formData.can_meet_date}
                      onChange={(e) => updateField('can_meet_date', e.target.checked)}
                      className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="can_meet_date" className="ml-2 text-sm text-gray-700">
                      Can meet suggested date
                    </label>
                  </div>

                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id="docs_ready"
                      checked={!!formData.docs_ready}
                      onChange={(e) => updateField('docs_ready', e.target.checked)}
                      className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="docs_ready" className="ml-2 text-sm text-gray-700">
                      All required documents are ready
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Comments / Notes
                    </label>
                    <textarea
                      value={formData.comments || ''}
                      onChange={(e) => updateField('comments', e.target.value)}
                      rows={4}
                      placeholder="Add any relevant notes about the documentation submission..."
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* Confirmation Section - NOW LAST */}
          {activeSection === 'confirmation' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Confirmation</h3>
                
                <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                  <h4 className="font-medium text-blue-900 mb-2">Submission Summary</h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-blue-700">Suggested Date:</dt>
                      <dd className="font-medium text-blue-900">
                        {formData.suggested_date || 'Not set'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-blue-700">Documents Checked:</dt>
                      <dd className="font-medium text-blue-900">
                        {countCheckedDocuments()} of {REQUIRED_DOCUMENTS.length}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-blue-700">Can Meet Date:</dt>
                      <dd className="font-medium text-blue-900">
                        {formData.can_meet_date ? 'Yes' : 'No'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-blue-700">Docs Ready:</dt>
                      <dd className="font-medium text-blue-900">
                        {formData.docs_ready ? 'Yes' : 'No'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="flex items-start p-4 bg-gray-50 border border-gray-200 rounded">
                  <input
                    type="checkbox"
                    id="acknowledgement"
                    checked={!!formData.acknowledgement}
                    onChange={(e) => updateField('acknowledgement', e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="acknowledgement" className="ml-2 text-sm text-gray-700">
                    <span className="font-medium">I acknowledge</span> that the documentation information provided is accurate
                    and complete to the best of my knowledge. <span className="text-red-500">*</span>
                  </label>
                </div>
                {errors.acknowledgement && (
                  <p className="mt-1 text-sm text-red-600">{errors.acknowledgement || ''}</p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between items-center">
            <div className="flex gap-4">
              {successMessage && (
                <div className="text-sm font-semibold text-green-800 bg-green-100 border border-green-300 px-6 py-3 rounded-lg shadow-sm">
                  {successMessage || ''}
                </div>
              )}
              {uploading && (
                <div className="text-sm font-semibold text-blue-800 bg-blue-100 border border-blue-300 px-6 py-3 rounded-lg shadow-sm">
                  📤 Uploading files...
                </div>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading || isReadOnly}
              className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Submitting...' : isReadOnly ? '🔒 Preview Mode - Cannot Submit' : 'Submit Documentation & Advance to Sample →'}
            </button>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
