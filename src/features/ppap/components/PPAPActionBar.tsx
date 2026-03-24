'use client';

import { currentUser } from '@/src/lib/mockUser';
import { canAssignPPAP, canAcknowledgePPAP, canSubmitPPAP } from '../utils/permissions';
import { isPreAckReady, isPostAckReady } from '../utils/validationHelpers';
import { Validation } from '../types/validation';

interface Props {
  ppapState: string;
  validations: Validation[];
}

export default function PPAPActionBar({ ppapState, validations }: Props) {
  const preAckReady = isPreAckReady(validations);
  const postAckReady = isPostAckReady(validations);

  const showAssign = canAssignPPAP(currentUser.role);
  const showAcknowledge = ppapState === 'READY_FOR_ACKNOWLEDGEMENT';
  const showSubmit = ppapState === 'READY_FOR_SUBMISSION';

  const canAcknowledge = canAcknowledgePPAP(currentUser.role, ppapState) && preAckReady;
  const canSubmit = canSubmitPPAP(currentUser.role, ppapState) && postAckReady;

  const getAcknowledgeTooltip = () => {
    if (!showAcknowledge) return '';
    if (!canAcknowledgePPAP(currentUser.role, ppapState)) {
      return 'Only Coordinator/Admin can acknowledge';
    }
    if (!preAckReady) {
      return 'Complete all pre-ack validations';
    }
    return '';
  };

  const getSubmitTooltip = () => {
    if (!showSubmit) return '';
    if (!canSubmitPPAP(currentUser.role, ppapState)) {
      return 'Only Engineer/Admin can submit';
    }
    if (!postAckReady) {
      return 'All validations must be approved';
    }
    return '';
  };

  const handleAssign = () => {
    alert('Assign Engineer action (demo only - no backend)');
  };

  const handleAcknowledge = () => {
    if (!canAcknowledge) return;
    alert('Acknowledge PPAP action (demo only - no backend)');
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    alert('Submit PPAP action (demo only - no backend)');
  };

  if (!showAssign && !showAcknowledge && !showSubmit) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
      <div className="flex items-center space-x-3">
        <span className="text-sm font-semibold text-gray-700">Actions:</span>

        {showAssign && (
          <button
            onClick={handleAssign}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Assign Engineer
          </button>
        )}

        {showAcknowledge && (
          <div className="relative group">
            <button
              onClick={handleAcknowledge}
              disabled={!canAcknowledge}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                canAcknowledge
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
              }`}
            >
              Acknowledge
            </button>
            {!canAcknowledge && getAcknowledgeTooltip() && (
              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                {getAcknowledgeTooltip()}
              </div>
            )}
          </div>
        )}

        {showSubmit && (
          <div className="relative group">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                canSubmit
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
              }`}
            >
              Submit
            </button>
            {!canSubmit && getSubmitTooltip() && (
              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                {getSubmitTooltip()}
              </div>
            )}
          </div>
        )}

        <div className="ml-auto text-xs text-gray-500">
          Demo Mode: Actions visible based on role + state + validation readiness
        </div>
      </div>
    </div>
  );
}
