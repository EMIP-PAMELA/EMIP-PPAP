'use client';

import { PPAPStatus } from '@/src/types/database.types';
import { mapStatusToState } from '../utils/ppapTableHelpers';
import { isPreAckReady } from '../utils/validationHelpers';
import { Validation } from '../types/validation';

interface Props {
  ppapStatus: PPAPStatus;
  validations: Validation[];
}

export default function PPAPAcknowledgementBanner({ ppapStatus, validations }: Props) {
  const derivedState = mapStatusToState(ppapStatus);
  const preAckReady = isPreAckReady(validations);

  if (derivedState === 'READY_FOR_ACKNOWLEDGEMENT' && preAckReady) {
    return (
      <div className="bg-green-50 text-green-800 border border-green-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold mb-2">✅ Ready for Acknowledgement</h3>
        <p className="text-sm leading-relaxed">
          All pre-acknowledgement checks are complete. Acknowledgement confirms that this PPAP has been reviewed and accepted for production validation. This action is performed by the PPAP Coordinator.
        </p>
      </div>
    );
  }

  if (!preAckReady) {
    return (
      <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold mb-2">❌ Not Ready for Acknowledgement</h3>
        <p className="text-sm leading-relaxed">
          Complete all pre-acknowledgement requirements before acknowledgement is allowed.
        </p>
      </div>
    );
  }

  return null;
}
