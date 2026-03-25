'use client';

// FUTURE: Load validation set based on customerType
// TRANE → 14 validations (strict)
// RHEEM → alternate validation set

import { useState } from 'react';
import { Validation, ValidationCategory } from '../types/validation';
import { 
  getValidationSummary,
  isPreAckReady,
  isPostAckReady,
  getNextAction,
  getRequirementBadgeStyle,
} from '../utils/validationHelpers';
import { getValidationGuidance } from '../utils/validationGuidance';
import { PPAPStatus } from '@/src/types/database.types';
import { mapStatusToState } from '../utils/ppapTableHelpers';
import { canEditPreAckValidations, canEditPostAckValidations } from '../utils/stateWorkflowMapping';

interface Props {
  validations: Validation[];
  currentPhase: 'pre-ack' | 'post-ack';
  ppapStatus?: PPAPStatus;
}

const STATUS_ICONS = {
  not_started: '☐',
  in_progress: '⏳',
  complete: '✓',
  approved: '✔',
};

const STATUS_COLORS = {
  not_started: 'text-gray-400 bg-gray-100',
  in_progress: 'text-blue-600 bg-blue-100',
  complete: 'text-green-600 bg-green-100',
  approved: 'text-purple-600 bg-purple-100',
};

export default function PPAPValidationPanel({ validations, currentPhase, ppapStatus }: Props) {
  const [localValidations, setLocalValidations] = useState(validations);
  
  // Phase 3E.9: Debug logging for requirement levels
  console.log('Phase 3E.9 - Validation Requirement Levels:', localValidations.map(v => ({
    name: v.name,
    level: v.requirement_level || 'MISSING',
    category: v.category
  })));
  
  // Phase 3F: Determine editability based on state
  const derivedState = ppapStatus ? mapStatusToState(ppapStatus) : 'INITIATED';
  const canEditPreAck = canEditPreAckValidations(derivedState);
  const canEditPostAck = canEditPostAckValidations(derivedState);

  const preAckValidations = localValidations.filter((v) => v.category === 'pre-ack');
  const postAckValidations = localValidations.filter((v) => v.category === 'post-ack');

  const toggleValidationStatus = (id: string, category: ValidationCategory) => {
    // Phase 3F: Check if validation is editable based on state
    if (category === 'pre-ack' && !canEditPreAck) {
      return; // Pre-ack validations locked after acknowledgement
    }
    if (category === 'post-ack' && !canEditPostAck) {
      return; // Post-ack validations locked before acknowledgement
    }
    
    setLocalValidations((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v;

        const statusCycle = v.requires_approval
          ? ['not_started', 'in_progress', 'complete', 'approved']
          : ['not_started', 'in_progress', 'complete'];

        const currentIndex = statusCycle.indexOf(v.status);
        const nextIndex = (currentIndex + 1) % statusCycle.length;
        const nextStatus = statusCycle[nextIndex];

        // Set approval metadata when transitioning to 'approved'
        const approvalData =
          nextStatus === 'approved'
            ? {
                approved_by: 'Coordinator',
                approved_at: new Date(),
              }
            : {};

        return { ...v, status: nextStatus as any, ...approvalData };
      })
    );
  };

  const renderValidationSection = (
    title: string,
    category: ValidationCategory,
    validationList: Validation[]
  ) => {
    const summary = getValidationSummary(localValidations, category);

    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <span className="text-sm font-medium text-gray-600">{summary} Complete</span>
        </div>

        <div className="space-y-2">
          {validationList.map((validation) => {
            const isEditable = validation.category === 'pre-ack' ? canEditPreAck : canEditPostAck;
            return (
            <div
              key={validation.id}
              onClick={() => isEditable && toggleValidationStatus(validation.id, validation.category)}
              className={`flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg transition-colors ${
                isEditable ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{STATUS_ICONS[validation.status]}</span>
                <div className="flex-1">
                  <div className="group relative inline-block">
                    <div className="font-medium text-gray-900 border-b border-dotted border-gray-400 cursor-help">
                      {validation.name}
                    </div>
                    {getValidationGuidance(validation.id) && (
                      <div className="absolute left-0 top-full mt-1 hidden group-hover:block bg-gray-800 text-white text-xs p-3 rounded-lg w-72 z-10 shadow-lg">
                        <div className="font-semibold mb-1">
                          {getValidationGuidance(validation.id)?.title}
                        </div>
                        <div className="text-gray-200">
                          {getValidationGuidance(validation.id)?.description}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs text-gray-500 capitalize">
                      {validation.validation_type}
                    </span>
                    {validation.requirement_level && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${getRequirementBadgeStyle(validation.requirement_level)}`}>
                        {validation.requirement_level}
                      </span>
                    )}
                    {validation.requires_approval && (
                      <span className="text-xs text-orange-600 font-medium">
                        Requires Approval
                      </span>
                    )}
                  </div>
                  {validation.requires_approval && (
                    <div className="mt-1">
                      {validation.status === 'complete' && (
                        <div className="flex items-center space-x-1">
                          <span className="text-yellow-600">⏳</span>
                          <span className="text-xs text-yellow-600 font-medium">
                            Approval: Pending
                          </span>
                        </div>
                      )}
                      {validation.status === 'approved' && validation.approved_by && (
                        <div className="flex items-center space-x-1">
                          <span className="text-purple-600">✔</span>
                          <span className="text-xs text-gray-500">
                            Approved by: {validation.approved_by}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <span
                className={`px-3 py-1 text-xs font-medium rounded-full ${
                  STATUS_COLORS[validation.status]
                }`}
              >
                {validation.status.replace('_', ' ')}
              </span>
            </div>
          );
          })}
        </div>
      </div>
    );
  };

  const preAckReady = isPreAckReady(localValidations);
  const postAckReady = isPostAckReady(localValidations);
  const preAckNextAction = getNextAction(localValidations, 'pre-ack');
  const postAckNextAction = getNextAction(localValidations, 'post-ack');

  return (
    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Validation Requirements</h2>

      <div className="mb-6 space-y-3">
        <div
          className={`p-4 rounded-lg border-2 ${
            preAckReady
              ? 'bg-green-50 border-green-300'
              : 'bg-red-50 border-red-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{preAckReady ? '✅' : '❌'}</span>
            <span className={`font-semibold ${preAckReady ? 'text-green-800' : 'text-red-800'}`}>
              {preAckReady ? 'Ready for Acknowledgement' : 'Not Ready for Acknowledgement'}
            </span>
          </div>
        </div>

        <div
          className={`p-4 rounded-lg border-2 ${
            postAckReady
              ? 'bg-green-50 border-green-300'
              : 'bg-orange-50 border-orange-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{postAckReady ? '✅' : '❌'}</span>
            <span className={`font-semibold ${postAckReady ? 'text-green-800' : 'text-orange-800'}`}>
              {postAckReady ? 'Ready for Submission' : 'Not Ready for Submission'}
            </span>
          </div>
        </div>

        <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
          <div className="flex items-start space-x-2">
            <span className="text-xl">👉</span>
            <div>
              <div className="font-semibold text-blue-900 mb-1">Next Action:</div>
              <div className="text-blue-800">
                <span className="font-medium">Pre-Ack:</span> {preAckNextAction}
              </div>
              <div className="text-blue-800">
                <span className="font-medium">Post-Ack:</span> {postAckNextAction}
              </div>
            </div>
          </div>
        </div>
      </div>

      {renderValidationSection(
        'Pre-Acknowledgement Readiness',
        'pre-ack',
        preAckValidations
      )}

      {renderValidationSection(
        'Post-Acknowledgement Requirements',
        'post-ack',
        postAckValidations
      )}

      {/* Phase 3F.12: Real state-driven UI - removed demo mode banner */}
    </div>
  );
}
