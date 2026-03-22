'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logEvent } from '@/src/features/events/mutations';
import { updateWorkflowPhase } from '../mutations/updateWorkflowPhase';
import { WorkflowPhase } from '../constants/workflowPhases';

interface DocumentationFormProps {
  ppapId: string;
  partNumber: string;
  currentPhase: WorkflowPhase;
  setPhase: (phase: WorkflowPhase) => void;
}

type Section = 'readiness' | 'checklist' | 'confirmation';

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
  { key: 'dfmea', label: 'DFMEA' },
  { key: 'pfmea', label: 'PFMEA' },
  { key: 'control_plan', label: 'Control Plan' },
  { key: 'msa', label: 'MSA (Measurement System Analysis)' },
  { key: 'material_test_results', label: 'Material Test Results' },
  { key: 'initial_process_studies', label: 'Initial Process Studies' },
  { key: 'packaging', label: 'Packaging Specification' },
  { key: 'tooling', label: 'Tooling Documentation' },
] as const;

const SECTIONS = [
  { id: 'readiness', label: 'Submission Readiness' },
  { id: 'checklist', label: 'Required Documents' },
  { id: 'confirmation', label: 'Confirmation' },
] as const;

export function DocumentationForm({ ppapId, partNumber, currentPhase, setPhase }: DocumentationFormProps) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>('readiness');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

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
      
      // Update UI state after successful database update
      setTimeout(() => {
        setPhase('SAMPLE');
      }, 1500);
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
    <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-300 rounded-xl shadow-sm">
      <div className="border-b border-gray-200 px-8 py-6">
        <h2 className="text-2xl font-bold text-gray-900">Documentation Phase</h2>
        <p className="text-sm text-gray-600 mt-1">
          Part Number: <span className="font-medium">{partNumber || ''}</span>
        </p>
      </div>

      <div className="flex">
        {/* Sidebar Navigation */}
        <div className="w-64 border-r border-gray-200 bg-gray-50">
          <div className="p-8 space-y-8">
            {SECTIONS.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as Section)}
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

          {/* Submission Readiness Section */}
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

          {/* Required Documents Checklist Section */}
          {activeSection === 'checklist' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">Required Documents Checklist</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Check all documents that are included in this submission.
                  <span className="block mt-1 font-medium">
                    {countCheckedDocuments()} of {REQUIRED_DOCUMENTS.length} documents checked
                  </span>
                </p>
                
                <div className="space-y-3">
                  {REQUIRED_DOCUMENTS.map(doc => (
                    <div key={doc.key} className="flex items-start">
                      <input
                        type="checkbox"
                        id={doc.key}
                        checked={!!formData[doc.key as keyof DocumentationData]}
                        onChange={(e) => updateField(doc.key as keyof DocumentationData, e.target.checked)}
                        className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor={doc.key} className="ml-2 text-sm text-gray-700">
                        {doc.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Section */}
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
            <div>
              {successMessage && (
                <div className="text-sm font-semibold text-green-800 bg-green-100 border border-green-300 px-6 py-3 rounded-lg shadow-sm">
                  {successMessage || ''}
                </div>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Submitting...' : 'Submit Documentation & Advance to Sample →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
