'use client';

/**
 * V3.3A.3: Document Scope-Driven Execution
 * 
 * COMPLETE REWRITE:
 * - All documents rendered from documentScope (retrieved from PPAP_CREATED event)
 * - Mode-based behavior: generated, assisted, static, na
 * - Status tracking: not_started, in_progress, complete
 * - Completion enforcement: blocks progression until all required docs complete
 * - NO hardcoded document lists
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logEvent } from '@/src/features/events/mutations';
import { updatePPAPState } from '../utils/updatePPAPState';
import { currentUser } from '@/src/lib/mockUser';
import { uploadPPAPDocument } from '../utils/uploadFile';
import { getPPAPDocuments } from '../utils/getPPAPDocuments';
import { getDocumentScope } from '../utils/getDocumentScope';
import { CurrentTaskBanner } from './CurrentTaskBanner';
import { 
  DOCUMENT_REGISTRY, 
  MODE_LABELS, 
  MODE_BADGE_CLASSES,
  DocumentMode 
} from '../config/documentRegistry';
import {
  DocumentCardData,
  DocumentStatus,
  isActionableDocument,
  getActionLabel,
  areRequiredDocumentsComplete,
} from '../types/documentStatus';

interface DocumentationFormProps {
  ppapId: string;
  partNumber: string;
  initialSection?: string;
  isReadOnly?: boolean;
  currentPhase?: 'pre-ack' | 'post-ack';
}

export function DocumentationForm({ 
  ppapId, 
  partNumber, 
  initialSection, 
  isReadOnly = false, 
  currentPhase = 'post-ack' 
}: DocumentationFormProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');
  
  // Submission gate data
  const [suggestedDate, setSuggestedDate] = useState('');
  const [comments, setComments] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  
  const [isSectionExpanded, setIsSectionExpanded] = useState(true);
  const isActiveWorkZone = currentPhase === 'post-ack';

  // V3.3A.3: Load document scope and sync with uploaded files
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setLoading(true);
        
        // 1. Retrieve document scope from PPAP_CREATED event
        const scope = await getDocumentScope(ppapId);
        
        if (scope.length === 0) {
          console.warn('No document scope found - PPAP may be missing PPAP_CREATED event');
          setLoading(false);
          return;
        }

        // 2. Get uploaded files
        const uploadedFiles = await getPPAPDocuments(ppapId);
        
        // 3. Build document cards from scope
        const documentCards: DocumentCardData[] = scope
          .filter(entry => entry.required) // Only show required documents
          .map(entry => {
            const config = DOCUMENT_REGISTRY.find(d => d.id === entry.documentId);
            if (!config) {
              console.warn('Document config not found for', entry.documentId);
              return null;
            }

            // Check if file uploaded
            const uploadedFile = uploadedFiles.find(f => f.document_type === entry.documentId);
            
            // Determine status
            let status: DocumentStatus = 'not_started';
            if (uploadedFile) {
              status = 'complete';
            }

            return {
              documentId: entry.documentId,
              name: config.name,
              mode: entry.mode,
              owner: entry.owner,
              required: entry.required,
              status,
              filePath: uploadedFile?.file_path,
              fileName: uploadedFile?.file_name,
            };
          })
          .filter(Boolean) as DocumentCardData[];

        console.log('📋 Documents loaded from scope:', {
          total: documentCards.length,
          required: documentCards.filter(d => d.required).length,
          complete: documentCards.filter(d => d.status === 'complete').length,
        });

        setDocuments(documentCards);
      } catch (error) {
        console.error('Failed to load documents:', error);
        setErrors({ _form: 'Failed to load document configuration' });
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [ppapId]);

  // Calculate readiness
  const allRequiredComplete = areRequiredDocumentsComplete(documents);
  const completeCount = documents.filter(d => d.status === 'complete').length;
  const requiredCount = documents.filter(d => d.required && isActionableDocument(d.mode)).length;

  // Document upload handler
  const handleDocumentUpload = async (documentId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setErrors({});

    try {
      const file = files[0];
      
      const fileRef = await uploadPPAPDocument(file, ppapId);

      await logEvent({
        ppap_id: ppapId,
        event_type: 'DOCUMENT_ADDED',
        event_data: {
          file_name: file.name,
          file_path: fileRef.url,
          document_type: documentId,
        },
        actor: currentUser.name,
        actor_role: currentUser.role,
      });

      // Update document status
      setDocuments(prevDocs =>
        prevDocs.map(doc =>
          doc.documentId === documentId
            ? {
                ...doc,
                status: 'complete' as DocumentStatus,
                filePath: fileRef.url,
                fileName: file.name,
              }
            : doc
        )
      );

      setSuccessMessage(`✓ ${file.name} uploaded successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Upload failed:', error);
      setErrors({ [documentId]: error instanceof Error ? error.message : 'Upload failed' });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  // Submit handler
  const handleSubmit = async () => {
    setErrors({});
    setSuccessMessage('');

    const newErrors: Record<string, string> = {};
    
    if (!suggestedDate) {
      newErrors.suggested_date = 'Suggested submission date is required';
    }
    
    if (!acknowledged) {
      newErrors.acknowledgement = 'You must acknowledge the submission';
    }
    
    if (!allRequiredComplete) {
      newErrors._form = 'All required documents must be complete before submission';
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
          documents_complete: completeCount,
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

  // Render document action button based on mode
  const renderDocumentAction = (doc: DocumentCardData) => {
    switch (doc.mode) {
      case 'generated':
        return (
          <button
            onClick={() => router.push(`/ppap/${ppapId}/copilot?documentType=${doc.documentId}`)}
            disabled={isReadOnly}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            🤖 Generate with AI
          </button>
        );
      
      case 'assisted':
        // Special case for ballooned_drawing
        if (doc.documentId === 'ballooned_drawing') {
          return (
            <button
              onClick={() => router.push(`/ppap/${ppapId}/markup`)}
              disabled={isReadOnly}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              🖊️ Markup Tool
            </button>
          );
        }
        return (
          <button
            onClick={() => router.push(`/ppap/${ppapId}/documents`)}
            disabled={isReadOnly}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            📝 Open Workspace
          </button>
        );
      
      case 'static':
        return (
          <label className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg cursor-pointer text-center text-sm font-medium transition-colors">
            {doc.status === 'complete' ? '📤 Replace' : '📤 Upload'}
            <input
              type="file"
              className="sr-only"
              onChange={(e) => handleDocumentUpload(doc.documentId, e)}
              disabled={isReadOnly || uploading}
              accept=".pdf,.doc,.docx,.xls,.xlsx"
            />
          </label>
        );
      
      case 'na':
        return (
          <div className="flex-1 px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-center text-sm font-medium">
            N/A - Not Required
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-8">
        <div className="flex items-center justify-center gap-3">
          <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-600">Loading document configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Collapsed summary */}
      {!isActiveWorkZone && !isSectionExpanded && (
        <div className="px-6 py-4 text-sm text-gray-600">
          <p>Documents: {completeCount}/{documents.length} complete</p>
        </div>
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
              <p className="text-sm text-gray-600 mt-1">Execute document scope defined during PPAP creation</p>
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
              instruction="Complete all required documents according to configured scope"
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

            {/* V3.3A.3: SCOPE-DRIVEN DOCUMENT EXECUTION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-[color:var(--text-primary)]">Document Execution</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Scope-driven • {completeCount} of {requiredCount} required documents complete
                  </p>
                </div>
              </div>

              {documents.length === 0 && (
                <div className="p-8 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                  <p className="text-yellow-800 font-medium">No document scope configured</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    This PPAP may have been created before document scope was implemented.
                  </p>
                </div>
              )}

              {/* Document cards */}
              <div className="grid grid-cols-1 gap-4">
                {documents.map((doc) => (
                  <div
                    key={doc.documentId}
                    className={`border-2 rounded-lg p-4 transition-all ${
                      doc.status === 'complete'
                        ? 'border-green-400 bg-green-50'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {/* Title Row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-gray-900">{doc.name}</h4>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${MODE_BADGE_CLASSES[doc.mode]}`}>
                          {MODE_LABELS[doc.mode]}
                        </span>
                        {doc.owner && (
                          <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200">
                            👤 {doc.owner}
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          doc.status === 'complete'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {doc.status === 'complete' ? '✓ Complete' : 'Not Started'}
                      </span>
                    </div>

                    {/* File Info */}
                    {doc.fileName && (
                      <div className="mb-3 p-2 bg-white border border-green-300 rounded text-xs">
                        <p className="font-medium text-gray-900">📎 {doc.fileName}</p>
                      </div>
                    )}

                    {/* Mode-based action */}
                    <div className="flex gap-2">
                      {renderDocumentAction(doc)}
                    </div>

                    {/* Error Message */}
                    {errors[doc.documentId] && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                        {errors[doc.documentId]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* SUBMISSION GATE */}
            <div className={`border-2 rounded-lg p-6 transition-all ${
              allRequiredComplete 
                ? 'border-green-400 bg-green-50' 
                : 'border-gray-300 bg-gray-50'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{allRequiredComplete ? '🟢' : '🔴'}</span>
                <div>
                  <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Submission Gate</h3>
                  <p className="text-sm text-gray-600">
                    {allRequiredComplete 
                      ? 'Ready for submission - all required documents complete' 
                      : `Not ready - ${requiredCount - completeCount} required document(s) incomplete`}
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
                disabled={loading || isReadOnly || !allRequiredComplete || !acknowledged || !suggestedDate}
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
