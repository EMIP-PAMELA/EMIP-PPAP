'use client';

/**
 * Phase 3H.14: Simplified Document Workflow
 * 
 * REMOVED:
 * - Required Documents Checklist (user should not select requirements)
 * - Sidebar navigation (checklist/upload/readiness/confirmation)
 * - Fake checkboxes (docs_ready, can_meet_date)
 * - Duplicate upload sections
 * 
 * NEW STRUCTURE:
 * - Unified Document Execution panel (system-driven)
 * - Submission Gate (merged readiness + confirmation)
 * - System-calculated readiness
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logEvent } from '@/src/features/events/mutations';
import { updatePPAPState } from '../utils/updatePPAPState';
import { currentUser } from '@/src/lib/mockUser';
import { uploadPPAPDocument } from '../utils/uploadFile';
import { getPPAPDocuments } from '../utils/getPPAPDocuments';
import { MarkupTool } from './MarkupTool';
import { CurrentTaskBanner } from './CurrentTaskBanner';

interface DocumentationFormProps {
  ppapId: string;
  partNumber: string;
  initialSection?: string; // Phase 3H.14: Deprecated, kept for compatibility
  isReadOnly?: boolean;
  currentPhase?: 'pre-ack' | 'post-ack';
}

type DocumentAction = 'upload' | 'create';

interface DocumentItem {
  id: string;
  name: string;
  requirement_level: 'REQUIRED' | 'CONDITIONAL';
  status: 'missing' | 'ready';
  actions: DocumentAction[];
  file?: {
    name: string;
    uploaded_at: string;
  };
}

interface UploadedFile {
  file_name: string;
  file_path: string;
  document_type: string;
  uploaded_at: string;
}

// Phase 3H.14: Document configuration - system determines requirements
const DOCUMENT_CONFIG: DocumentItem[] = [
  { id: 'ballooned_drawing', name: 'Ballooned Drawing', requirement_level: 'REQUIRED', status: 'missing', actions: ['upload', 'create'] },
  { id: 'design_record', name: 'Design Record', requirement_level: 'REQUIRED', status: 'missing', actions: ['upload', 'create'] },
  { id: 'dimensional_results', name: 'Dimensional Results', requirement_level: 'REQUIRED', status: 'missing', actions: ['upload', 'create'] },
  { id: 'dfmea', name: 'DFMEA', requirement_level: 'REQUIRED', status: 'missing', actions: ['upload', 'create'] },
  { id: 'pfmea', name: 'PFMEA', requirement_level: 'REQUIRED', status: 'missing', actions: ['upload', 'create'] },
  { id: 'control_plan', name: 'Control Plan', requirement_level: 'REQUIRED', status: 'missing', actions: ['upload', 'create'] },
  { id: 'msa', name: 'MSA', requirement_level: 'REQUIRED', status: 'missing', actions: ['upload', 'create'] },
  { id: 'material_test_results', name: 'Material Test Results', requirement_level: 'REQUIRED', status: 'missing', actions: ['upload', 'create'] },
  { id: 'initial_process_studies', name: 'Initial Process Studies', requirement_level: 'REQUIRED', status: 'missing', actions: ['upload', 'create'] },
  { id: 'packaging', name: 'Packaging Specification', requirement_level: 'CONDITIONAL', status: 'missing', actions: ['upload', 'create'] },
  { id: 'tooling', name: 'Tooling Documentation', requirement_level: 'CONDITIONAL', status: 'missing', actions: ['upload', 'create'] },
];

// Phase 3H.14: Template availability check
const canCreate = (docId: string): boolean => {
  return [
    'ballooned_drawing',
    'control_plan',
    'dfmea',
    'pfmea',
    'msa',
    'dimensional_results',
  ].includes(docId);
};

export function DocumentationForm({ ppapId, partNumber, initialSection, isReadOnly = false, currentPhase = 'post-ack' }: DocumentationFormProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentItem[]>(DOCUMENT_CONFIG);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [showMarkupTool, setShowMarkupTool] = useState(false);
  
  // Phase 3H.14: Submission gate data (simplified)
  const [suggestedDate, setSuggestedDate] = useState('');
  const [comments, setComments] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  
  // Phase 3H.1: Active work zone
  const [isSectionExpanded, setIsSectionExpanded] = useState(true);
  const isActiveWorkZone = currentPhase === 'post-ack';

  // Phase 3H.14: System-calculated readiness
  const allDocsReady = documents.filter(d => d.requirement_level === 'REQUIRED').every(d => d.status === 'ready');
  const readyCount = documents.filter(d => d.status === 'ready').length;
  const totalRequired = documents.filter(d => d.requirement_level === 'REQUIRED').length;

  // Fetch uploaded files and sync with document state
  useEffect(() => {
    const fetchUploadedFiles = async () => {
      try {
        const docs = await getPPAPDocuments(ppapId);
        console.log('📂 Documents loaded:', docs.length);
        
        const files = docs.map(doc => ({
          file_name: doc.file_name,
          file_path: doc.file_path,
          document_type: doc.document_type || 'general',
          uploaded_at: new Date().toISOString(),
        }));

        // Update document status based on uploaded files
        setDocuments(prevDocs => 
          prevDocs.map(doc => {
            const uploadedFile = files.find(f => f.document_type === doc.id);
            if (uploadedFile) {
              return {
                ...doc,
                status: 'ready' as const,
                file: {
                  name: uploadedFile.file_name,
                  uploaded_at: uploadedFile.uploaded_at,
                },
              };
            }
            return doc;
          })
        );
      } catch (error) {
        console.error('Failed to fetch uploaded files:', error);
      }
    };

    fetchUploadedFiles();
  }, [ppapId]);

  // Document upload handler
  const handleDocumentUpload = async (documentId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setErrors({});

    try {
      const file = files[0];
      
      console.log('📄 DOCUMENT UPLOADED', {
        documentType: documentId,
        fileName: file.name,
        timestamp: new Date().toISOString(),
      });

      const filePath = await uploadPPAPDocument(file, ppapId);

      await logEvent({
        ppap_id: ppapId,
        event_type: 'DOCUMENT_ADDED',
        event_data: {
          file_name: file.name,
          file_path: filePath,
          document_type: documentId,
        },
        actor: currentUser.name,
        actor_role: currentUser.role,
      });

      setDocuments(prevDocs =>
        prevDocs.map(doc =>
          doc.id === documentId
            ? {
                ...doc,
                status: 'ready' as const,
                file: {
                  name: file.name,
                  uploaded_at: new Date().toISOString(),
                },
              }
            : doc
        )
      );

      setSuccessMessage(`Successfully uploaded ${file.name}`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Upload failed:', error);
      setErrors({ [documentId]: error instanceof Error ? error.message : 'Upload failed' });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  // Phase 3H.15: Create document handler - reuses markup tool for balloon drawing
  const handleCreateDocument = (documentId: string) => {
    console.log('🛠 DOCUMENT ACTION CLICK', { docId: documentId, action: 'create' });
    
    // Phase 3H.15: Balloon drawing opens markup tool (reuse existing function)
    if (documentId === 'ballooned_drawing') {
      setShowMarkupTool(true);
      return;
    }
    
    // Phase 3H.15: Check if template is available
    if (!canCreate(documentId)) {
      console.warn('⚠️ TEMPLATE NOT AVAILABLE', { docType: documentId });
      alert('Template coming soon — you can upload a document instead');
      return;
    }
    
    // Routes for available templates
    const routes: Record<string, string> = {
      control_plan: `/tools/control-plan?ppapId=${ppapId}`,
      dfmea: `/tools/dfmea?ppapId=${ppapId}`,
      pfmea: `/tools/pfmea?ppapId=${ppapId}`,
      msa: `/tools/msa?ppapId=${ppapId}`,
      dimensional_results: `/tools/dimensional-results?ppapId=${ppapId}`,
    };
    
    if (routes[documentId]) {
      router.push(routes[documentId]);
    }
  };

  // Submit handler
  const handleSubmit = async () => {
    setErrors({});
    setSuccessMessage('');

    // Phase 3H.14: Validation
    const newErrors: Record<string, string> = {};
    
    if (!suggestedDate) {
      newErrors.suggested_date = 'Suggested submission date is required';
    }
    
    if (!acknowledged) {
      newErrors.acknowledgement = 'You must acknowledge the submission';
    }
    
    if (!allDocsReady) {
      newErrors._form = 'All required documents must be uploaded before submission';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      await logEvent({
        ppap_id: ppapId,
        event_type: 'DOCUMENTATION_SUBMITTED',
        event_data: {
          submission_date: suggestedDate,
          comments: comments,
          documents_ready: readyCount,
          total_documents: documents.length,
        },
        actor: currentUser.name,
        actor_role: currentUser.role,
      });

      const result = await updatePPAPState(
        ppapId,
        'AWAITING_SUBMISSION',
        currentUser.id,
        currentUser.role
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to update PPAP status');
      }

      setSuccessMessage('✓ Documentation phase completed! Advancing to Sample phase...');
      router.refresh();
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

  return (
    <>
      {/* Collapsed summary */}
      {!isActiveWorkZone && !isSectionExpanded && (
        <div className="px-6 py-4 text-sm text-gray-600">
          <p>Documents: {readyCount}/{documents.length} ready</p>
        </div>
      )}

      {showMarkupTool && (
        <MarkupTool
          ppapId={ppapId}
          partNumber={partNumber}
          onClose={() => setShowMarkupTool(false)}
        />
      )}

      <div className={`bg-white rounded-lg shadow-sm border transition-all ${
        isActiveWorkZone 
          ? 'border-2 border-blue-400' 
          : 'border border-gray-300'
      }`}>
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-lg font-semibold ${
                isActiveWorkZone ? 'text-blue-900' : 'text-gray-600'
              }`}>
                {isActiveWorkZone ? '📄 ' : ''}Documentation Phase
              </h2>
              <p className="text-sm text-gray-600 mt-1">Prepare and upload required PPAP documentation</p>
            </div>
            {!isActiveWorkZone && (
              <button
                onClick={() => setIsSectionExpanded(!isSectionExpanded)}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              >
                {isSectionExpanded ? '▼ Collapse' : '▶ Expand'}
              </button>
            )}
          </div>
        </div>
        
        {/* Current Task Banner */}
        {isActiveWorkZone && (
          <div className="px-6 pt-4">
            <CurrentTaskBanner
              phase="Post-Acknowledgement"
              currentStep="Document Execution"
              instruction="Upload required documents or create from templates"
              icon="📄"
            />
          </div>
        )}
        
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

        {/* Collapsible content */}
        {(isActiveWorkZone || isSectionExpanded) && (
          <div className="p-6 space-y-8">
            {/* Error display */}
            {errors._form && (
              <div className="p-4 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800 font-medium">
                {errors._form}
              </div>
            )}

            {/* Phase 3H.14: UNIFIED DOCUMENT EXECUTION PANEL */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Document Execution</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    System-determined required documents • {readyCount} of {totalRequired} required documents ready
                  </p>
                </div>
                <button
                  onClick={() => setShowMarkupTool(true)}
                  disabled={isReadOnly}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  🖊️ Open Markup Tool
                </button>
              </div>

              {/* Document cards */}
              <div className="grid grid-cols-1 gap-4">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`border rounded-lg p-4 transition-all ${
                      doc.status === 'ready'
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {/* Title Row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-gray-900">{doc.name}</h4>
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded ${
                            doc.requirement_level === 'REQUIRED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {doc.requirement_level}
                        </span>
                        {/* Phase 3H.15: Template availability badge */}
                        {!canCreate(doc.id) && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-700">
                            Template Coming Soon
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          doc.status === 'ready'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {doc.status === 'ready' ? '✓ Ready' : 'Missing'}
                      </span>
                    </div>

                    {/* File Info */}
                    {doc.file && (
                      <div className="mb-3 p-2 bg-white border border-green-200 rounded text-xs">
                        <p className="font-medium text-gray-900">{doc.file.name}</p>
                        <p className="text-gray-600">
                          Uploaded {new Date(doc.file.uploaded_at).toLocaleString()}
                        </p>
                      </div>
                    )}

                    {/* Phase 3H.15: Actions Row - all buttons actionable */}
                    <div className="flex gap-2">
                      {/* Phase 3H.12: Create Button - clear state explanations */}
                      <button
                        onClick={() => handleCreateDocument(doc.id)}
                        disabled={isReadOnly}
                        title={
                          isReadOnly
                            ? 'View-only mode - editing disabled'
                            : canCreate(doc.id)
                            ? `Create ${doc.name} from template`
                            : `Template for ${doc.name} coming soon — click to see options`
                        }
                        className={`flex-1 px-4 py-2 text-sm font-medium rounded transition-colors ${
                          isReadOnly
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        🛠 {canCreate(doc.id) ? 'Create' : 'Create (Soon)'}
                      </button>
                      
                      {/* Phase 3H.12: Upload Button - clear state explanations */}
                      <label
                        title={
                          isReadOnly
                            ? 'View-only mode - uploading disabled'
                            : uploading
                            ? 'Upload in progress...'
                            : doc.status === 'ready'
                            ? `Replace existing ${doc.name} file`
                            : `Upload ${doc.name} file (PDF, Word, Excel)`
                        }
                        className={`flex-1 px-4 py-2 text-sm font-medium text-center rounded transition-colors ${
                          isReadOnly || uploading
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-pointer'
                        }`}
                      >
                        {uploading ? '⏳ Uploading...' : doc.status === 'ready' ? '📤 Replace' : '📤 Upload'}
                        <input
                          type="file"
                          className="sr-only"
                          onChange={(e) => handleDocumentUpload(doc.id, e)}
                          disabled={isReadOnly || uploading}
                          accept=".pdf,.doc,.docx,.xls,.xlsx"
                        />
                      </label>
                    </div>

                    {/* Error Message */}
                    {errors[doc.id] && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                        {errors[doc.id]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Phase 3H.14: SUBMISSION GATE (merged readiness + confirmation) */}
            <div className={`border-2 rounded-lg p-6 transition-all ${
              allDocsReady 
                ? 'border-green-400 bg-green-50' 
                : 'border-gray-300 bg-gray-50'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{allDocsReady ? '🟢' : '🔴'}</span>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Submission Gate</h3>
                  <p className="text-sm text-gray-600">
                    {allDocsReady 
                      ? 'Ready for submission - all required documents uploaded' 
                      : `Not ready - ${totalRequired - readyCount} required document(s) missing`}
                  </p>
                </div>
              </div>

              {/* Suggested Date */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Suggested Submission Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={suggestedDate}
                  onChange={(e) => setSuggestedDate(e.target.value)}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                />
                {errors.suggested_date && (
                  <p className="mt-1 text-sm text-red-600">{errors.suggested_date}</p>
                )}
              </div>

              {/* Comments */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comments / Notes
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  disabled={isReadOnly}
                  rows={3}
                  placeholder="Add any relevant notes about the documentation submission..."
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                />
              </div>

              {/* Acknowledgement */}
              <div className="flex items-start p-4 bg-white border border-gray-300 rounded">
                <input
                  type="checkbox"
                  id="acknowledgement"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  disabled={isReadOnly}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                />
                <label htmlFor="acknowledgement" className="ml-2 text-sm text-gray-700">
                  <span className="font-medium">I acknowledge</span> that the documentation information provided is accurate
                  and complete to the best of my knowledge. <span className="text-red-500">*</span>
                </label>
              </div>
              {errors.acknowledgement && (
                <p className="mt-1 text-sm text-red-600">{errors.acknowledgement}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-6 border-t border-gray-200 flex justify-between items-center">
              <div className="flex gap-4">
                {successMessage && (
                  <div className="text-sm font-semibold text-green-800 bg-green-100 border border-green-300 px-6 py-3 rounded-lg shadow-sm">
                    {successMessage}
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
                disabled={loading || isReadOnly || !allDocsReady || !acknowledged || !suggestedDate}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {loading ? 'Submitting...' : isReadOnly ? '🔒 Preview Mode' : 'Submit Documentation & Advance to Sample →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
