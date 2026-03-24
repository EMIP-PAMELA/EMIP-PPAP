'use client';

import { useState } from 'react';
import { Validation, ValidationCategory } from '../types/validation';
import { getValidationSummary } from '../utils/validationHelpers';

interface Props {
  validations: Validation[];
  currentPhase: 'pre-ack' | 'post-ack';
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

export default function PPAPValidationPanel({ validations, currentPhase }: Props) {
  const [localValidations, setLocalValidations] = useState(validations);

  const preAckValidations = localValidations.filter((v) => v.category === 'pre-ack');
  const postAckValidations = localValidations.filter((v) => v.category === 'post-ack');

  const toggleValidationStatus = (id: string) => {
    setLocalValidations((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v;

        const statusCycle = v.requires_approval
          ? ['not_started', 'in_progress', 'complete', 'approved']
          : ['not_started', 'in_progress', 'complete'];

        const currentIndex = statusCycle.indexOf(v.status);
        const nextIndex = (currentIndex + 1) % statusCycle.length;
        const nextStatus = statusCycle[nextIndex];

        return { ...v, status: nextStatus as any };
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
          {validationList.map((validation) => (
            <div
              key={validation.id}
              onClick={() => toggleValidationStatus(validation.id)}
              className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{STATUS_ICONS[validation.status]}</span>
                <div>
                  <div className="font-medium text-gray-900">{validation.name}</div>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs text-gray-500 capitalize">
                      {validation.validation_type}
                    </span>
                    {validation.required && (
                      <span className="text-xs text-red-600 font-medium">Required</span>
                    )}
                    {validation.requires_approval && (
                      <span className="text-xs text-orange-600 font-medium">
                        Requires Approval
                      </span>
                    )}
                  </div>
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
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Validation Requirements</h2>

      {renderValidationSection(
        'Pre-Acknowledgement Requirements',
        'pre-ack',
        preAckValidations
      )}

      {renderValidationSection(
        'Post-Acknowledgement Requirements',
        'post-ack',
        postAckValidations
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <span className="font-medium">Demo Mode:</span> Click any validation to cycle through
          status states. Changes are not persisted.
        </p>
      </div>
    </div>
  );
}
