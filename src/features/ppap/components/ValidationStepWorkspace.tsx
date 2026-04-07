'use client';

/**
 * V4.0: Validation Step Workspace
 * 
 * Standardized execution surface for validation steps.
 * Provides a consistent UI for completing validation actions.
 */

import { useState } from 'react';
import { DBValidation } from '../utils/validationDatabase';
import { updateValidationStatus } from '../utils/validationDatabase';
import { currentUser } from '@/src/lib/mockUser';
import { useRouter } from 'next/navigation';

interface ValidationStepWorkspaceProps {
  validationKey: string;
  validation: DBValidation;
  ppapId: string;
  onClose: () => void;
  onComplete?: () => void;
}

export function ValidationStepWorkspace({
  validationKey,
  validation,
  ppapId,
  onClose,
  onComplete,
}: ValidationStepWorkspaceProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleComplete = async () => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      console.log('✅ V4.0 VALIDATION STEP COMPLETING', {
        validationKey,
        ppapId,
        validationId: validation.id,
      });
      
      // Update validation status to complete
      await updateValidationStatus(
        validation.id,
        'complete',
        currentUser.id,
        currentUser.role
      );
      
      console.log('✅ V4.0 VALIDATION STEP COMPLETED', {
        validationKey,
        ppapId,
      });
      
      // Refresh to trigger derived state recalculation
      router.refresh();
      
      // Call completion callback
      if (onComplete) {
        onComplete();
      }
      
      // Close workspace
      onClose();
    } catch (err) {
      console.error('Failed to complete validation step:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete validation');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Render workspace content based on validation key
  const renderWorkspaceContent = () => {
    switch (validationKey) {
      case 'material_availability':
        return <MaterialAvailabilityWorkspace />;
      
      case 'psw_presence':
        return <PSWPresenceWorkspace />;
      
      case 'discrepancy_resolution':
        return <DiscrepancyResolutionWorkspace />;
      
      default:
        return (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ This validation step workspace is not yet fully implemented.
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Validation Key: {validationKey}
            </p>
          </div>
        );
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{validation.name}</h2>
            <p className="text-sm text-blue-100 mt-1">PPAP Validation Step</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-500 rounded-full p-2 transition-colors"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderWorkspaceContent()}
        </div>
        
        {/* Error Display */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-t border-red-200">
            <p className="text-sm text-red-800">❌ {error}</p>
          </div>
        )}
        
        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
          <div className="text-sm text-gray-600">
            Status: <span className="font-medium">{validation.status}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={handleComplete}
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSubmitting ? '⏳ Completing...' : '✓ Complete Step'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Individual workspace components for each validation type

function MaterialAvailabilityWorkspace() {
  const [materialsAvailable, setMaterialsAvailable] = useState(false);
  const [notes, setNotes] = useState('');
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Material Availability Check</h3>
        <p className="text-sm text-gray-600">
          Verify that all required materials are available and ready for production.
        </p>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">📋 Checklist</h4>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>✓ All raw materials are in stock</li>
          <li>✓ Material certifications are available</li>
          <li>✓ Material specifications match requirements</li>
          <li>✓ Lead times are acceptable</li>
        </ul>
      </div>
      
      <div>
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={materialsAvailable}
            onChange={(e) => setMaterialsAvailable(e.target.checked)}
            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-900">
            I confirm all required materials are available
          </span>
        </label>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes (Optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Add any relevant notes about material availability..."
        />
      </div>
    </div>
  );
}

function PSWPresenceWorkspace() {
  const [pswPresent, setPswPresent] = useState(false);
  const [pswLocation, setPswLocation] = useState('');
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">PSW Presence Verification</h3>
        <p className="text-sm text-gray-600">
          Confirm that the Part Submission Warrant (PSW) is present and accessible.
        </p>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">📄 PSW Requirements</h4>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>✓ PSW document is available</li>
          <li>✓ PSW is properly filled out</li>
          <li>✓ PSW contains all required signatures</li>
          <li>✓ PSW matches current part revision</li>
        </ul>
      </div>
      
      <div>
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={pswPresent}
            onChange={(e) => setPswPresent(e.target.checked)}
            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-900">
            I confirm the PSW is present and complete
          </span>
        </label>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          PSW Location/Reference
        </label>
        <input
          type="text"
          value={pswLocation}
          onChange={(e) => setPswLocation(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="e.g., Document folder, file path, or reference number..."
        />
      </div>
    </div>
  );
}

function DiscrepancyResolutionWorkspace() {
  const [discrepanciesResolved, setDiscrepanciesResolved] = useState(false);
  const [resolutionDetails, setResolutionDetails] = useState('');
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Discrepancy Resolution</h3>
        <p className="text-sm text-gray-600">
          Review and resolve any identified discrepancies before proceeding.
        </p>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">🔍 Review Areas</h4>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>✓ Drawing discrepancies resolved</li>
          <li>✓ BOM discrepancies addressed</li>
          <li>✓ Specification conflicts resolved</li>
          <li>✓ Customer feedback incorporated</li>
        </ul>
      </div>
      
      <div>
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={discrepanciesResolved}
            onChange={(e) => setDiscrepanciesResolved(e.target.checked)}
            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-900">
            I confirm all discrepancies have been resolved
          </span>
        </label>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Resolution Details
        </label>
        <textarea
          value={resolutionDetails}
          onChange={(e) => setResolutionDetails(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Describe how discrepancies were resolved..."
        />
      </div>
    </div>
  );
}
