'use client';

/**
 * Phase 3H.6: PPAP Control Panel
 * Phase 3H.13: Document editing enabled for all users + Create action system
 * 
 * Full system visibility + management for ONE PPAP
 * Manager-focused control interface (vs operator-focused workflow)
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PPAPRecord } from '@/src/types/database.types';
import { currentUser } from '@/src/lib/mockUser';
import { calculateDocumentProgress, getHealthStatus, getHealthBadgeStyle, getHealthBadgeIcon, getStatusClarityTag, openBalloonTool } from '../utils/documentHelpers';
import { getPPAPDocuments, PPAPDocument } from '../utils/getPPAPDocuments';
import { uploadPPAPDocument } from '../utils/uploadFile';
import { updatePPAPState } from '../utils/updatePPAPState';
import { getValidations } from '../utils/validationDatabase';
import { logEvent } from '@/src/features/events/mutations';

interface PPAPControlPanelProps {
  ppap: PPAPRecord;
}

// Document configuration (matches DocumentationForm)
const ALL_DOCUMENTS = [
  { id: 'ballooned_drawing', name: 'Ballooned Drawing', requirement_level: 'REQUIRED' },
  { id: 'design_record', name: 'Design Record', requirement_level: 'REQUIRED' },
  { id: 'dimensional_results', name: 'Dimensional Results', requirement_level: 'REQUIRED' },
  { id: 'dfmea', name: 'DFMEA', requirement_level: 'REQUIRED' },
  { id: 'pfmea', name: 'PFMEA', requirement_level: 'REQUIRED' },
  { id: 'control_plan', name: 'Control Plan', requirement_level: 'REQUIRED' },
  { id: 'msa', name: 'MSA', requirement_level: 'REQUIRED' },
  { id: 'material_test_results', name: 'Material Test Results', requirement_level: 'REQUIRED' },
  { id: 'initial_process_studies', name: 'Initial Process Studies', requirement_level: 'REQUIRED' },
  { id: 'packaging', name: 'Packaging Specification', requirement_level: 'CONDITIONAL' },
  { id: 'tooling', name: 'Tooling Documentation', requirement_level: 'CONDITIONAL' },
];

export function PPAPControlPanel({ ppap }: PPAPControlPanelProps) {
  const router = useRouter();
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, any>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [validationSummary, setValidationSummary] = useState({ preAck: { complete: 0, total: 0 }, postAck: { complete: 0, total: 0 } });
  
  // Phase 3H.13: Split permissions - workflow vs document editing
  const canManageWorkflow = currentUser.role === 'coordinator' || currentUser.role === 'admin';
  const canEditDocuments = true; // ALL USERS can edit documents
  
  // Fetch uploaded documents
  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const docs = await getPPAPDocuments(ppap.id);
        const docsMap: Record<string, PPAPDocument> = {};
        docs.forEach((doc: PPAPDocument) => {
          if (doc.document_type) {
            docsMap[doc.document_type] = doc;
          }
        });
        setUploadedDocs(docsMap);
      } catch (err) {
        console.error('Failed to fetch documents:', err);
      }
    };
    fetchDocs();
  }, [ppap.id]);
  
  // Fetch validation summary
  useEffect(() => {
    const fetchValidations = async () => {
      try {
        const validations = await getValidations(ppap.id);
        const preAck = validations.filter(v => v.category === 'pre-ack');
        const postAck = validations.filter(v => v.category === 'post-ack');
        
        setValidationSummary({
          preAck: {
            complete: preAck.filter(v => v.status === 'complete' || v.status === 'approved').length,
            total: preAck.length
          },
          postAck: {
            complete: postAck.filter(v => v.status === 'complete' || v.status === 'approved').length,
            total: postAck.length
          }
        });
      } catch (err) {
        console.error('Failed to fetch validations:', err);
      }
    };
    fetchValidations();
  }, [ppap.id]);
  
  // Phase 3H.13: Template availability check
  const canCreate = (docType: string): boolean => {
    return [
      'ballooned_drawing',
      'control_plan',
      'dfmea',
      'pfmea',
      'msa',
      'dimensional_results',
    ].includes(docType);
  };
  
  // Phase 3H.13: Create document routing
  const handleCreateDocument = (docType: string) => {
    // Phase 3H.13: Log document action
    console.log('📄 DOCUMENT ACTION CLICK', {
      docType,
      action: 'create',
      userRole: currentUser.role,
    });
    
    console.log('🛠 CREATE DOCUMENT', { docType, ppapId: ppap.id });
    
    // Phase 3H.13.5: Use unified balloon tool helper (ONE system)
    if (docType === 'ballooned_drawing') {
      openBalloonTool(ppap.id);
      return;
    }
    
    const routes: Record<string, string> = {
      control_plan: `/tools/control-plan?ppapId=${ppap.id}`,
      dfmea: `/tools/dfmea?ppapId=${ppap.id}`,
      pfmea: `/tools/pfmea?ppapId=${ppap.id}`,
      msa: `/tools/msa?ppapId=${ppap.id}`,
      dimensional_results: `/tools/dimensional-results?ppapId=${ppap.id}`,
    };
    
    if (routes[docType]) {
      router.push(routes[docType]);
    } else {
      console.warn('⚠️ TEMPLATE NOT AVAILABLE', { docType });
      alert('Template coming soon — you can upload a document instead');
    }
  };
  
  const handleUpload = async (docId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Phase 3H.13: Log document action
    console.log('📄 DOCUMENT ACTION CLICK', {
      docType: docId,
      action: 'upload',
      userRole: currentUser.role,
    });
    
    setUploading(docId);
    try {
      const filePath = await uploadPPAPDocument(file, ppap.id);
      
      // Log document added event
      await logEvent({
        ppap_id: ppap.id,
        event_type: 'DOCUMENT_ADDED',
        event_data: {
          file_name: file.name,
          file_path: filePath,
          document_type: docId
        },
        actor: currentUser.name,
        actor_role: currentUser.role
      });
      
      // Refresh documents
      const docs = await getPPAPDocuments(ppap.id);
      const docsMap: Record<string, PPAPDocument> = {};
      docs.forEach((doc: PPAPDocument) => {
        if (doc.document_type) {
          docsMap[doc.document_type] = doc;
        }
      });
      setUploadedDocs(docsMap);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed');
    } finally {
      setUploading(null);
    }
  };
  
  const handleAdvancePhase = async () => {
    if (!confirm('Advance to next phase?')) return;
    
    try {
      // Determine next status based on current
      let nextStatus = ppap.status;
      
      if (ppap.status === 'NEW') nextStatus = 'PRE_ACK_ASSIGNED';
      else if (ppap.status === 'PRE_ACK_ASSIGNED') nextStatus = 'PRE_ACK_IN_PROGRESS';
      else if (ppap.status === 'PRE_ACK_IN_PROGRESS') nextStatus = 'READY_TO_ACKNOWLEDGE';
      else if (ppap.status === 'READY_TO_ACKNOWLEDGE') nextStatus = 'POST_ACK_IN_PROGRESS';
      else if (ppap.status === 'POST_ACK_IN_PROGRESS') nextStatus = 'AWAITING_SUBMISSION';
      else if (ppap.status === 'AWAITING_SUBMISSION') nextStatus = 'SUBMITTED';
      
      await updatePPAPState(ppap.id, nextStatus, currentUser.id, currentUser.role);
      window.location.reload();
    } catch (err) {
      console.error('Failed to advance phase:', err);
      alert('Failed to advance phase');
    }
  };
  
  const handleApprove = async () => {
    if (!confirm('Approve this PPAP?')) return;
    
    try {
      await updatePPAPState(ppap.id, 'APPROVED', currentUser.id, currentUser.role);
      window.location.reload();
    } catch (err) {
      console.error('Failed to approve:', err);
      alert('Failed to approve');
    }
  };
  
  const handleReject = async () => {
    if (!confirm('Reject/Close this PPAP?')) return;
    
    try {
      await updatePPAPState(ppap.id, 'CLOSED', currentUser.id, currentUser.role);
      window.location.reload();
    } catch (err) {
      console.error('Failed to reject:', err);
      alert('Failed to reject');
    }
  };
  
  const docProgress = calculateDocumentProgress(ppap);
  const healthStatus = getHealthStatus(ppap, docProgress);
  const clarityTag = getStatusClarityTag(ppap.status);
  const completionPercentage = Math.round(((validationSummary.preAck.complete + validationSummary.postAck.complete + docProgress.complete) / (validationSummary.preAck.total + validationSummary.postAck.total + docProgress.total)) * 100) || 0;
  
  return (
    <div className="space-y-6">
      {/* Phase 3H.6: Header Summary */}
      <div className="bg-gradient-to-r from-gray-50 to-white border-2 border-gray-300 rounded-xl shadow-md p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{ppap.ppap_number}</h1>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Part Number:</span>{' '}
                <span className="font-semibold">{ppap.part_number}</span>
              </div>
              <div>
                <span className="text-gray-600">Customer:</span>{' '}
                <span className="font-semibold">{ppap.customer_name}</span>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>{' '}
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-800">
                  {ppap.status}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Clarity:</span>{' '}
                <span className="text-sm italic">{clarityTag}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <span className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-bold border-2 ${getHealthBadgeStyle(healthStatus)}`}>
              <span className="text-lg">{getHealthBadgeIcon(healthStatus)}</span>
              <span>{healthStatus}</span>
            </span>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">{completionPercentage}%</div>
              <div className="text-xs text-gray-600">Complete</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Phase 3H.6: Validation Summary */}
      <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Validation Summary</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Pre-Acknowledgement</div>
            <div className="text-xl font-bold text-blue-900">
              {validationSummary.preAck.complete} / {validationSummary.preAck.total}
            </div>
          </div>
          <div className="p-3 bg-purple-50 border border-purple-200 rounded">
            <div className="text-xs font-semibold text-purple-700 uppercase mb-1">Post-Acknowledgement</div>
            <div className="text-xl font-bold text-purple-900">
              {validationSummary.postAck.complete} / {validationSummary.postAck.total}
            </div>
          </div>
        </div>
      </div>
      
      {/* Phase 3H.6: Document Matrix */}
      <div className="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
        <div className="bg-gray-100 border-b border-gray-300 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Document Matrix</h2>
          <p className="text-sm text-gray-600 mt-1">All documents in one place</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Document Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Requirement</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">File Info</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ALL_DOCUMENTS.map(doc => {
                const uploadedDoc = uploadedDocs[doc.id];
                const isUploaded = !!uploadedDoc;
                const isUploading = uploading === doc.id;
                
                return (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {doc.name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        doc.requirement_level === 'REQUIRED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {doc.requirement_level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        isUploaded
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {isUploaded ? '✓ Ready' : 'Missing'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {uploadedDoc ? (
                        <div>
                          <div className="font-medium">{uploadedDoc.file_name}</div>
                          <div className="text-gray-500">
                            {new Date(uploadedDoc.uploaded_at).toLocaleDateString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {/* Phase 3H.13: Create Action */}
                        <button
                          onClick={() => handleCreateDocument(doc.id)}
                          disabled={!canCreate(doc.id)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                            canCreate(doc.id)
                              ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                          title={canCreate(doc.id) ? 'Create from template' : 'Template coming soon'}
                        >
                          🛠 Create
                        </button>
                        
                        {/* Upload Action */}
                        <label
                          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                            isUploading
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-pointer'
                          }`}
                          title={isUploaded ? 'Replace File' : 'Upload'}
                        >
                          {isUploading ? '⏳ Uploading...' : isUploaded ? '📤 Replace' : '📤 Upload'}
                          <input
                            type="file"
                            className="sr-only"
                            onChange={(e) => handleUpload(doc.id, e)}
                            disabled={isUploading}
                            accept=".pdf,.doc,.docx,.xls,.xlsx"
                          />
                        </label>
                        
                        {/* View Action (if file exists) */}
                        {uploadedDoc && (
                          <a
                            href={uploadedDoc.file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-xs font-semibold rounded bg-gray-600 text-white hover:bg-gray-700"
                          >
                            👁️ View
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Phase 3H.6: Action Bar (Manager Controls) */}
      {canManageWorkflow && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-lg shadow-md p-6">
          <h2 className="text-lg font-bold text-amber-900 mb-4">🎛️ Manager Controls</h2>
          <div className="flex gap-3">
            <button
              onClick={handleAdvancePhase}
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              ➡️ Advance Phase
            </button>
            <button
              onClick={handleApprove}
              className="px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors shadow-sm"
            >
              ✓ Approve
            </button>
            <button
              onClick={handleReject}
              className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm"
            >
              ✗ Reject
            </button>
          </div>
          <p className="text-xs text-amber-700 mt-3">
            Manager actions will update PPAP state and log events.
          </p>
        </div>
      )}
      
      {/* Phase 3H.13: Updated permission banner */}
      {!canManageWorkflow && (
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 text-center">
          <p className="text-sm text-blue-800">
            � <strong>Document Editing Enabled</strong> — All users can upload and create documents. Workflow actions are restricted to coordinators.
          </p>
        </div>
      )}
    </div>
  );
}
