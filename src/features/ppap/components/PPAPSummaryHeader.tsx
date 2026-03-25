'use client';

import { PPAPStatus } from '@/src/types/database.types';
import { Validation } from '../types/validation';
import { mapStatusToState } from '../utils/ppapTableHelpers';

interface Props {
  ppapStatus: PPAPStatus;
  validations: Validation[];
}

export default function PPAPSummaryHeader({ ppapStatus, validations }: Props) {
  const derivedState = mapStatusToState(ppapStatus);

  // 1. Intake Status (mock - using simple logic)
  const getIntakeStatus = () => {
    // Mock logic: assume intake is at risk if state is BLOCKED or ON_HOLD
    if (derivedState === 'BLOCKED' || derivedState === 'ON_HOLD') {
      return { label: '⚠️ At Risk', color: 'text-orange-600' };
    }
    return { label: '✅ Ready', color: 'text-green-600' };
  };

  // 2. Pre-Ack Progress
  const getPreAckProgress = () => {
    const preAckValidations = validations.filter(v => v.category === 'pre-ack');
    const completedCount = preAckValidations.filter(
      v => v.status === 'complete' || v.status === 'approved'
    ).length;
    return `${completedCount} / ${preAckValidations.length} Complete`;
  };

  // 3. Acknowledgement Status
  const getAcknowledgementStatus = () => {
    const acknowledgedStates = [
      'ACKNOWLEDGED',
      'POST_ACK_ASSIGNED',
      'IN_VALIDATION',
      'READY_FOR_SUBMISSION',
      'SUBMITTED',
      'ACCEPTED',
      'COMPLETE',
    ];
    
    if (acknowledgedStates.includes(derivedState)) {
      return { label: '✅ Acknowledged', color: 'text-green-600' };
    }
    return { label: '❌ Not Acknowledged', color: 'text-red-600' };
  };

  // 4. Post-Ack Validation
  const getPostAckValidation = () => {
    const postAckValidations = validations.filter(v => v.category === 'post-ack');
    const approvedCount = postAckValidations.filter(v => v.status === 'approved').length;
    return `${approvedCount} / ${postAckValidations.length} Approved`;
  };

  // 5. Submission Package (mock - using validation completion as proxy)
  const getSubmissionPackage = () => {
    const totalItems = 9;
    const postAckValidations = validations.filter(v => v.category === 'post-ack');
    const readyCount = Math.min(
      postAckValidations.filter(v => v.status === 'complete' || v.status === 'approved').length,
      totalItems
    );
    return `${readyCount} / ${totalItems} Ready`;
  };

  // 6. Overall Status
  const getOverallStatus = () => {
    if (derivedState === 'BLOCKED') {
      return { label: '🔴 Blocked', color: 'text-red-600' };
    }
    if (derivedState === 'READY_FOR_ACKNOWLEDGEMENT' || derivedState === 'READY_FOR_SUBMISSION') {
      return { label: '🟢 Ready', color: 'text-green-600' };
    }
    if (derivedState === 'IN_VALIDATION') {
      return { label: '🟡 In Progress', color: 'text-yellow-600' };
    }
    if (derivedState === 'SUBMITTED') {
      return { label: '🔵 Submitted', color: 'text-blue-600' };
    }
    if (derivedState === 'ACCEPTED' || derivedState === 'COMPLETE') {
      return { label: '🟢 Complete', color: 'text-green-600' };
    }
    return { label: '⚪ Pending', color: 'text-gray-500' };
  };

  const intakeStatus = getIntakeStatus();
  const ackStatus = getAcknowledgementStatus();
  const overallStatus = getOverallStatus();

  return (
    <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">PPAP Summary</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Overall Status */}
        <div>
          <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
            Overall Status
          </h3>
          <p className={`text-lg font-bold ${overallStatus.color}`}>
            {overallStatus.label}
          </p>
        </div>

        {/* Intake Status */}
        <div>
          <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
            Intake Status
          </h3>
          <p className={`text-lg font-bold ${intakeStatus.color}`}>
            {intakeStatus.label}
          </p>
        </div>

        {/* Pre-Ack Progress */}
        <div>
          <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
            Pre-Ack Progress
          </h3>
          <p className="text-lg font-bold text-gray-900">
            {getPreAckProgress()}
          </p>
        </div>

        {/* Acknowledgement */}
        <div>
          <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
            Acknowledgement
          </h3>
          <p className={`text-lg font-bold ${ackStatus.color}`}>
            {ackStatus.label}
          </p>
        </div>

        {/* Post-Ack Validation */}
        <div>
          <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
            Post-Ack Validation
          </h3>
          <p className="text-lg font-bold text-gray-900">
            {getPostAckValidation()}
          </p>
        </div>

        {/* Submission Package */}
        <div>
          <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
            Submission Package
          </h3>
          <p className="text-lg font-bold text-gray-900">
            {getSubmissionPackage()}
          </p>
        </div>
      </div>
    </div>
  );
}
