'use client';

import { useState } from 'react';
import { logEvent } from '@/src/features/events/mutations';
import { updateWorkflowPhase } from '../mutations/updateWorkflowPhase';
import { WorkflowPhase } from '../constants/workflowPhases';

interface ReviewFormProps {
  ppapId: string;
  partNumber: string;
  currentPhase: WorkflowPhase;
  setPhase: (phase: WorkflowPhase) => void;
}

type ReviewDecision = 'APPROVE' | 'REJECT' | 'CORRECTIONS_NEEDED';

interface ReviewData {
  decision: ReviewDecision | '';
  reviewer_comments: string;
  acknowledgement: boolean;
}

export function ReviewForm({ ppapId, partNumber, currentPhase, setPhase }: ReviewFormProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState<ReviewData>({
    decision: '',
    reviewer_comments: '',
    acknowledgement: false,
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.decision) {
      newErrors.decision = 'You must select a review decision';
    }

    if (!formData.reviewer_comments.trim()) {
      newErrors.reviewer_comments = 'Reviewer comments are required';
    }

    if (!formData.acknowledgement) {
      newErrors.acknowledgement = 'You must acknowledge the review';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getNextPhase = (decision: ReviewDecision): WorkflowPhase => {
    switch (decision) {
      case 'APPROVE':
        return 'COMPLETE';
      case 'REJECT':
        return 'DOCUMENTATION';
      case 'CORRECTIONS_NEEDED':
        return 'SAMPLE';
      default:
        return 'COMPLETE';
    }
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
      // Log REVIEW_COMPLETED event
      await logEvent({
        ppap_id: ppapId,
        event_type: 'REVIEW_COMPLETED',
        event_data: {
          decision: formData.decision,
          reviewer_comments: formData.reviewer_comments,
          all_form_data: formData,
        },
        actor: 'Matt',
        actor_role: 'Engineer',
      });

      // Determine next phase based on decision
      const nextPhase = getNextPhase(formData.decision as ReviewDecision);

      // Persist phase change to database
      await updateWorkflowPhase({
        ppapId,
        fromPhase: currentPhase,
        toPhase: nextPhase,
        actor: 'Matt',
        additionalData: {
          review_data: formData,
          decision: formData.decision,
        },
      });

      const phaseMessages: Record<ReviewDecision, string> = {
        APPROVE: '✓ Review completed! PPAP APPROVED. Advancing to COMPLETE phase...',
        REJECT: '✓ Review completed! PPAP REJECTED. Returning to DOCUMENTATION phase...',
        CORRECTIONS_NEEDED: '✓ Review completed! Corrections needed. Returning to SAMPLE phase...',
      };

      setSuccessMessage(phaseMessages[formData.decision as ReviewDecision] || '');
      
      // Update UI state after successful database update
      setTimeout(() => {
        setPhase(nextPhase);
      }, 1500);
    } catch (error) {
      console.error('Failed to submit review:', error);
      setErrors({ 
        _form: error instanceof Error 
          ? `Failed to submit review: ${error.message}` 
          : 'Failed to submit review. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof ReviewData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Review Phase</h2>
        <p className="text-sm text-gray-600 mt-1">
          Part Number: <span className="font-medium">{partNumber || ''}</span>
        </p>
      </div>

      <div className="p-6 space-y-6">
        {errors._form && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {errors._form || ''}
          </div>
        )}

        {/* Submission Summary Section */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3">Submission Summary</h3>
          <div className="space-y-3">
            <div className="flex items-start p-3 bg-green-50 border border-green-200 rounded">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">Initiation Phase Complete</p>
                <p className="text-xs text-green-700 mt-1">Project information and initial requirements captured.</p>
              </div>
            </div>

            <div className="flex items-start p-3 bg-green-50 border border-green-200 rounded">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">Documentation Phase Complete</p>
                <p className="text-xs text-green-700 mt-1">Required documents submitted and acknowledged.</p>
              </div>
            </div>

            <div className="flex items-start p-3 bg-green-50 border border-green-200 rounded">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">Sample Phase Complete</p>
                <p className="text-xs text-green-700 mt-1">Sample information and shipment details provided.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Review Decision Section */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3">Review Decision <span className="text-red-500">*</span></h3>
          <div className="space-y-3">
            <div className="flex items-start">
              <input
                type="radio"
                id="decision_approve"
                name="decision"
                value="APPROVE"
                checked={formData.decision === 'APPROVE'}
                onChange={(e) => updateField('decision', e.target.value)}
                className="mt-1 h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
              />
              <label htmlFor="decision_approve" className="ml-2 text-sm">
                <span className="font-medium text-green-700">Approve</span>
                <span className="block text-gray-600 text-xs mt-0.5">
                  PPAP meets all requirements. Advance to COMPLETE phase.
                </span>
              </label>
            </div>

            <div className="flex items-start">
              <input
                type="radio"
                id="decision_reject"
                name="decision"
                value="REJECT"
                checked={formData.decision === 'REJECT'}
                onChange={(e) => updateField('decision', e.target.value)}
                className="mt-1 h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
              />
              <label htmlFor="decision_reject" className="ml-2 text-sm">
                <span className="font-medium text-red-700">Reject</span>
                <span className="block text-gray-600 text-xs mt-0.5">
                  PPAP does not meet requirements. Return to DOCUMENTATION phase.
                </span>
              </label>
            </div>

            <div className="flex items-start">
              <input
                type="radio"
                id="decision_corrections"
                name="decision"
                value="CORRECTIONS_NEEDED"
                checked={formData.decision === 'CORRECTIONS_NEEDED'}
                onChange={(e) => updateField('decision', e.target.value)}
                className="mt-1 h-4 w-4 text-yellow-600 border-gray-300 focus:ring-yellow-500"
              />
              <label htmlFor="decision_corrections" className="ml-2 text-sm">
                <span className="font-medium text-yellow-700">Corrections Needed</span>
                <span className="block text-gray-600 text-xs mt-0.5">
                  Minor corrections required. Return to SAMPLE phase.
                </span>
              </label>
            </div>
          </div>
          {errors.decision && (
            <p className="mt-2 text-sm text-red-600">{errors.decision || ''}</p>
          )}
        </div>

        {/* Reviewer Comments Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reviewer Comments <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.reviewer_comments || ''}
            onChange={(e) => updateField('reviewer_comments', e.target.value)}
            rows={5}
            placeholder="Enter detailed review comments, findings, and recommendations..."
            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.reviewer_comments && (
            <p className="mt-1 text-sm text-red-600">{errors.reviewer_comments || ''}</p>
          )}
        </div>

        {/* Confirmation Section */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3">Confirmation</h3>
          
          {formData.decision && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
              <h4 className="font-medium text-blue-900 mb-2">Review Summary</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-blue-700">Decision:</dt>
                  <dd className="font-medium text-blue-900">
                    {formData.decision === 'APPROVE' && 'Approve'}
                    {formData.decision === 'REJECT' && 'Reject'}
                    {formData.decision === 'CORRECTIONS_NEEDED' && 'Corrections Needed'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-blue-700">Next Phase:</dt>
                  <dd className="font-medium text-blue-900">
                    {formData.decision === 'APPROVE' && 'COMPLETE'}
                    {formData.decision === 'REJECT' && 'DOCUMENTATION'}
                    {formData.decision === 'CORRECTIONS_NEEDED' && 'SAMPLE'}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <div className="flex items-start p-4 bg-gray-50 border border-gray-200 rounded">
            <input
              type="checkbox"
              id="acknowledgement"
              checked={!!formData.acknowledgement}
              onChange={(e) => updateField('acknowledgement', e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="acknowledgement" className="ml-2 text-sm text-gray-700">
              <span className="font-medium">I acknowledge</span> that I have thoroughly reviewed this PPAP submission
              and the decision provided is accurate and complete to the best of my knowledge. <span className="text-red-500">*</span>
            </label>
          </div>
          {errors.acknowledgement && (
            <p className="mt-1 text-sm text-red-600">{errors.acknowledgement || ''}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-6 border-t border-gray-200 flex justify-between items-center">
          <div>
            {successMessage && (
              <div className="text-sm font-medium text-green-700 bg-green-50 px-4 py-2 rounded">
                {successMessage || ''}
              </div>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit Review Decision →'}
          </button>
        </div>
      </div>
    </div>
  );
}
