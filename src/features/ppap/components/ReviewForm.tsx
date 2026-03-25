'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logEvent } from '@/src/features/events/mutations';
import { updatePPAPState } from '../utils/updatePPAPState';
import { currentUser } from '@/src/lib/mockUser';
import { PPAPStatus } from '@/src/types/database.types';

interface ReviewFormProps {
  ppapId: string;
  partNumber: string;
  isReadOnly?: boolean;
}

type ReviewDecision = 'APPROVE' | 'REJECT' | 'CORRECTIONS_NEEDED';

interface ReviewData {
  decision: ReviewDecision | '';
  reviewer_comments: string;
  acknowledgement: boolean;
}

export function ReviewForm({ ppapId, partNumber, isReadOnly = false }: ReviewFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  // Phase 3F.11: Role-based access control
  const userRole = currentUser.role;
  const isCoordinator = userRole === 'coordinator';

  // Phase 3F.11: Log review access check
  console.log('👤 REVIEW ACCESS CHECK', {
    role: userRole,
    hasAccess: isCoordinator,
  });

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

  // Phase 3F.8.1: State-based transitions using PPAPStatus
  const getNextState = (decision: ReviewDecision): PPAPStatus => {
    switch (decision) {
      case 'APPROVE':
        return 'APPROVED';
      case 'REJECT':
        return 'CLOSED'; // REJECTED maps to CLOSED in PPAPStatus
      case 'CORRECTIONS_NEEDED':
        return 'SUBMITTED'; // Return to submitted state for corrections
      default:
        return 'APPROVED';
    }
  };

  const handleSubmit = async () => {
    setErrors({});
    setSuccessMessage('');

    // Phase 3F.11: CRITICAL - Authorization guard
    if (currentUser.role !== 'coordinator') {
      console.error('🚨 UNAUTHORIZED REVIEW ATTEMPT', {
        userId: currentUser.id,
        role: currentUser.role,
      });
      setErrors({
        _form: 'Only coordinators can perform review decisions',
      });
      return;
    }

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

      // Phase 3F.8.1: Determine next state based on decision
      const nextState = getNextState(formData.decision as ReviewDecision);

      // Phase 3F.8.1: ALL status updates go through updatePPAPState()
      const result = await updatePPAPState(
        ppapId,
        nextState,
        currentUser.id,
        currentUser.role
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to update PPAP status');
      }

      const phaseMessages: Record<ReviewDecision, string> = {
        APPROVE: '✓ Review completed! PPAP APPROVED. Advancing to COMPLETE phase...',
        REJECT: '✓ Review completed! PPAP REJECTED. Returning to DOCUMENTATION phase...',
        CORRECTIONS_NEEDED: '✓ Review completed! Corrections needed. Returning to SAMPLE phase...',
      };

      setSuccessMessage(phaseMessages[formData.decision as ReviewDecision] || '');
      
      // Refresh UI to reflect status/phase change
      router.refresh();
      
      // Phase 3F: Phase is now derived from state, no manual phase setting
      // The workflow bar will automatically update when state changes
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

  // Phase 3F.11: Render read-only status panel for non-coordinators
  if (!isCoordinator) {
    return (
      <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-300 rounded-xl shadow-sm">
        <div className="border-b border-gray-200 px-8 py-6">
          <h2 className="text-2xl font-bold text-gray-900">Review Phase</h2>
          <p className="text-sm text-gray-600 mt-1">
            Part Number: <span className="font-medium">{partNumber || ''}</span>
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Role: <span className="font-medium">{userRole}</span>
          </p>
        </div>

        <div className="p-8">
          <div className="flex items-start p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <div className="flex-shrink-0">
              <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-blue-900">Awaiting Coordinator Review Decision</h3>
              <p className="mt-2 text-sm text-blue-800">
                This PPAP submission is currently awaiting review by a coordinator.
              </p>
              <p className="mt-2 text-sm text-blue-700">
                Only users with the <span className="font-semibold">coordinator</span> role can make review decisions.
              </p>
              <div className="mt-4 p-3 bg-white border border-blue-200 rounded">
                <p className="text-xs font-medium text-gray-700">Current Status:</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">Submitted - Pending Review</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Phase 3F.11: Full ReviewForm for coordinators only
  return (
    <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-300 rounded-xl shadow-sm">
      <div className="border-b border-gray-200 px-8 py-6">
        <h2 className="text-2xl font-bold text-gray-900">Review Phase</h2>
        <p className="text-sm text-gray-600 mt-1">
          Part Number: <span className="font-medium">{partNumber || ''}</span>
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Role: <span className="font-medium text-green-700">{userRole}</span> ✓
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

      <div className="p-8 space-y-8">
        {errors._form && (
          <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800 font-medium">
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
            {loading ? 'Submitting...' : 'Submit Review Decision →'}
          </button>
        </div>
      </div>
    </div>
  );
}
