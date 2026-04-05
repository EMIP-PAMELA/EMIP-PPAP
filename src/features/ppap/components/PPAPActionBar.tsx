'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { currentUser } from '@/src/lib/mockUser';
import { canAssignPPAP, canAcknowledgePPAP, canSubmitPPAP } from '../utils/permissions';
import { isPreAckReady, isPostAckReady } from '../utils/validationHelpers';
import { Validation } from '../types/validation';
import { updatePPAPState } from '../utils/updatePPAPState';
import { PPAPStatus } from '@/src/types/database.types';

interface Props {
  ppapId: string;
  ppapState: string;
  validations: Validation[];
}

export default function PPAPActionBar({ ppapId, ppapState, validations }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const preAckReady = isPreAckReady(validations);
  const postAckReady = isPostAckReady(validations);

  const showAssign = canAssignPPAP(currentUser.role);
  // V3.3A: compare directly against PPAPStatus values
  const showAcknowledge = ppapState === 'READY_TO_ACKNOWLEDGE';
  const showSubmit = ppapState === 'AWAITING_SUBMISSION';

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

  const handleAssign = async () => {
    // TODO: Implement assign engineer logic
    alert('Assign Engineer action (to be implemented)');
  };

  const handleAcknowledge = async () => {
    if (!canAcknowledge || loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Phase 3F.6: Log state write attempt
      console.log('Phase 3F.6 - STATE WRITE ATTEMPT', {
        to: 'ACKNOWLEDGED',
        source: 'PPAPActionBar.tsx (handleAcknowledge)',
      });
      
      // Phase 3G: Real state transition with persistence
      const result = await updatePPAPState(
        ppapId,
        'ACKNOWLEDGED' as PPAPStatus,
        currentUser.id,
        currentUser.role
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to acknowledge PPAP');
      }
      
      // Refresh UI to reflect new state
      router.refresh();
    } catch (err) {
      console.error('Acknowledge failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to acknowledge PPAP');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Phase 3F.6: Log state write attempt
      console.log('Phase 3F.6 - STATE WRITE ATTEMPT', {
        to: 'SUBMITTED',
        source: 'PPAPActionBar.tsx (handleSubmit)',
      });
      
      // Phase 3G: Real state transition with persistence
      const result = await updatePPAPState(
        ppapId,
        'SUBMITTED' as PPAPStatus,
        currentUser.id,
        currentUser.role
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to submit PPAP');
      }
      
      // Refresh UI to reflect new state
      router.refresh();
    } catch (err) {
      console.error('Submit failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit PPAP');
    } finally {
      setLoading(false);
    }
  };

  if (!showAssign && !showAcknowledge && !showSubmit) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}
      
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
              disabled={!canAcknowledge || loading}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                canAcknowledge && !loading
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
              }`}
            >
              {loading ? 'Processing...' : 'Acknowledge'}
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
              disabled={!canSubmit || loading}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                canSubmit && !loading
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
              }`}
            >
              {loading ? 'Processing...' : 'Submit'}
            </button>
            {!canSubmit && getSubmitTooltip() && (
              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                {getSubmitTooltip()}
              </div>
            )}
          </div>
        )}

        <div className="ml-auto text-xs text-gray-500">
          V3.3A: State-driven actions
        </div>
      </div>
    </div>
  );
}
